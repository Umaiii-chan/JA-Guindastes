"""criar o catálogo de acessórios de içamento (TASK-056)

ADR-026: tabela `accessories` (id, tipo, nome, peso, altura de aparelhamento, arquivo do modelo 3D,
crédito e licença). Não altera as migrations anteriores. Escrita à mão a partir de `Base.metadata`;
a sincronia com os modelos é conferida pelo teste de integração da migration no CI.

Nota de integração (leva E): `down_revision` aponta para a cabeça atual (`b4e1d7c93a52`); quem
integra encadeia 051 → 052 → 056 → 057 trocando só o `down_revision`.

Descida: remove a tabela `accessories` (os acessórios cadastrados se perdem).

Revision ID: 03845e55f0a8
Revises: b4e1d7c93a52
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "03845e55f0a8"
down_revision: str | Sequence[str] | None = "b4e1d7c93a52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TYPES = (
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


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "accessories",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("weight_kg", sa.Double(), nullable=False),
        sa.Column("rigging_height_m", sa.Double(), nullable=False),
        sa.Column("model_file", sa.String(), nullable=True),
        sa.Column("credit", sa.String(), nullable=True),
        sa.Column("license", sa.String(), nullable=True),
        sa.CheckConstraint(
            "type IN (" + ", ".join(f"'{value}'" for value in _TYPES) + ")",
            name=op.f("ck_accessories_type_valid"),
        ),
        sa.CheckConstraint(
            "weight_kg >= 0 AND weight_kg <= 100000", name=op.f("ck_accessories_weight_kg_range")
        ),
        sa.CheckConstraint(
            "rigging_height_m >= 0 AND rigging_height_m <= 50",
            name=op.f("ck_accessories_rigging_height_m_range"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_accessories")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("accessories")
