"""Modelos ORM das tabelas de carga e dos pontos (doc-fonte §§ 10.2, 13 e 19; TASK-022).

- `load_charts`: cabeçalho, versão, configuração (RN-001), status (doc-fonte § 13.2) e metadados do
  arquivo-fonte (RF-008, RNF-005). Uma versão por configuração (`uq_load_charts_configuration_id_
  version`) e no máximo uma tabela `ACTIVE` por configuração, garantida por índice único parcial
  (`uq_load_charts_one_active_per_configuration`): a garantia fica no banco, e não só no
  repositório, para valer também com gravações concorrentes.
- `load_chart_points`: um ponto por linha, com a posição original (`position`), porque a
  `LoadChart` aceita pontos repetidos com a mesma capacidade e os mantém como vieram. Os pontos são
  parte da tabela: apagar a tabela apaga os pontos (`CASCADE`).

Números em `DOUBLE PRECISION`: o `float` do Python volta idêntico, o que importa porque a consulta
por ponto usa igualdade exata (PEND-002).
"""

from sqlalchemy import (
    CheckConstraint,
    Double,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.entities.load_chart import LoadChartStatus
from app.infrastructure.database.base import Base

ONE_ACTIVE_PER_CONFIGURATION_INDEX = "uq_load_charts_one_active_per_configuration"
CONFIGURATION_VERSION_CONSTRAINT = "uq_load_charts_configuration_id_version"

_STATUS_VALUES = ", ".join(f"'{status.value}'" for status in LoadChartStatus)


class LoadChartModel(Base):
    """Linha de `load_charts`."""

    __tablename__ = "load_charts"
    __table_args__ = (
        UniqueConstraint("configuration_id", "version", name=CONFIGURATION_VERSION_CONSTRAINT),
        CheckConstraint(f"status IN ({_STATUS_VALUES})", name="status_valid"),
        CheckConstraint("source_sha256 ~ '^[0-9a-f]{64}$'", name="source_sha256_hex"),
        Index(
            ONE_ACTIVE_PER_CONFIGURATION_INDEX,
            "configuration_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    configuration_id: Mapped[str] = mapped_column(
        String, ForeignKey("crane_configurations.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    source_file_name: Mapped[str] = mapped_column(String, nullable=False)
    source_file_type: Mapped[str] = mapped_column(String, nullable=False)
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    source_uri: Mapped[str | None] = mapped_column(String)

    points: Mapped[list[LoadChartPointModel]] = relationship(
        order_by="LoadChartPointModel.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class LoadChartPointModel(Base):
    """Linha de `load_chart_points`, em unidades internas (RN-006)."""

    __tablename__ = "load_chart_points"
    __table_args__ = (
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("boom_length_m >= 0", name="boom_length_m_non_negative"),
        CheckConstraint("working_radius_m >= 0", name="working_radius_m_non_negative"),
        CheckConstraint("max_capacity_kg >= 0", name="max_capacity_kg_non_negative"),
    )

    load_chart_id: Mapped[str] = mapped_column(
        String, ForeignKey("load_charts.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    boom_length_m: Mapped[float] = mapped_column(Double, nullable=False)
    working_radius_m: Mapped[float] = mapped_column(Double, nullable=False)
    max_capacity_kg: Mapped[float] = mapped_column(Double, nullable=False)
