"""Dublê em memória e dados FICTÍCIOS das gravações de simulação (TASK-057; ADR-027)."""

from typing import Any

from app.domain.entities.simulation_recording import (
    SimulationRecording,
    SimulationRecordingSummary,
)


class InMemorySimulationRecordingRepository:
    def __init__(self) -> None:
        self.recordings: dict[str, SimulationRecording] = {}

    def add(self, recording: SimulationRecording) -> None:
        self.recordings[recording.summary.id] = recording

    def get(self, recording_id: str) -> SimulationRecording | None:
        return self.recordings.get(recording_id)

    def get_summary(self, recording_id: str) -> SimulationRecordingSummary | None:
        recording = self.recordings.get(recording_id)
        return None if recording is None else recording.summary

    def list_summaries(self) -> list[SimulationRecordingSummary]:
        return sorted(
            (r.summary for r in self.recordings.values()),
            key=lambda s: s.created_at,
            reverse=True,
        )

    def delete(self, recording_id: str) -> bool:
        return self.recordings.pop(recording_id, None) is not None


def frames_ficticios(count: int = 3) -> list[dict[str, Any]]:
    """Quadros no formato do frontend; só os campos obrigatórios e um opcional (alertas)."""
    return [
        {
            "tMs": index * 100,
            "crane": {
                "turretRotationDeg": index,
                "boomAngleDeg": 45,
                "boomLengthM": 12,
                "cableLengthM": 5,
            },
            "configurationId": "CFG-FICTICIA",
            "loadWeightKg": 1000,
            "evaluation": {
                "kind": "EVALUATED",
                "loadChartId": "LC-FICTICIA",
                "loadChartVersion": "v1",
                "alerts": [] if index == 0 else [{"code": "ALERTA_FICTICIO", "severity": "INFO"}],
            },
        }
        for index in range(count)
    ]


def new_recording_body(**changes: object) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Içamento FICTÍCIO",
        "configuration_id": "CFG-FICTICIA",
        "duration_ms": 200,
        "load_chart_refs": [{"load_chart_id": "LC-FICTICIA", "version": "v1"}],
        "scenario": None,
        "frames": frames_ficticios(),
    }
    body.update(changes)
    return body
