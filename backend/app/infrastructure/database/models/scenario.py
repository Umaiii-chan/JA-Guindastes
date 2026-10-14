"""Modelo ORM dos cenários (TASK-052; ADR-023).

- `scenario`: nome, autor (`app_user`), datas com fuso e o `spec` (terreno, obstáculos e posição do
  guindaste) como JSON em `snake_case`. Apagar o autor apaga os cenários dele (`CASCADE`).
"""

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class ScenarioModel(Base):
    """Linha de `scenario`."""

    __tablename__ = "scenario"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    author_user_id: Mapped[str] = mapped_column(
        String, ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    spec: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False
    )
