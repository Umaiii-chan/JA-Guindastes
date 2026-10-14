"""Gravações de simulação: listar, abrir, criar e apagar (ADR-027; TASK-057; RN-005).

- Listar e abrir: qualquer usuário logado.
- Criar: qualquer usuário logado; o autor é quem chama.
- Apagar: só o autor ou um admin (ADR-016).
- Limites PROVISÓRIOS: duração e tamanho (`MAX_RECORDING_DURATION_MS`, `MAX_RECORDING_BYTES`). O
  tamanho é o do JSON dos quadros e do cenário, antes da compressão do armazenamento.
"""

import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from app.application.ports.simulation_recording_repository import (
    RecordingNotFoundError,
    SimulationRecordingRepository,
)
from app.application.use_cases.authentication import Clock, utc_now
from app.application.use_cases.crane_catalog import IdGenerator, generate_uuid_id
from app.domain.entities.simulation_recording import (
    MAX_RECORDING_BYTES,
    MAX_RECORDING_DURATION_MS,
    LoadChartRef,
    SimulationRecording,
    SimulationRecordingSummary,
    normalize_recording_name,
)
from app.domain.entities.user import User, UserRole
from app.domain.exceptions.recording_errors import (
    InvalidRecordingError,
    RecordingTooLargeError,
    RecordingTooLongError,
)

__all__ = [
    "ManageSimulationRecordings",
    "NewRecording",
    "RecordingForbiddenError",
    "RecordingNotFoundError",
]


class RecordingForbiddenError(Exception):
    """Só o autor ou um admin apaga uma gravação."""

    def __init__(self) -> None:
        super().__init__("só o autor da gravação ou um admin pode apagá-la")


@dataclass(frozen=True)
class NewRecording:
    """Dados de uma gravação nova, como chegam da apresentação."""

    name: str
    configuration_id: str
    duration_ms: int
    load_chart_refs: Sequence[tuple[str, str]]
    scenario: dict[str, Any] | None
    frames: list[dict[str, Any]]


def content_size_bytes(scenario: dict[str, Any] | None, frames: list[dict[str, Any]]) -> int:
    """Tamanho, em bytes UTF-8, do JSON dos quadros e do cenário."""
    return len(json.dumps(frames, separators=(",", ":")).encode()) + len(
        json.dumps(scenario, separators=(",", ":")).encode()
    )


class ManageSimulationRecordings:
    def __init__(
        self,
        recordings: SimulationRecordingRepository,
        *,
        clock: Clock = utc_now,
        id_generator: IdGenerator = generate_uuid_id,
    ) -> None:
        self._recordings = recordings
        self._clock = clock
        self._id_generator = id_generator

    def list_recordings(self) -> list[SimulationRecordingSummary]:
        return self._recordings.list_summaries()

    def get_recording(self, recording_id: str) -> SimulationRecording:
        recording = self._recordings.get(recording_id)
        if recording is None:
            raise RecordingNotFoundError(recording_id)
        return recording

    def create_recording(self, author: User, new: NewRecording) -> SimulationRecording:
        """Valida e grava.

        Erros: `InvalidRecordingError`, `RecordingTooLongError` e `RecordingTooLargeError`.
        """
        name = normalize_recording_name(new.name)
        if not new.configuration_id.strip():
            raise InvalidRecordingError("configuration_id", "a configuração é obrigatória")
        if new.duration_ms < 0:
            raise InvalidRecordingError("duration_ms", "a duração não pode ser negativa")
        if new.duration_ms > MAX_RECORDING_DURATION_MS:
            raise RecordingTooLongError(
                f"a gravação passa do limite de {MAX_RECORDING_DURATION_MS // 60_000} minutos"
            )
        if not new.frames:
            raise InvalidRecordingError("frames", "a gravação precisa de pelo menos um quadro")
        if content_size_bytes(new.scenario, new.frames) > MAX_RECORDING_BYTES:
            raise RecordingTooLargeError(
                f"a gravação passa do limite de {MAX_RECORDING_BYTES // (1024 * 1024)} MB"
            )
        refs = tuple(LoadChartRef(chart_id, version) for chart_id, version in new.load_chart_refs)
        recording = SimulationRecording(
            summary=SimulationRecordingSummary(
                id=self._id_generator(),
                name=name,
                author_user_id=author.id,
                author_display_name=author.display_name,
                created_at=self._clock(),
                duration_ms=new.duration_ms,
                configuration_id=new.configuration_id.strip(),
                load_chart_refs=refs,
                frame_count=len(new.frames),
            ),
            scenario=new.scenario,
            frames=new.frames,
        )
        self._recordings.add(recording)
        return recording

    def delete_recording(self, actor: User, recording_id: str) -> None:
        summary = self._recordings.get_summary(recording_id)
        if summary is None:
            raise RecordingNotFoundError(recording_id)
        if actor.id != summary.author_user_id and actor.role is not UserRole.ADMIN:
            raise RecordingForbiddenError
        if not self._recordings.delete(recording_id):
            raise RecordingNotFoundError(recording_id)
