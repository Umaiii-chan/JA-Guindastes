"""Modelos ORM do catálogo: fabricantes, guindastes e configurações (doc-fonte § 19.1; TASK-022).

Só infraestrutura: o mapeamento para os registros da aplicação (`CraneCatalogRepository`) e para a
`CraneGeometry` do domínio é escrito à mão em `app.infrastructure.repositories`.

Os ids são textos informados por quem cadastra (como os ids da `LoadChart`), não gerados pelo banco.
Exclusões são `RESTRICT`: apagar um fabricante, guindaste ou configuração não apaga em cascata o que
depende dele, porque as tabelas de carga precisam continuar rastreáveis (RNF-005, RN-005).
"""

from typing import Any

from sqlalchemy import JSON, CheckConstraint, Double, ForeignKey, String, text
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
    __table_args__ = (
        CheckConstraint(
            "capacity_limit_percent >= 1 AND capacity_limit_percent <= 100",
            name="capacity_limit_percent_range",
        ),
        CheckConstraint(
            "warning_band_percent >= 1 AND warning_band_percent <= 100",
            name="warning_band_percent_range",
        ),
        CheckConstraint(
            "max_ground_slope_deg >= 0 AND max_ground_slope_deg <= 45",
            name="max_ground_slope_deg_range",
        ),
        CheckConstraint(
            "max_leveling_deg >= 0 AND max_leveling_deg <= 45", name="max_leveling_deg_range"
        ),
        CheckConstraint(
            "slope_derating_percent_per_deg >= 0 AND slope_derating_percent_per_deg <= 100",
            name="slope_derating_percent_per_deg_range",
        ),
        CheckConstraint("crane_mass_kg > 0", name="crane_mass_kg_positive"),
        CheckConstraint("outrigger_pad_area_m2 > 0", name="outrigger_pad_area_m2_positive"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    manufacturer_id: Mapped[str] = mapped_column(
        String, ForeignKey("manufacturers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String, nullable=False)

    # Limites do modelo (TASK-051; RN-011, RN-013; ADR-022). Os padrões de inclinação são FICTÍCIOS.
    capacity_limit_percent: Mapped[float] = mapped_column(
        Double, nullable=False, default=100.0, server_default=text("100")
    )
    warning_band_percent: Mapped[float] = mapped_column(
        Double, nullable=False, default=90.0, server_default=text("90")
    )
    max_ground_slope_deg: Mapped[float] = mapped_column(
        Double, nullable=False, default=1.0, server_default=text("1.0")
    )
    max_leveling_deg: Mapped[float] = mapped_column(
        Double, nullable=False, default=3.0, server_default=text("3.0")
    )
    # Fatores do ambiente (TASK-067; RN-015; ADR-033). Massa e área são FICTÍCIAS.
    slope_derating_percent_per_deg: Mapped[float] = mapped_column(
        Double, nullable=False, default=10.0, server_default=text("10")
    )
    crane_mass_kg: Mapped[float] = mapped_column(
        Double, nullable=False, default=36000.0, server_default=text("36000")
    )
    outrigger_pad_area_m2: Mapped[float] = mapped_column(
        Double, nullable=False, default=0.5, server_default=text("0.5")
    )


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
        CheckConstraint(
            "hook_block_weight_kg >= 0 AND hook_block_weight_kg <= 100000",
            name="hook_block_weight_kg_range",
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

    # Zonas de giro e peso do gancho (TASK-046; ADR-018). As zonas vão como uma lista JSON de
    # `{code, name, start_deg, end_deg}`, na ordem declarada; a cobertura de 360° é validada pelo
    # domínio (`RotationZones`) ao gravar e ao ler. `NULL` = sem zonas; gancho `NULL` = 0 kg.
    rotation_zones: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON)
    hook_block_weight_kg: Mapped[float | None] = mapped_column(Double)
