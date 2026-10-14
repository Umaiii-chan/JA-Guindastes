"""Dublês e dados FICTÍCIOS do assistente de IA (TASK-076; ADR-039). Nenhum teste chama a rede."""

import json
from collections.abc import Sequence
from typing import Any

from app.application.ports.ai_usage_limiter import UsageDecision
from app.application.ports.llm_provider import (
    LlmCompletion,
    LlmError,
    LlmRequest,
)

CHAVE_FICTICIA = "chave-ficticia-nao-e-segredo-123"


class FakeLlmProvider:
    """Responde, na ordem, o que foi enfileirado: texto (sucesso) ou `LlmError` (falha)."""

    def __init__(
        self,
        replies: Sequence[str | LlmError] = (),
        *,
        model: str = "modelo-ficticio",
        fallback_models: tuple[str, ...] = ("reserva-ficticia",),
    ) -> None:
        self.replies = list(replies)
        self._model = model
        self._fallbacks = fallback_models
        self.requests: list[LlmRequest] = []

    @property
    def model(self) -> str:
        return self._model

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return self._fallbacks

    def generate(self, request: LlmRequest) -> LlmCompletion:
        self.requests.append(request)
        reply = self.replies.pop(0) if self.replies else "Texto FICTÍCIO da IA."
        if isinstance(reply, LlmError):
            raise reply
        return LlmCompletion(text=reply, model=self._model)


class FakeUsageLimiter:
    def __init__(self, limit: int = 20, allowed_calls: int | None = None) -> None:
        self._limit = limit
        self._allowed = allowed_calls
        self.keys: list[str] = []

    @property
    def limit(self) -> int:
        return self._limit

    def acquire(self, key: str) -> UsageDecision:
        self.keys.append(key)
        if self._allowed is not None and len(self.keys) > self._allowed:
            self.keys.pop()
            return UsageDecision(allowed=False, remaining=0, retry_after_seconds=1800)
        return UsageDecision(allowed=True, remaining=self._limit, retry_after_seconds=0)


def scenario_ia_json(**changes: Any) -> dict[str, Any]:
    """Resposta FICTÍCIA do modelo para "içar uma viga de 8 t de dentro do barracão"."""
    data: dict[str, Any] = {
        "summary": "Içamento de uma viga de 8 t de dentro de um barracão até uma carreta.",
        "load": {
            "description": "Viga FICTÍCIA",
            "weight_kg": 8000,
            "length_m": 6,
            "width_m": 0.4,
            "height_m": 0.6,
        },
        "pick": {"x": 12, "z": 0, "rotation_y_deg": 0},
        "delivery": {"x": -8, "z": 0, "rotation_y_deg": 90, "radius_m": 3},
        "crane": {"x": 0, "z": 0, "heading_deg": 0},
        "obstacles": [
            {
                "label": "Parede lateral",
                "kind": "box",
                "center_x": 12,
                "center_z": 4,
                "width_m": 8,
                "depth_m": 0.3,
                "height_m": 6,
                "rotation_y_deg": 0,
            },
            {
                "label": "Carreta",
                "kind": "box",
                "center_x": -8,
                "center_z": 0,
                "width_m": 2.5,
                "depth_m": 12,
                "height_m": 1.5,
                "rotation_y_deg": 0,
            },
        ],
        "slope_x_percent": 0,
        "slope_z_percent": 0,
        "wind_speed_ms": None,
        "wind_direction_deg": None,
        "soil_kind": None,
        "assumptions": ["Largura e altura da viga estimadas."],
    }
    data.update(changes)
    return data


def scenario_ia_reply(**changes: Any) -> str:
    return json.dumps(scenario_ia_json(**changes))
