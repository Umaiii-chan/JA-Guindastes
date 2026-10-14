"""Rotas do assistente de IA `/api/v1/ai*` (TASK-076; ADR-039; RN-004, RN-008).

- `GET /api/v1/ai/status` → 200 `{enabled, model, fallback_models, usage_limit_per_hour}`. Sempre
  existe; `enabled` é falso sem `GEMINI_API_KEY`, e as demais rotas só são registradas com a IA
  ativa;
- `POST /api/v1/ai/scenario-from-text` `{text}` → cenário, carga e entrega propostos (a pessoa
  revisa antes de aplicar);
- `POST /api/v1/ai/explain-recommendation` `{recommendation, context?}` → texto explicativo;
- `POST /api/v1/ai/lift-report` `{evaluation, load, crane_label?, scenario?, note?}` → relatório em
  Markdown. O backend refaz a avaliação do estado enviado (RN-008): os números do relatório são os
  do cálculo, não os que o cliente diz;
- `POST /api/v1/ai/review-recording` `{recording_id}` → revisão da gravação em Markdown.

A IA nunca decide capacidade, utilização nem segurança: só recebe números já calculados e os
explica. Autorização igual à da avaliação (ADR-016): com banco, qualquer perfil logado; o CSRF vale
nos `POST`. Cada chamada conta no limite de uso por usuário (padrão: 20 por hora).

Erros (`{"detail", "code"}`): 422 `AI_INPUT_INVALID` e `AI_REJECTED`; 429 `AI_RATE_LIMITED`;
502 `AI_BAD_OUTPUT`; 503 `AI_UNAVAILABLE`; 504 `AI_TIMEOUT`. As mensagens são para a pessoa e nunca
trazem a chave nem texto do provedor.
"""

from collections.abc import Callable
from enum import StrEnum
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field

from app.application.ports.llm_provider import LlmError, LlmErrorKind
from app.application.ports.simulation_recording_repository import SimulationRecordingRepository
from app.application.use_cases.ai_assistant import (
    MAX_TEXT_CHARS,
    AiAssistant,
    AiInputError,
    AiOutputError,
    AiRateLimitedError,
    LiftReportInput,
    ScenarioDraft,
)
from app.application.use_cases.evaluate_operation import EvaluateOperation, OperationEvaluation
from app.application.use_cases.manage_simulation_recordings import (
    ManageSimulationRecordings,
    RecordingNotFoundError,
)
from app.domain.entities.scenario import scenario_spec_to_dict
from app.domain.entities.user import User
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState
from app.presentation.api.authorization import (
    SESSION_REQUIRED_RESPONSES,
    ApiError,
    AuthGuards,
    error_responses,
)
from app.presentation.api.evaluation_schemas import (
    EvaluationRequest,
    EvaluationResponse,
    to_soil_kinds,
)
from app.presentation.api.evaluations import EvaluateOperationDependency
from app.presentation.api.scenario_schemas import ScenarioSpecPayload

AI_PATH = "/api/v1/ai"
ANONYMOUS_KEY = "anonymous"


class AiErrorCode(StrEnum):
    AI_INPUT_INVALID = "AI_INPUT_INVALID"
    AI_REJECTED = "AI_REJECTED"
    AI_RATE_LIMITED = "AI_RATE_LIMITED"
    AI_BAD_OUTPUT = "AI_BAD_OUTPUT"
    AI_UNAVAILABLE = "AI_UNAVAILABLE"
    AI_TIMEOUT = "AI_TIMEOUT"
    RECORDING_NOT_FOUND = "RECORDING_NOT_FOUND"


