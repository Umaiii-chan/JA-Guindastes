"""criar cenarios (TASK-052)

Cria `scenario` (cenário com terreno editável, obstáculos e posição do guindaste, ADR-023): nome,
autor (`app_user`, com `CASCADE`), datas e o `spec` em JSON (`JSONB` no PostgreSQL).

Escrita à mão a partir de `Base.metadata` (sem PostgreSQL local para o autogenerate); a sincronia
com os modelos é conferida pelo teste de integração da migration no CI.

Revision ID: d3a8f1c25e70
Revises: b4e1d7c93a52
Create Date: 2026-10-14 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d3a8f1c25e70"
down_revision: str | Sequence[str] | None = "b4e1d7c93a52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "scenario",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("author_user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "spec",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["author_user_id"],
            ["app_user.id"],
            name=op.f("fk_scenario_author_user_id_app_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scenario")),
    )
    op.create_index(
        op.f("ix_scenario_author_user_id"), "scenario", ["author_user_id"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_scenario_author_user_id"), table_name="scenario")
    op.drop_table("scenario")
