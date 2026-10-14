"""criar gravacoes de simulacao (TASK-057)

Cria `simulation_recordings` (ADR-027): metadados da gravação (autor, duração, configuração, tabelas
de carga usadas — RN-005), o cenário em JSON e os quadros em JSON comprimido com gzip (`bytea`).
Não altera as migrations anteriores.

Escrita à mão a partir de `Base.metadata` (sem PostgreSQL local para o autogenerate); a sincronia
com os modelos é conferida pelo teste de integração da migration no CI (`compare_metadata`).

Nesta leva todas as migrations partem de `b4e1d7c93a52` (docs/leva-e/contratos.md § 5); quem integra
as tarefas encadeia na ordem 051 → 052 → 056 → 057 trocando só o `down_revision`.

Revision ID: d7a3c5e8f1b4
Revises: b4e1d7c93a52
Create Date: 2026-10-14 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7a3c5e8f1b4"
down_revision: str | Sequence[str] | None = "b4e1d7c93a52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "simulation_recordings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("author_user_id", sa.String(), nullable=False),
        sa.Column("author_display_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("configuration_id", sa.String(), nullable=False),
        sa.Column("load_chart_refs", sa.JSON(), nullable=False),
        sa.Column("frame_count", sa.Integer(), nullable=False),
        sa.Column("scenario", sa.JSON(), nullable=True),
        sa.Column("frames_gzip", sa.LargeBinary(), nullable=False),
        sa.CheckConstraint(
            "duration_ms >= 0", name=op.f("ck_simulation_recordings_duration_non_negative")
        ),
        sa.CheckConstraint(
            "frame_count > 0", name=op.f("ck_simulation_recordings_frame_count_positive")
        ),
        sa.ForeignKeyConstraint(
            ["author_user_id"],
            ["app_user.id"],
            name=op.f("fk_simulation_recordings_author_user_id_app_user"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_simulation_recordings")),
    )
    op.create_index(
        op.f("ix_simulation_recordings_author_user_id"),
        "simulation_recordings",
        ["author_user_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_simulation_recordings_author_user_id"), table_name="simulation_recordings"
    )
    op.drop_table("simulation_recordings")
