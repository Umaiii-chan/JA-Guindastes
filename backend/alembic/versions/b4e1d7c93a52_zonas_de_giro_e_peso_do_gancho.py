"""zonas de giro e peso do gancho (TASK-046)

ADR-018: a configuração ganha as zonas de giro (`rotation_zones`, JSON) e o peso do gancho
(`hook_block_weight_kg`); a tabela de carga ganha a zona (`rotation_zone_code`), e a unicidade de
"uma `ACTIVE`" passa a valer por `(configuration_id, coalesce(rotation_zone_code, ''))`. Não altera
as migrations anteriores.

Escrita à mão a partir de `Base.metadata` (sem PostgreSQL local para o autogenerate); a sincronia
com os modelos é conferida pelo teste de integração da migration no CI (`compare_metadata`).

Descida: as tabelas **sem zona** ficam como estão. As tabelas com zona continuam gravadas, mas
perdem a zona, e as que estavam `ACTIVE` passam a `SUPERSEDED` antes de o índice de "uma `ACTIVE`
por configuração" voltar (senão ele não poderia ser recriado). As zonas e o peso do gancho das
configurações são descartados.

Revision ID: b4e1d7c93a52
Revises: 7c2e9a4d1b36
Create Date: 2026-09-27 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b4e1d7c93a52"
down_revision: str | Sequence[str] | None = "7c2e9a4d1b36"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_ONE_ACTIVE_INDEX = "uq_load_charts_one_active_per_configuration"
_NEW_ONE_ACTIVE_INDEX = "uq_load_charts_one_active_per_configuration_zone"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("crane_configurations", sa.Column("rotation_zones", sa.JSON(), nullable=True))
    op.add_column(
        "crane_configurations", sa.Column("hook_block_weight_kg", sa.Double(), nullable=True)
    )
    op.create_check_constraint(
        op.f("ck_crane_configurations_hook_block_weight_kg_range"),
        "crane_configurations",
        "hook_block_weight_kg >= 0 AND hook_block_weight_kg <= 100000",
    )

    op.add_column(
        "load_charts", sa.Column("rotation_zone_code", sa.String(length=32), nullable=True)
    )
    op.create_check_constraint(
        op.f("ck_load_charts_rotation_zone_code_format"),
        "load_charts",
        "rotation_zone_code ~ '^[A-Z0-9_]{1,32}$'",
    )
    # As tabelas existentes não têm zona: continuam sendo, no máximo, uma ACTIVE por configuração.
    op.drop_index(_OLD_ONE_ACTIVE_INDEX, table_name="load_charts")
    op.create_index(
        _NEW_ONE_ACTIVE_INDEX,
        "load_charts",
        ["configuration_id", sa.text("coalesce(rotation_zone_code, '')")],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        "UPDATE load_charts SET status = 'SUPERSEDED' "
        "WHERE status = 'ACTIVE' AND rotation_zone_code IS NOT NULL"
    )
    op.drop_index(_NEW_ONE_ACTIVE_INDEX, table_name="load_charts")
    op.create_index(
        _OLD_ONE_ACTIVE_INDEX,
        "load_charts",
        ["configuration_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )
    op.drop_constraint(
        op.f("ck_load_charts_rotation_zone_code_format"), "load_charts", type_="check"
    )
    op.drop_column("load_charts", "rotation_zone_code")

    op.drop_constraint(
        op.f("ck_crane_configurations_hook_block_weight_kg_range"),
        "crane_configurations",
        type_="check",
    )
    op.drop_column("crane_configurations", "hook_block_weight_kg")
    op.drop_column("crane_configurations", "rotation_zones")