_AI_ERRORS = error_responses(
    (status.HTTP_422_UNPROCESSABLE_CONTENT, "`AI_INPUT_INVALID` ou `AI_REJECTED`."),
    (status.HTTP_429_TOO_MANY_REQUESTS, "`AI_RATE_LIMITED`: limite de usos por hora."),
    (status.HTTP_502_BAD_GATEWAY, "`AI_BAD_OUTPUT`: a IA devolveu algo inutilizável."),
    (status.HTTP_503_SERVICE_UNAVAILABLE, "`AI_UNAVAILABLE`: serviço de IA sobrecarregado."),
    (status.HTTP_504_GATEWAY_TIMEOUT, "`AI_TIMEOUT`: o serviço de IA não respondeu a tempo."),
)

_STRICT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")


class AiStatusResponse(BaseModel):
    enabled: bool = Field(description="A IA está configurada neste ambiente.")
    model: str | None = Field(description="Modelo padrão; `null` com a IA desligada.")
    fallback_models: list[str] = Field(description="Modelos reserva, na ordem de uso.")
    usage_limit_per_hour: int | None = Field(description="Usos por hora por usuário.")


class ModelInfo(BaseModel):
    model: str = Field(description="Modelo que respondeu de fato.")
    fallback_used: bool = Field(description="Respondeu um modelo reserva, não o padrão.")


class ScenarioFromTextRequest(BaseModel):
    model_config = _STRICT

    text: str = Field(
        max_length=20 * MAX_TEXT_CHARS,
        description=f"Descrição da operação, em linguagem natural (até {MAX_TEXT_CHARS} "
        "caracteres).",
    )


class LoadDraftResponse(BaseModel):
    description: str
    weight_kg: float
    length_m: float
    width_m: float
    height_m: float


class ScenarioFromTextResponse(ModelInfo):
    summary: str = Field(description="O que a IA entendeu e montou, em pt-BR.")
    assumptions: list[str] = Field(description="Suposições feitas (medidas e posições estimadas).")
    load: LoadDraftResponse
    scenario: ScenarioSpecPayload = Field(
        description="Cenário já validado, com `cargo` (posição inicial) e `delivery`."
    )

    @classmethod
    def from_draft(cls, draft: ScenarioDraft) -> ScenarioFromTextResponse:
        return cls(
            model=draft.completion.model,
            fallback_used=draft.completion.fallback_used,
            summary=draft.summary,
            assumptions=list(draft.assumptions),
            load=LoadDraftResponse(
                description=draft.load.description,
                weight_kg=draft.load.weight_kg,
                length_m=draft.load.length_m,
                width_m=draft.load.width_m,
                height_m=draft.load.height_m,
            ),
            scenario=ScenarioSpecPayload.from_domain(draft.spec),
        )


class ExplainRecommendationRequest(BaseModel):
    recommendation: dict[str, Any] = Field(
        description="Recomendação do planejador (`POST /planning/recommend`), como foi calculada."
    )
    context: dict[str, Any] | None = Field(
        default=None, description="Contexto opcional: carga, origem e destino."
    )


class AiTextResponse(ModelInfo):
    text: str = Field(description="Texto em Markdown, em pt-BR.")


class LiftReportLoad(BaseModel):
    model_config = _STRICT

    description: str = Field(min_length=1, max_length=120)
    length_m: float = Field(gt=0)
    width_m: float = Field(gt=0)
    height_m: float = Field(gt=0)


class LiftReportRequest(BaseModel):
    model_config = _STRICT

    evaluation: EvaluationRequest = Field(
        description="Estado da operação; o backend o avalia de novo para o relatório."
    )
    load: LiftReportLoad
    crane_label: str | None = Field(
        default=None, max_length=200, description="Nome do guindaste, como aparece na tela."
    )
    scenario: ScenarioSpecPayload | None = None
    note: str | None = Field(default=None, max_length=2000, description="Observação da pessoa.")


class LiftReportResponse(ModelInfo):
    markdown: str = Field(description="Relatório completo em Markdown.")
    evaluation: EvaluationResponse = Field(description="Avaliação usada nos números do relatório.")


