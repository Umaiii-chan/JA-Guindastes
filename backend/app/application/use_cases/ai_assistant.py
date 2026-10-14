"""Assistente de IA do simulador (TASK-076; ADR-039): quatro usos, todos sem decidir nada.

1. `scenario_from_text`: plano em linguagem natural vira cenário, carga e entrega. A resposta do
   modelo é JSON estruturado, convertido em `ScenarioSpec` pelo mesmo domínio que valida os cenários
   salvos (`InvalidScenarioError` vira "a IA devolveu um cenário inválido"). Quem aplica é a pessoa,
   depois de revisar.
2. `explain_recommendation`: explica a recomendação do planejador com os números recebidos.
3. `lift_report`: relatório de içamento. A tabela de números é montada por código a partir da
   avaliação do backend; a IA escreve só o texto descritivo.
4. `review_recording`: revisão de uma gravação. Indicadores calculados por código; a IA comenta.

A IA nunca decide capacidade, utilização nem segurança (RN-004, RN-008): ela só recebe números já
calculados. Cada chamada conta no limite de uso por usuário (`AiUsageLimiter`), antes de ir ao
provedor.
"""

import json
import math
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta, timezone
from typing import Any

from app.application.ports.ai_usage_limiter import AiUsageLimiter
from app.application.ports.llm_provider import LlmCompletion, LlmProvider, LlmRequest
from app.application.use_cases.ai_facts import (
    evaluation_table,
    recording_facts,
    recording_table,
    scenario_summary,
)
from app.application.use_cases.ai_prompts import (
    EXPLAIN_SYSTEM,
    REPORT_SYSTEM,
    REVIEW_SYSTEM,
    SCENARIO_RESPONSE_SCHEMA,
    SCENARIO_SYSTEM,
    wrap_data,
)
from app.application.use_cases.authentication import Clock, utc_now
from app.domain.entities.load import Load
from app.domain.entities.scenario import (
    CargoPlacementSpec,
    CranePlacementSpec,
    DeliveryPointSpec,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
    SoilKind,
    SoilZoneSpec,
    TerrainSpec,
    WindSpec,
)
from app.domain.entities.simulation_recording import SimulationRecording
from app.domain.exceptions.domain_errors import DomainError
from app.domain.value_objects.length import Length
from app.domain.value_objects.load_dimensions import LoadDimensions
from app.domain.value_objects.mass import Mass

MAX_TEXT_CHARS = 1500
MAX_CONTEXT_CHARS = 20_000
MAX_COORDINATE_M = 500.0
MAX_SIZE_M = 200.0
MAX_WEIGHT_KG = 1_000_000.0
MAX_AI_OBSTACLES = 20
SOIL_ZONE_RADIUS_M = 8.0

BRASILIA = timezone(timedelta(hours=-3))
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class AiInputError(Exception):
    """Entrada do usuário recusada antes de chamar a IA (vazia ou grande demais)."""


class AiRateLimitedError(Exception):
    """O usuário passou do limite de chamadas à IA por hora."""

    def __init__(self, limit: int, retry_after_seconds: int) -> None:
        self.limit = limit
        self.retry_after_seconds = retry_after_seconds
        minutes = max(1, math.ceil(retry_after_seconds / 60))
        super().__init__(
            f"Você atingiu o limite de {limit} usos do assistente por hora. "
            f"Tente de novo em cerca de {minutes} min."
        )


class AiOutputError(Exception):
    """A IA respondeu, mas o resultado não passou na validação (JSON ou regras do domínio)."""


@dataclass(frozen=True, slots=True)
class LoadDraft:
    description: str
    weight_kg: float
    length_m: float
    width_m: float
    height_m: float


@dataclass(frozen=True, slots=True)
class ScenarioDraft:
    """Proposta da IA para a pessoa revisar: cenário, carga (com posição e entrega no cenário)."""

    spec: ScenarioSpec
    load: LoadDraft
    summary: str
    assumptions: tuple[str, ...]
    completion: LlmCompletion


@dataclass(frozen=True, slots=True)
class AiText:
    text: str
    completion: LlmCompletion


