"""Gravações de simulação `/api/v1/simulations*` (ADR-027; TASK-057; RN-005; ADR-016).

- `GET /api/v1/simulations` → 200 `{items: SimulationSummary[]}`, do mais recente ao mais antigo
  (qualquer usuário logado);
- `GET /api/v1/simulations/{id}` → 200 `SimulationRecording` (resumo + `scenario` + `frames`);
  404 `RECORDING_NOT_FOUND` (qualquer usuário logado);
- `POST /api/v1/simulations` → 201 `SimulationRecording`; 413 `RECORDING_TOO_LARGE` (5 MB,
  PROVISÓRIO); 422 `RECORDING_TOO_LONG` (10 min, PROVISÓRIO) ou validação (qualquer usuário
  logado; o autor é quem chama);
- `DELETE /api/v1/simulations/{id}` → 204; 403 `FORBIDDEN` (nem autor nem admin);
  404 `RECORDING_NOT_FOUND`.

Os quadros e o cenário são JSON que o backend guarda sem interpretar (campos opcionais das outras
tarefas da leva E podem faltar). Só existem com banco e autenticação (ADR-016 § 5).
"""

from collections.abc import Callable
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

from app.application.ports.simulation_recording_repository import SimulationRecordingRepository
from app.application.use_cases.manage_simulation_recordings import (
    ManageSimulationRecordings,
    NewRecording,
    RecordingForbiddenError,
    RecordingNotFoundError,
)
from app.domain.entities.simulation_recording import (
    NAME_MAX_LENGTH,
    SimulationRecording,
    SimulationRecordingSummary,
)
from app.domain.entities.user import User
from app.domain.exceptions.recording_errors import (
    InvalidRecordingError,
    RecordingTooLargeError,
    RecordingTooLongError,
)
from app.presentation.api.authorization import (
    SESSION_REQUIRED_RESPONSES,
    ApiError,
    AuthDependencies,
    AuthErrorCode,
    AuthGuards,
    error_responses,
)

SIMULATIONS_PATH = "/api/v1/simulations"


class RecordingErrorCode(StrEnum):
    RECORDING_NOT_FOUND = "RECORDING_NOT_FOUND"
    RECORDING_TOO_LONG = "RECORDING_TOO_LONG"
    RECORDING_TOO_LARGE = "RECORDING_TOO_LARGE"


class LoadChartRefSchema(BaseModel):
    load_chart_id: str = Field(min_length=1, description="Id da tabela de carga usada (RN-005).")
    version: str = Field(min_length=1, description="Versão da tabela de carga usada (RN-005).")


class SimulationCreateRequest(BaseModel):
    name: str = Field(max_length=NAME_MAX_LENGTH, description="Nome da gravação.")
    configuration_id: str = Field(description="Configuração do guindaste gravada.")
    duration_ms: int = Field(ge=0, description="Duração da gravação, em milissegundos.")
    load_chart_refs: list[LoadChartRefSchema] = Field(
        default_factory=list, description="Tabelas de carga (id e versão) usadas (RN-005)."
    )
    scenario: dict[str, Any] | None = Field(
        default=None, description="Cópia do cenário (ScenarioSpec); ausente até a TASK-052."
    )
    frames: list[dict[str, Any]] = Field(
        description="Quadros gravados, como o frontend os escreveu (JSON opaco para o backend)."
    )


class SimulationSummaryResponse(BaseModel):
    id: str
    name: str
    author_user_id: str
    author_display_name: str
    created_at: datetime
    duration_ms: int
    configuration_id: str
    load_chart_refs: list[LoadChartRefSchema]
    frame_count: int

    @classmethod
    def from_summary(cls, summary: SimulationRecordingSummary) -> SimulationSummaryResponse:
        return cls(
            id=summary.id,
            name=summary.name,
            author_user_id=summary.author_user_id,
            author_display_name=summary.author_display_name,
            created_at=summary.created_at,
            duration_ms=summary.duration_ms,
            configuration_id=summary.configuration_id,
            load_chart_refs=[
                LoadChartRefSchema(load_chart_id=ref.load_chart_id, version=ref.version)
                for ref in summary.load_chart_refs
            ],
            frame_count=summary.frame_count,
        )


