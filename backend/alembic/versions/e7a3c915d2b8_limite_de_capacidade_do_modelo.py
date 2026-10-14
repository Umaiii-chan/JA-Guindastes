"""limite de capacidade e inclinações máximas por modelo (TASK-051)

ADR-022 / RN-011 / RN-013: `cranes` ganha `capacity_limit_percent` (padrão 100),
`warning_band_percent` (padrão 90), `max_ground_slope_deg` (padrão 1.0, FICTÍCIO) e
`max_leveling_deg` (padrão 3.0, FICTÍCIO), com CHECKs de faixa. Os modelos já cadastrados recebem
os padrões. Não altera as migrations anteriores.

Escrita à mão a partir de `Base.metadata`; a sincronia com os modelos é conferida pelo teste de
integração da migration no CI (`compare_metadata`).

Revision ID: e7a3c915d2b8
Revises: b4e1d7c93a52
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7a3c915d2b8"
down_revision: str | Sequence[str] | None = "b4e1d7c93a52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    ("capacity_limit_percent", "100"),
    ("warning_band_percent", "90"),
    ("max_ground_slope_deg", "1.0"),
    ("max_leveling_deg", "3.0"),
)
_CHECKS = (
    (
        "capacity_limit_percent_range",
        "capacity_limit_percent >= 1 AND capacity_limit_percent <= 100",
    ),
    ("warning_band_percent_range", "warning_band_percent >= 1 AND warning_band_percent <= 100"),
    ("max_ground_slope_deg_range", "max_ground_slope_deg >= 0 AND max_ground_slope_deg <= 45"),
    ("max_leveling_deg_range", "max_leveling_deg >= 0 AND max_leveling_deg <= 45"),
)


def upgrade() -> None:
    """Upgrade schema."""
    for column, default in _COLUMNS:
        op.add_column(
            "cranes",
            sa.Column(column, sa.Double(), server_default=sa.text(default), nullable=False),
        )
    for name, condition in _CHECKS:
        op.create_check_constraint(op.f(f"ck_cranes_{name}"), "cranes", condition)


def downgrade() -> None:
    """Downgrade schema."""
    for name, _ in reversed(_CHECKS):
        op.drop_constraint(op.f(f"ck_cranes_{name}"), "cranes", type_="check")
    for column, _ in reversed(_COLUMNS):
        op.drop_column("cranes", column)
