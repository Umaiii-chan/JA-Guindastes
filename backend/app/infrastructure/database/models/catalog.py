"""Modelos ORM do catálogo: fabricantes, guindastes e configurações (doc-fonte § 19.1; TASK-022).

Só infraestrutura: o mapeamento para os registros da aplicação (`CraneCatalogRepository`) e para a
`CraneGeometry` do domínio é escrito à mão em `app.infrastructure.repositories`.

Os ids são textos informados por quem cadastra (como os ids da `LoadChart`), não gerados pelo banco.
Exclusões são `RESTRICT`: apagar um fabricante, guindaste ou configuração não apaga em cascata o que
depende dele, porque as tabelas de carga precisam continuar rastreáveis (RNF-005, RN-005).
"""

from sqlalchemy import CheckConstraint, Double, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base

# Parâmetros obrigatórios da ficha técnica (ADR-013 C-4): ou todos preenchidos, ou nenhum.
_REQUIRED_GEOMETRY_COLUMNS = (
    "boom_pivot_offset_m",
    "boom_pivot_height_m",
    "boom_length_min_m",
    "boom_length_max_m",
    "boom_angle_min_deg",
    "boom_angle_max_deg",
    "cable_length_min_m",
)
_OPTIONAL_GEOMETRY_COLUMNS = (
    "cable_length_max_m",
    "turret_rotation_min_deg",
    "turret_rotation_max_deg",
)
_NON_NEGATIVE_LENGTH_COLUMNS = (
    "boom_pivot_height_m",
    "boom_length_min_m",
    "boom_length_max_m",
    "cable_length_min_m",
    "cable_length_max_m",
)


class ManufacturerModel(Base):
    """Linha de `manufacturers` (RF-001)."""

    __tablename__ = "manufacturers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)


class CraneModel(Base):
    """Linha de `cranes`: o modelo lógico do guindaste, sem capacidade global (RF-002)."""

    __tablename__ = "cranes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    manufacturer_id: Mapped[str] = mapped_column(
        String, ForeignKey("manufacturers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String, nullable=False)


class CraneConfigurationModel(Base):
    """Linha de `crane_configurations`, com a ficha técnica geométrica (RF-005; ADR-013 C-4).

    As colunas da ficha têm a unidade no nome (RN-006) e são anuláveis: sem ficha cadastrada, todas
    ficam nulas. As restrições `CHECK` impedem ficha pela metade; as faixas (mínimo ≤ máximo, θ em
    (−90°, 90°]) continuam validadas pela `CraneGeometry` ao ler e ao gravar.
    """

    __tablename__ = "crane_configurations"
    __table_args__ = (
        CheckConstraint(
            f"num_nulls({', '.join(_REQUIRED_GEOMETRY_COLUMNS)}) "
            f"IN (0, {len(_REQUIRED_GEOMETRY_COLUMNS)})",
            name="geometry_required_all_or_none",
        ),
        CheckConstraint(
            "boom_pivot_offset_m IS NOT NULL OR "
            f"num_nonnulls({', '.join(_OPTIONAL_GEOMETRY_COLUMNS)}) = 0",
            name="geometry_optional_needs_required",
        ),
        CheckConstraint(
            "num_nulls(turret_rotation_min_deg, turret_rotation_max_deg) IN (0, 2)",
            name="turret_rotation_limits_together",
        ),
        *(
            CheckConstraint(f"{column} >= 0", name=f"{column}_non_negative")
            for column in _NON_NEGATIVE_LENGTH_COLUMNS
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    crane_id: Mapped[str] = mapped_column(
        String, ForeignKey("cranes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)

    boom_pivot_offset_m: Mapped[float | None] = mapped_column(Double)
    boom_pivot_height_m: Mapped[float | None] = mapped_column(Double)
    boom_length_min_m: Mapped[float | None] = mapped_column(Double)
    boom_length_max_m: Mapped[float | None] = mapped_column(Double)
    boom_angle_min_deg: Mapped[float | None] = mapped_column(Double)
    boom_angle_max_deg: Mapped[float | None] = mapped_column(Double)
    cable_length_min_m: Mapped[float | None] = mapped_column(Double)
    cable_length_max_m: Mapped[float | None] = mapped_column(Double)
    turret_rotation_min_deg: Mapped[float | None] = mapped_column(Double)
    turret_rotation_max_deg: Mapped[float | None] = mapped_column(Double)