class SimulationRecordingResponse(SimulationSummaryResponse):
    scenario: dict[str, Any] | None
    frames: list[dict[str, Any]]

    @classmethod
    def from_recording(cls, recording: SimulationRecording) -> SimulationRecordingResponse:
        base = SimulationSummaryResponse.from_summary(recording.summary)
        return cls(**base.model_dump(), scenario=recording.scenario, frames=recording.frames)


class SimulationListResponse(BaseModel):
    items: list[SimulationSummaryResponse]


def _call[T](action: Callable[[], T]) -> T:
    """Roda o caso de uso e traduz os erros para respostas HTTP."""
    try:
        return action()
    except InvalidRecordingError as error:
        raise RequestValidationError(
            [{"loc": ("body", error.field), "msg": str(error), "type": "value_error"}]
        ) from None
    except RecordingTooLongError as error:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT, RecordingErrorCode.RECORDING_TOO_LONG, str(error)
        ) from None
    except RecordingTooLargeError as error:
        raise ApiError(
            status.HTTP_413_CONTENT_TOO_LARGE, RecordingErrorCode.RECORDING_TOO_LARGE, str(error)
        ) from None
    except RecordingNotFoundError as error:
        raise ApiError(
            status.HTTP_404_NOT_FOUND, RecordingErrorCode.RECORDING_NOT_FOUND, str(error)
        ) from None
    except RecordingForbiddenError as error:
        raise ApiError(status.HTTP_403_FORBIDDEN, AuthErrorCode.FORBIDDEN, str(error)) from None


def create_simulations_router(
    recordings: SimulationRecordingRepository, deps: AuthDependencies, guards: AuthGuards
) -> APIRouter:
    manage = ManageSimulationRecordings(
        recordings, clock=deps.clock, id_generator=deps.id_generator
    )
    router = APIRouter(
        prefix=SIMULATIONS_PATH, tags=["simulations"], responses=SESSION_REQUIRED_RESPONSES
    )
    Logged = Annotated[User, Depends(guards.current_user)]
    not_found = error_responses((status.HTTP_404_NOT_FOUND, "`RECORDING_NOT_FOUND`."))

    @router.get("", summary="Listar gravações de simulação")
    def list_recordings(_: Logged) -> SimulationListResponse:
        return SimulationListResponse(
            items=[SimulationSummaryResponse.from_summary(s) for s in manage.list_recordings()]
        )

    @router.get("/{recording_id}", summary="Abrir uma gravação", responses=not_found)
    def get_recording(recording_id: str, _: Logged) -> SimulationRecordingResponse:
        return SimulationRecordingResponse.from_recording(
            _call(lambda: manage.get_recording(recording_id))
        )

    @router.post(
        "",
        status_code=status.HTTP_201_CREATED,
        summary="Salvar uma gravação (o autor é quem chama)",
        description=(
            "Limites PROVISÓRIOS (ADR-027): 10 minutos de duração e 5 MB de conteúdo (JSON dos "
            "quadros e do cenário, antes da compressão)."
        ),
        responses=error_responses(
            (status.HTTP_413_CONTENT_TOO_LARGE, "`RECORDING_TOO_LARGE`."),
            (status.HTTP_422_UNPROCESSABLE_CONTENT, "`RECORDING_TOO_LONG` ou validação."),
        ),
    )
    def create_recording(
        body: SimulationCreateRequest, author: Logged
    ) -> SimulationRecordingResponse:
        new = NewRecording(
            name=body.name,
            configuration_id=body.configuration_id,
            duration_ms=body.duration_ms,
            load_chart_refs=[(ref.load_chart_id, ref.version) for ref in body.load_chart_refs],
            scenario=body.scenario,
            frames=body.frames,
        )
        return SimulationRecordingResponse.from_recording(
            _call(lambda: manage.create_recording(author, new))
        )

    @router.delete(
        "/{recording_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Apagar uma gravação (só o autor ou um admin)",
        responses=not_found,
    )
    def delete_recording(recording_id: str, actor: Logged) -> Response:
        _call(lambda: manage.delete_recording(actor, recording_id))
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router
