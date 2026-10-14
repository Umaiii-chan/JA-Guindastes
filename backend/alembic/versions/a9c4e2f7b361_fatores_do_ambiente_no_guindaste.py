"""fatores do ambiente no guindaste (TASK-067)

ADR-033 / RN-015: `cranes` ganha `slope_derating_percent_per_deg` (padrão 10), `crane_mass_kg`
(padrão 36000, FICTÍCIO) e `outrigger_pad_area_m2` (padrão 0,5, FICTÍCIO), com CHECKs de faixa. Os
modelos já cadastrados recebem os padrões.

Escrita à mão a partir de `Base.metadata`; a sincronia com os modelos é conferida pelo teste de
integração da migration no CI (`compare_metadata`).

Revision ID: a9c4e2f7b361
Revises: d7a3c5e8f1b4
Create Date: 2026-10-14 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9c4e2f7b361"
down_revision: str | Sequence[str] | None = "d7a3c5e8f1b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    ("slope_derating_percent_per_deg", "10"),
    ("crane_mass_kg", "36000"),
    ("outrigger_pad_area_m2", "0.5"),
)
_CHECKS = (
    (
        "slope_derating_percent_per_deg_range",
        "slope_derating_percent_per_deg >= 0 AND slope_derating_percent_per_deg <= 100",
    ),
    ("crane_mass_kg_positive", "crane_mass_kg > 0"),
    ("outrigger_pad_area_m2_positive", "outrigger_pad_area_m2 > 0"),
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
