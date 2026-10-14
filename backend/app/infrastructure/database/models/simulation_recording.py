"""Modelo ORM das gravações de simulação (ADR-027; TASK-057; RN-005).

`simulation_recordings`: metadados (nome, autor, duração, configuração, tabelas de carga usadas) e o
conteúdo. Os quadros ficam como JSON comprimido com gzip em `frames_gzip` (`bytea`); o cenário, como
JSON. O nome de exibição do autor é copiado na gravação, para a lista não depender de uma junção.
Datas com fuso horário (`timestamptz`).
"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class SimulationRecordingModel(Base):
    """Linha de `simulation_recordings`."""

    __tablename__ = "simulation_recordings"
    __table_args__ = (
        CheckConstraint("duration_ms >= 0", name="duration_non_negative"),
        CheckConstraint("frame_count > 0", name="frame_count_positive"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    author_user_id: Mapped[str] = mapped_column(
        String, ForeignKey("app_user.id"), nullable=False, index=True
    )
    author_display_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration_id: Mapped[str] = mapped_column(String, nullable=False)
    # Lista de `{"load_chart_id", "version"}` (RN-005).
    load_chart_refs: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False)
    frame_count: Mapped[int] = mapped_column(Integer, nullable=False)
    scenario: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    frames_gzip: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