@dataclass(frozen=True, slots=True)
class LiftReportInput:
    """Dados do relatório: a avaliação já calculada pelo backend e o que a pessoa informou."""

    evaluation: Mapping[str, Any]
    state: Mapping[str, Any]
    load: Mapping[str, Any]
    crane_label: str | None = None
    scenario: Mapping[str, Any] | None = None
    note: str | None = None


def clean_text(raw: str, *, max_chars: int, what: str) -> str:
    """Texto sem caracteres de controle nem `<`/`>`, de 1 a `max_chars` caracteres."""
    text = _CONTROL_CHARS.sub(" ", raw).replace("<", "(").replace(">", ")").strip()
    if not text:
        raise AiInputError(f"Escreva {what} antes de pedir ao assistente.")
    if len(text) > max_chars:
        raise AiInputError(
            f"O texto tem {len(text)} caracteres; o limite é {max_chars}. Resuma {what}."
        )
    return text


def _json_text(value: Mapping[str, Any], what: str) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)
    if len(text) > MAX_CONTEXT_CHARS:
        raise AiInputError(f"Os dados {what} são grandes demais para o assistente.")
    return text


class AiAssistant:
    def __init__(
        self,
        provider: LlmProvider,
        limiter: AiUsageLimiter,
        *,
        clock: Clock = utc_now,
    ) -> None:
        self._provider = provider
        self._limiter = limiter
        self._clock = clock

    @property
    def model(self) -> str:
        return self._provider.model

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return self._provider.fallback_models

    @property
    def usage_limit_per_hour(self) -> int:
        return self._limiter.limit

    def _generate(self, user_key: str, request: LlmRequest) -> LlmCompletion:
        decision = self._limiter.acquire(user_key)
        if not decision.allowed:
            raise AiRateLimitedError(self._limiter.limit, decision.retry_after_seconds)
        return self._provider.generate(request)

    # --- 1. cenário a partir de texto -------------------------------------------------------

    def scenario_from_text(self, user_key: str, text: str) -> ScenarioDraft:
        description = clean_text(text, max_chars=MAX_TEXT_CHARS, what="a descrição da operação")
        completion = self._generate(
            user_key,
            LlmRequest(
                system=SCENARIO_SYSTEM,
                user=wrap_data("descricao_da_operacao", description),
                json_schema=SCENARIO_RESPONSE_SCHEMA,
                temperature=0.2,
                max_output_tokens=8192,
            ),
        )
        try:
            return _draft_from_json(completion)
        except DomainError as error:
            raise AiOutputError(
                f"A IA montou um cenário que o simulador não aceita ({error}). "
                "Reescreva a descrição com mais detalhes e tente de novo."
            ) from None

    # --- 2. explicar a recomendação ---------------------------------------------------------

    def explain_recommendation(
        self,
        user_key: str,
        recommendation: Mapping[str, Any],
        context: Mapping[str, Any] | None = None,
    ) -> AiText:
        payload: dict[str, Any] = {"recomendacao": recommendation}
        if context:
            payload["contexto"] = context
        completion = self._generate(
            user_key,
            LlmRequest(
                system=EXPLAIN_SYSTEM,
                user=wrap_data(
                    "recomendacao_do_planejador", _json_text(payload, "da recomendação")
                ),
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )
        return AiText(text=completion.text, completion=completion)

    # --- 3. relatório de içamento -----------------------------------------------------------

    def lift_report(self, user_key: str, report: LiftReportInput) -> AiText:
        facts: dict[str, Any] = {
            "calculo_do_simulador": report.evaluation,
            "estado": report.state,
            "carga": report.load,
            "guindaste": report.crane_label,
            "cenario": scenario_summary(report.scenario),
        }
        note = None
        if report.note and report.note.strip():
            note = clean_text(report.note, max_chars=500, what="a observação")
            facts["observacao_do_usuario"] = note
        completion = self._generate(
            user_key,
            LlmRequest(
                system=REPORT_SYSTEM,
                user=wrap_data("dados_do_relatorio", _json_text(facts, "do relatório")),
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )
        table = evaluation_table(
            evaluation=report.evaluation,
            state=report.state,
            load=report.load,
            crane_label=report.crane_label,
        )
        stamp = self._clock().astimezone(BRASILIA).strftime("%d/%m/%Y às %H:%M")
        markdown = "\n".join(
            [
                "# Relatório de içamento",
                "",
                f"Gerado em {stamp}, com apoio do assistente de IA ({completion.model}).",
                "",
                "## Dados do cálculo",
                "",
                "Os números abaixo vêm do cálculo do simulador, conferido com a tabela de carga "
                "ativa. A IA não os altera.",
                "",
                table,
                *(["", f"**Observação informada:** {note}"] if note else []),
                "",
                "## Análise do assistente",
                "",
                completion.text,
                "",
                "---",
                "",
                "Este relatório apoia o planejamento e não substitui o plano de içamento do "
                "responsável técnico nem a tabela de carga oficial do fabricante.",
            ]
        )
        return AiText(text=markdown, completion=completion)

    # --- 4. revisão de gravação -------------------------------------------------------------

    def review_recording(self, user_key: str, recording: SimulationRecording) -> AiText:
        summary = recording.summary
        facts = recording_facts(recording.frames, summary.duration_ms)
        completion = self._generate(
            user_key,
            LlmRequest(
                system=REVIEW_SYSTEM,
                user=wrap_data("indicadores_da_gravacao", _json_text(facts, "da gravação")),
                temperature=0.3,
                max_output_tokens=2048,
            ),
        )
        markdown = "\n".join(
            [
                f"# Revisão da gravação: {summary.name}",
                "",
                "## Indicadores",
                "",
                "Calculados a partir dos quadros gravados, sem a IA.",
                "",
                recording_table(facts, summary.name),
                "",
                "## Análise do assistente",
                "",
                completion.text,
            ]
        )
        return AiText(text=markdown, completion=completion)


# --- conversão da resposta da IA em cenário -----------------------------------------------------


def _draft_from_json(completion: LlmCompletion) -> ScenarioDraft:
    try:
        data = json.loads(completion.text)
    except ValueError:
        raise AiOutputError("A IA devolveu uma resposta ilegível. Tente de novo.") from None
    if not isinstance(data, dict):
        raise AiOutputError("A IA devolveu uma resposta fora do formato. Tente de novo.")

    load_data = _obj(data, "load")
    description = _text(load_data, "description", "load")
    weight = _num(load_data, "weight_kg", "load", maximum=MAX_WEIGHT_KG)
    length = _num(load_data, "length_m", "load", maximum=MAX_SIZE_M)
    width = _num(load_data, "width_m", "load", maximum=MAX_SIZE_M)
    height = _num(load_data, "height_m", "load", maximum=MAX_SIZE_M)
    # A mesma validação da carga do backend (peso e medidas maiores que zero).
    Load(
        description=description,
        weight=Mass(weight),
        dimensions=LoadDimensions(Length(length), Length(width), Length(height)),
    )

    pick = _obj(data, "pick")
    delivery = _obj(data, "delivery")
    crane = _obj(data, "crane")
    crane_x = _coord(crane, "x", "crane")
    crane_z = _coord(crane, "z", "crane")

    obstacles_raw = data.get("obstacles")
    if not isinstance(obstacles_raw, list):
        raise AiOutputError("A IA não informou a lista de obstáculos. Tente de novo.")
    obstacles = tuple(
        _obstacle(item, index) for index, item in enumerate(obstacles_raw[:MAX_AI_OBSTACLES])
    )

    soil_zones: tuple[SoilZoneSpec, ...] = ()
    soil = data.get("soil_kind")
    if isinstance(soil, str) and soil in {kind.value for kind in SoilKind}:
        soil_zones = (
            SoilZoneSpec(
                id="ia-solo-1",
                kind=SoilKind(soil),
                center_x=crane_x,
                center_z=crane_z,
                radius_m=SOIL_ZONE_RADIUS_M,
            ),
        )
    wind_speed = data.get("wind_speed_ms")
    wind = None
    if isinstance(wind_speed, int | float) and not isinstance(wind_speed, bool) and wind_speed > 0:
        direction = data.get("wind_direction_deg")
        wind = WindSpec(
            speed_ms=float(wind_speed),
            direction_deg=float(direction)
            if isinstance(direction, int | float) and not isinstance(direction, bool)
            else 0.0,
        )

    spec = ScenarioSpec(
        terrain=TerrainSpec(
            slope_x_percent=_num(data, "slope_x_percent", "terrain", minimum=-100, maximum=100),
            slope_z_percent=_num(data, "slope_z_percent", "terrain", minimum=-100, maximum=100),
        ),
        obstacles=obstacles,
        crane=CranePlacementSpec(
            x=crane_x, z=crane_z, heading_deg=_num(crane, "heading_deg", "crane", minimum=-3600)
        ),
        soil_zones=soil_zones,
        wind=wind,
        cargo=CargoPlacementSpec(
            x=_coord(pick, "x", "pick"),
            z=_coord(pick, "z", "pick"),
            rotation_y_deg=_num(pick, "rotation_y_deg", "pick", minimum=-3600),
        ),
        delivery=DeliveryPointSpec(
            x=_coord(delivery, "x", "delivery"),
            z=_coord(delivery, "z", "delivery"),
            rotation_y_deg=_num(delivery, "rotation_y_deg", "delivery", minimum=-3600),
            radius_m=min(
                max(_num(delivery, "radius_m", "delivery", maximum=MAX_SIZE_M), 0.5), 10.0
            ),
        ),
    )
    assumptions_raw = data.get("assumptions")
    assumptions = tuple(
        str(item).strip()[:300]
        for item in (assumptions_raw if isinstance(assumptions_raw, list) else [])
        if isinstance(item, str) and item.strip()
    )[:10]
    summary = data.get("summary")
    return ScenarioDraft(
        spec=spec,
        load=LoadDraft(
            description=description[:120],
            weight_kg=weight,
            length_m=length,
            width_m=width,
            height_m=height,
        ),
        summary=summary.strip()[:600] if isinstance(summary, str) else "",
        assumptions=assumptions,
        completion=completion,
    )


def _obj(data: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = data.get(key)
    if not isinstance(value, dict):
        raise AiOutputError(f"A IA não informou “{key}”. Tente de novo.")
    return value


def _num(
    data: Mapping[str, Any],
    key: str,
    where: str,
    *,
    minimum: float = 0.0,
    maximum: float = MAX_COORDINATE_M,
) -> float:
    value = data.get(key)
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise AiOutputError(f"A IA não informou um número válido para {where}.{key}.")
    if value < minimum or value > maximum:
        raise AiOutputError(f"O valor de {where}.{key} ({value:g}) ficou fora do intervalo aceito.")
    return float(value)


def _coord(data: Mapping[str, Any], key: str, where: str) -> float:
    return _num(data, key, where, minimum=-MAX_COORDINATE_M, maximum=MAX_COORDINATE_M)


def _text(data: Mapping[str, Any], key: str, where: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise AiOutputError(f"A IA não informou o texto de {where}.{key}.")
    return value.strip()


def _obstacle(item: Any, index: int) -> ObstacleSpec:
    if not isinstance(item, dict):
        raise AiOutputError("A IA devolveu um obstáculo fora do formato.")
    where = f"obstacles[{index}]"
    kind = item.get("kind")
    if kind not in {"box", "cylinder"}:
        raise AiOutputError(f"A IA informou um tipo de obstáculo desconhecido em {where}.")
    width = _num(item, "width_m", where, minimum=0.05, maximum=MAX_SIZE_M)
    return ObstacleSpec(
        id=f"ia-obstaculo-{index + 1}",
        label=_text(item, "label", where)[:120],
        kind=ObstacleKind(kind),
        center_x=_coord(item, "center_x", where),
        center_z=_coord(item, "center_z", where),
        width_m=width,
        depth_m=width
        if kind == "cylinder"
        else _num(item, "depth_m", where, minimum=0.05, maximum=MAX_SIZE_M),
        height_m=_num(item, "height_m", where, minimum=0.05, maximum=MAX_SIZE_M),
        rotation_y_deg=_num(item, "rotation_y_deg", where, minimum=-3600, maximum=3600),
    )
