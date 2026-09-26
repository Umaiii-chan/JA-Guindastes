"""criar catalogo e tabelas de carga (TASK-022)

Cria `manufacturers`, `cranes`, `crane_configurations` (com a ficha técnica do ADR-013 C-4),
`load_charts` e `load_chart_points` (doc-fonte § 19.1).

Gerada a partir de `Base.metadata` com o renderizador do autogenerate do Alembic contra um esquema
vazio (o banco local não subiu: sem virtualização) e revisada à mão. Os valores de status estão
escritos por extenso, sem importar o domínio, para a revisão não mudar se o enum mudar.

Revision ID: 1f4cfaff16e8
Revises:
Create Date: 2026-09-26 16:45:09.318777

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1f4cfaff16e8"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "manufacturers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_manufacturers")),
    )
    op.create_table(
        "cranes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("manufacturer_id", sa.String(), nullable=False),
        sa.Column("model_name", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["manufacturer_id"],
            ["manufacturers.id"],
            name=op.f("fk_cranes_manufacturer_id_manufacturers"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cranes")),
    )
    op.create_index(op.f("ix_cranes_manufacturer_id"), "cranes", ["manufacturer_id"], unique=False)
    op.create_table(
        "crane_configurations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("crane_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("boom_pivot_offset_m", sa.Double(), nullable=True),
        sa.Column("boom_pivot_height_m", sa.Double(), nullable=True),
        sa.Column("boom_length_min_m", sa.Double(), nullable=True),
        sa.Column("boom_length_max_m", sa.Double(), nullable=True),
        sa.Column("boom_angle_min_deg", sa.Double(), nullable=True),
        sa.Column("boom_angle_max_deg", sa.Double(), nullable=True),
        sa.Column("cable_length_min_m", sa.Double(), nullable=True),
        sa.Column("cable_length_max_m", sa.Double(), nullable=True),
        sa.Column("turret_rotation_min_deg", sa.Double(), nullable=True),
        sa.Column("turret_rotation_max_deg", sa.Double(), nullable=True),
        # Ficha técnica: os 7 parâmetros obrigatórios juntos, ou nenhum (sem ficha cadastrada).
        sa.CheckConstraint(
            "num_nulls(boom_pivot_offset_m, boom_pivot_height_m, boom_length_min_m, "
            "boom_length_max_m, boom_angle_min_deg, boom_angle_max_deg, cable_length_min_m) "
            "IN (0, 7)",
            name=op.f("ck_crane_configurations_geometry_required_all_or_none"),
        ),
        sa.CheckConstraint(
            "boom_pivot_offset_m IS NOT NULL OR "
            "num_nonnulls(cable_length_max_m, turret_rotation_min_deg, turret_rotation_max_deg) "
            "= 0",
            name=op.f("ck_crane_configurations_geometry_optional_needs_required"),
        ),
        sa.CheckConstraint(
            "num_nulls(turret_rotation_min_deg, turret_rotation_max_deg) IN (0, 2)",
            name=op.f("ck_crane_configurations_turret_rotation_limits_together"),
        ),
        sa.CheckConstraint(
            "boom_pivot_height_m >= 0",
            name=op.f("ck_crane_configurations_boom_pivot_height_m_non_negative"),
        ),
        sa.CheckConstraint(
            "boom_length_min_m >= 0",
            name=op.f("ck_crane_configurations_boom_length_min_m_non_negative"),
        ),
        sa.CheckConstraint(
            "boom_length_max_m >= 0",
            name=op.f("ck_crane_configurations_boom_length_max_m_non_negative"),
        ),
        sa.CheckConstraint(
            "cable_length_min_m >= 0",
            name=op.f("ck_crane_configurations_cable_length_min_m_non_negative"),
        ),
        sa.CheckConstraint(
            "cable_length_max_m >= 0",
            name=op.f("ck_crane_configurations_cable_length_max_m_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["crane_id"],
            ["cranes.id"],
            name=op.f("fk_crane_configurations_crane_id_cranes"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_crane_configurations")),
    )
    op.create_index(
        op.f("ix_crane_configurations_crane_id"),
        "crane_configurations",
        ["crane_id"],
        unique=False,
    )
    op.create_table(
        "load_charts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("configuration_id", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("source_file_name", sa.String(), nullable=False),
        sa.Column("source_file_type", sa.String(), nullable=False),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("source_uri", sa.String(), nullable=True),
        sa.CheckConstraint(
            "source_sha256 ~ '^[0-9a-f]{64}$'", name=op.f("ck_load_charts_source_sha256_hex")
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'SUPERSEDED', 'INVALID')",
            name=op.f("ck_load_charts_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["configuration_id"],
            ["crane_configurations.id"],
            name=op.f("fk_load_charts_configuration_id_crane_configurations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_load_charts")),
        # Uma versão por configuração (RN-005). O índice da restrição também serve às buscas por
        # configuração.
        sa.UniqueConstraint(
            "configuration_id", "version", name="uq_load_charts_configuration_id_version"
        ),
    )
    # No máximo uma tabela ACTIVE por configuração, garantido pelo banco (índice único parcial).
    op.create_index(
        "uq_load_charts_one_active_per_configuration",
        "load_charts",
        ["configuration_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.create_table(
        "load_chart_points",
        sa.Column("load_chart_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("boom_length_m", sa.Double(), nullable=False),
        sa.Column("working_radius_m", sa.Double(), nullable=False),
        sa.Column("max_capacity_kg", sa.Double(), nullable=False),
        sa.CheckConstraint(
            "position >= 0", name=op.f("ck_load_chart_points_position_non_negative")
        ),
        sa.CheckConstraint(
            "boom_length_m >= 0", name=op.f("ck_load_chart_points_boom_length_m_non_negative")
        ),
        sa.CheckConstraint(
            "working_radius_m >= 0",
            name=op.f("ck_load_chart_points_working_radius_m_non_negative"),
        ),
        sa.CheckConstraint(
            "max_capacity_kg >= 0",
            name=op.f("ck_load_chart_points_max_capacity_kg_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["load_chart_id"],
            ["load_charts.id"],
            name=op.f("fk_load_chart_points_load_chart_id_load_charts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("load_chart_id", "position", name=op.f("pk_load_chart_points")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("load_chart_points")
    op.drop_index("uq_load_charts_one_active_per_configuration", table_name="load_charts")
    op.drop_table("load_charts")
    op.drop_index(op.f("ix_crane_configurations_crane_id"), table_name="crane_configurations")
    op.drop_table("crane_configurations")
    op.drop_index(op.f("ix_cranes_manufacturer_id"), table_name="cranes")
    op.drop_table("cranes")
    op.drop_table("manufacturers")