class ReviewRecordingRequest(BaseModel):
    model_config = _STRICT

    recording_id: str = Field(min_length=1, max_length=64)


class MarkdownResponse(ModelInfo):
    markdown: str


def _translate(error: Exception) -> ApiError:
    if isinstance(error, AiInputError):
        return ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, AiErrorCode.AI_INPUT_INVALID, str(error)
        )
    if isinstance(error, AiRateLimitedError):
        return ApiError(status.HTTP_429_TOO_MANY_REQUESTS, AiErrorCode.AI_RATE_LIMITED, str(error))
    if isinstance(error, AiOutputError):
        return ApiError(status.HTTP_502_BAD_GATEWAY, AiErrorCode.AI_BAD_OUTPUT, str(error))
    assert isinstance(error, LlmError)
    match error.kind:
        case LlmErrorKind.TIMEOUT:
            return ApiError(status.HTTP_504_GATEWAY_TIMEOUT, AiErrorCode.AI_TIMEOUT, error.message)
        case LlmErrorKind.REJECTED:
            return ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT, AiErrorCode.AI_REJECTED, error.message
            )
        case LlmErrorKind.BAD_RESPONSE:
            return ApiError(status.HTTP_502_BAD_GATEWAY, AiErrorCode.AI_BAD_OUTPUT, error.message)
        case LlmErrorKind.UNAVAILABLE | LlmErrorKind.RATE_LIMITED:
            return ApiError(
                status.HTTP_503_SERVICE_UNAVAILABLE, AiErrorCode.AI_UNAVAILABLE, error.message
            )


def _call[T](action: Callable[[], T]) -> T:
    try:
        return action()
    except (AiInputError, AiRateLimitedError, AiOutputError, LlmError) as error:
        raise _translate(error) from None


