"""Modelo ORM do catálogo de acessórios de içamento (TASK-056; ADR-026).

Tabela `accessories`, independente das configurações: os acessórios são escolhidos na simulação e
enviados à avaliação por id (`accessory_ids`). Valores FICTÍCIOS e configuráveis (ADR-012).
"""

from sqlalchemy import CheckConstraint, Double, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base

ACCESSORY_TYPES = (
    "HOOK_BLOCK",
    "OVERHAUL_BALL",
    "SWIVEL_HOOK",
    "SHACKLE",
    "WIRE_ROPE_SLING",
    "CHAIN_SLING",
    "POLYESTER_SLING",
    "SPREADER_BEAM",
    "CRANE_MAT",
)


class AccessoryModel(Base):
    """Linha de `accessories`."""

    __tablename__ = "accessories"
    __table_args__ = (
        CheckConstraint(
            "type IN (" + ", ".join(f"'{value}'" for value in ACCESSORY_TYPES) + ")",
            name="type_valid",
        ),
        CheckConstraint("weight_kg >= 0 AND weight_kg <= 100000", name="weight_kg_range"),
        CheckConstraint(
            "rigging_height_m >= 0 AND rigging_height_m <= 50", name="rigging_height_m_range"
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Double, nullable=False)
    rigging_height_m: Mapped[float] = mapped_column(Double, nullable=False)
    model_file: Mapped[str | None] = mapped_column(String)
    credit: Mapped[str | None] = mapped_column(String)
    license: Mapped[str | None] = mapped_column(String)
