"""Gravações de simulação no PostgreSQL via SQLAlchemy (ADR-027; TASK-057).

Implementa `SimulationRecordingRepository`. Os quadros são gravados como JSON comprimido com gzip
(`compress_frames` / `decompress_frames`). A lista e o resumo não leem a coluna dos quadros.
"""

import gzip
import json
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, defer, sessionmaker

from app.domain.entities.simulation_recording import (
    LoadChartRef,
    SimulationRecording,
    SimulationRecordingSummary,
)
from app.infrastructure.database.models.simulation_recording import SimulationRecordingModel


def compress_frames(frames: list[dict[str, Any]]) -> bytes:
    return gzip.compress(json.dumps(frames, separators=(",", ":")).encode(), mtime=0)


def decompress_frames(data: bytes) -> list[dict[str, Any]]:
    frames: list[dict[str, Any]] = json.loads(gzip.decompress(data).decode())
    return frames


def summary_from_model(model: SimulationRecordingModel) -> SimulationRecordingSummary:
    return SimulationRecordingSummary(
        id=model.id,
        name=model.name,
        author_user_id=model.author_user_id,
        author_display_name=model.author_display_name,
        created_at=model.created_at,
        duration_ms=model.duration_ms,
        configuration_id=model.configuration_id,
        load_chart_refs=tuple(
            LoadChartRef(ref["load_chart_id"], ref["version"]) for ref in model.load_chart_refs
        ),
        frame_count=model.frame_count,
    )


def recording_to_model(recording: SimulationRecording) -> SimulationRecordingModel:
    summary = recording.summary
    return SimulationRecordingModel(
        id=summary.id,
        name=summary.name,
        author_user_id=summary.author_user_id,
        author_display_name=summary.author_display_name,
        created_at=summary.created_at,
        duration_ms=summary.duration_ms,
        configuration_id=summary.configuration_id,
        load_chart_refs=[
            {"load_chart_id": ref.load_chart_id, "version": ref.version}
            for ref in summary.load_chart_refs
        ],
        frame_count=summary.frame_count,
        scenario=recording.scenario,
        frames_gzip=compress_frames(recording.frames),
    )


def recording_from_model(model: SimulationRecordingModel) -> SimulationRecording:
    return SimulationRecording(
        summary=summary_from_model(model),
        scenario=model.scenario,
        frames=decompress_frames(model.frames_gzip),
    )


class SqlAlchemySimulationRecordingRepository:
    """Implementa `SimulationRecordingRepository`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add(self, recording: SimulationRecording) -> None:
        with self._session_factory.begin() as session:
            session.add(recording_to_model(recording))

    def get(self, recording_id: str) -> SimulationRecording | None:
        with self._session_factory() as session:
            model = session.get(SimulationRecordingModel, recording_id)
            return None if model is None else recording_from_model(model)

    def get_summary(self, recording_id: str) -> SimulationRecordingSummary | None:
        statement = (
            select(SimulationRecordingModel)
            .options(defer(SimulationRecordingModel.frames_gzip))
            .where(SimulationRecordingModel.id == recording_id)
        )
        with self._session_factory() as session:
            model = session.scalars(statement).one_or_none()
            return None if model is None else summary_from_model(model)

    def list_summaries(self) -> list[SimulationRecordingSummary]:
        statement = (
            select(SimulationRecordingModel)
            .options(defer(SimulationRecordingModel.frames_gzip))
            .order_by(SimulationRecordingModel.created_at.desc(), SimulationRecordingModel.id)
        )
        with self._session_factory() as session:
            return [summary_from_model(model) for model in session.scalars(statement)]

    def delete(self, recording_id: str) -> bool:
        with self._session_factory.begin() as session:
            deleted_id = session.scalars(
                delete(SimulationRecordingModel)
                .where(SimulationRecordingModel.id == recording_id)
                .returning(SimulationRecordingModel.id)
            ).first()
            return deleted_id is not None