def create_ai_router(
    assistant: AiAssistant | None,
    *,
    guards: AuthGuards | None = None,
    evaluation: EvaluateOperationDependency | None = None,
    recordings: SimulationRecordingRepository | None = None,
) -> APIRouter:
    """Monta as rotas da IA. Sem `assistant`, só `GET /ai/status`, com `enabled: false`.

    `evaluation` é a dependência do caso de uso da avaliação (o relatório avalia de novo);
    `recordings` guarda as gravações (a revisão); sem eles, essas duas rotas não existem.
    """
    router = APIRouter(prefix=AI_PATH, tags=["ai"], responses=SESSION_REQUIRED_RESPONSES)

    def user_key_for_anonymous() -> str:
        return ANONYMOUS_KEY

    if guards is None:
        user_key: Callable[..., str] = user_key_for_anonymous
    else:
        current_user = guards.current_user

        def user_key_for_user(user: Annotated[User, Depends(current_user)]) -> str:
            return user.id

        user_key = user_key_for_user
    UserKey = Annotated[str, Depends(user_key)]

    @router.get("/status", summary="Dizer se o assistente de IA está ativo")
    def ai_status() -> AiStatusResponse:
        if assistant is None:
            return AiStatusResponse(
                enabled=False, model=None, fallback_models=[], usage_limit_per_hour=None
            )
        return AiStatusResponse(
            enabled=True,
            model=assistant.model,
            fallback_models=list(assistant.fallback_models),
            usage_limit_per_hour=assistant.usage_limit_per_hour,
        )

    if assistant is None:
        return router
    ai = assistant

    @router.post(
        "/scenario-from-text",
        summary="Montar cenário, carga e entrega a partir de uma descrição em texto",
        description=(
            "A IA devolve JSON estruturado, convertido no mesmo `ScenarioSpec` validado dos "
            "cenários salvos. Nada é gravado: a pessoa revisa e aplica no simulador."
        ),
        responses=_AI_ERRORS,
    )
    def scenario_from_text(body: ScenarioFromTextRequest, key: UserKey) -> ScenarioFromTextResponse:
        return ScenarioFromTextResponse.from_draft(
            _call(lambda: ai.scenario_from_text(key, body.text))
        )

    @router.post(
        "/explain-recommendation",
        summary="Explicar a recomendação do planejador",
        description=(
            "A IA só explica os números recebidos; capacidade, utilização e risco são do cálculo."
        ),
        responses=_AI_ERRORS,
    )
    def explain_recommendation(body: ExplainRecommendationRequest, key: UserKey) -> AiTextResponse:
        result = _call(lambda: ai.explain_recommendation(key, body.recommendation, body.context))
        return AiTextResponse(
            text=result.text,
            model=result.completion.model,
            fallback_used=result.completion.fallback_used,
        )

    if evaluation is not None:

        @router.post(
            "/lift-report",
            summary="Gerar o relatório de içamento",
            description=(
                "O backend avalia o estado enviado (RN-008) e monta a tabela de números por "
                "código; a IA escreve só o texto descritivo."
            ),
            responses=_AI_ERRORS,
        )
        def lift_report(
            body: LiftReportRequest,
            key: UserKey,
            use_case: Annotated[EvaluateOperation, Depends(evaluation)],
        ) -> LiftReportResponse:
            result = _evaluate(use_case, body.evaluation)
            response = EvaluationResponse.from_evaluation(body.evaluation.configuration_id, result)
            report = LiftReportInput(
                evaluation=response.model_dump(mode="json"),
                state=body.evaluation.model_dump(mode="json"),
                load={
                    "description": body.load.description,
                    "length_m": body.load.length_m,
                    "width_m": body.load.width_m,
                    "height_m": body.load.height_m,
                },
                crane_label=body.crane_label,
                scenario=(
                    None
                    if body.scenario is None
                    else scenario_spec_to_dict(body.scenario.to_domain())
                ),
                note=body.note,
            )
            text = _call(lambda: ai.lift_report(key, report))
            return LiftReportResponse(
                markdown=text.text,
                model=text.completion.model,
                fallback_used=text.completion.fallback_used,
                evaluation=response,
            )

    if recordings is not None:
        manage_recordings = ManageSimulationRecordings(recordings)

        @router.post(
            "/review-recording",
            summary="Revisar uma gravação de simulação",
            description="Indicadores calculados por código; a IA comenta e sugere melhorias.",
            responses={
                **_AI_ERRORS,
                **error_responses((status.HTTP_404_NOT_FOUND, "`RECORDING_NOT_FOUND`.")),
            },
        )
        def review_recording(body: ReviewRecordingRequest, key: UserKey) -> MarkdownResponse:
            try:
                recording = manage_recordings.get_recording(body.recording_id)
            except RecordingNotFoundError as error:
                raise ApiError(
                    status.HTTP_404_NOT_FOUND, AiErrorCode.RECORDING_NOT_FOUND, str(error)
                ) from None
            result = _call(lambda: ai.review_recording(key, recording))
            return MarkdownResponse(
                markdown=result.text,
                model=result.completion.model,
                fallback_used=result.completion.fallback_used,
            )

    return router


def _evaluate(use_case: EvaluateOperation, request: EvaluationRequest) -> OperationEvaluation:
    state = OperationalState(
        boom_length=Length(request.boom_length_m),
        boom_angle=Angle(request.boom_angle_deg),
        turret_rotation=Angle(request.turret_rotation_deg),
        cable_length=Length(request.cable_length_m),
    )
    return use_case.execute(
        configuration_id=request.configuration_id,
        state=state,
        load_weight=Mass(request.load_weight_kg),
        outriggers=None if request.outriggers is None else request.outriggers.to_setting(),
        ground_slope_deg=request.ground_slope_deg,
        accessory_ids=request.accessory_ids,
        soil_kinds=to_soil_kinds(request.soil_kinds),
        wind_speed_ms=request.wind_speed_ms,
        obstacle_conflicts=request.obstacle_conflicts,
    )
