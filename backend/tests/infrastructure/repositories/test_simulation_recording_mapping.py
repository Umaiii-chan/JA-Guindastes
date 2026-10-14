"""Mapeamento `SimulationRecording` ↔ modelo e compressão dos quadros, sem banco (TASK-057)."""

import gzip
from datetime import UTC, datetime

from app.domain.entities.simulation_recording import (
    LoadChartRef,
    SimulationRecording,
    SimulationRecordingSummary,
)
from app.infrastructure.repositories.sqlalchemy_simulation_recording_repository import (
    compress_frames,
    decompress_frames,
    recording_from_model,
    recording_to_model,
    summary_from_model,
)
from tests.fixtures.simulation_recording_fakes import frames_ficticios


def recording_ficticia() -> SimulationRecording:
    frames = frames_ficticios(50)
    return SimulationRecording(
        summary=SimulationRecordingSummary(
            id="rec-1",
            name="Gravação FICTÍCIA",
            author_user_id="user-1",
            author_display_name="Autor FICTÍCIO",
            created_at=datetime(2026, 10, 14, 12, 0, tzinfo=UTC),
            duration_ms=4900,
            configuration_id="CFG-FICTICIA",
            load_chart_refs=(LoadChartRef("LC-FICTICIA", "v1"),),
            frame_count=len(frames),
        ),
        scenario={"terrain": {"slopeXPercent": 2}},
        frames=frames,
    )


def test_recording_round_trips_through_the_model() -> None:
    recording = recording_ficticia()

    model = recording_to_model(recording)

    assert model.load_chart_refs == [{"load_chart_id": "LC-FICTICIA", "version": "v1"}]
    assert recording_from_model(model) == recording
    assert summary_from_model(model) == recording.summary


def test_frames_are_stored_as_compressed_json() -> None:
    frames = frames_ficticios(200)

    data = compress_frames(frames)

    assert data[:2] == b"\x1f\x8b"  # cabeçalho gzip
    assert len(data) < len(gzip.decompress(data)) / 3
    assert decompress_frames(data) == frames
