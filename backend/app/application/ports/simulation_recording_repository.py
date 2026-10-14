"""Porta de gravação e consulta das gravações de simulação (ADR-027; TASK-057)."""

from typing import Protocol

from app.domain.entities.simulation_recording import (
    SimulationRecording,
    SimulationRecordingSummary,
)


class RecordingNotFoundError(Exception):
    """Não existe gravação com esse id."""

    def __init__(self, recording_id: str) -> None:
        self.recording_id = recording_id
        super().__init__(f"gravação com id {recording_id!r} não existe")


class SimulationRecordingRepository(Protocol):
    def add(self, recording: SimulationRecording) -> None: ...

    def get(self, recording_id: str) -> SimulationRecording | None:
        """Gravação completa, ou `None` se não existe."""
        ...

    def get_summary(self, recording_id: str) -> SimulationRecordingSummary | None:
        """Só o resumo (sem ler os quadros), ou `None` se não existe."""
        ...

    def list_summaries(self) -> list[SimulationRecordingSummary]:
        """Resumos, do mais recente ao mais antigo; sem ler os quadros."""
        ...

    def delete(self, recording_id: str) -> bool:
        """Apaga a gravação; `False` se ela não existia."""
        ...
