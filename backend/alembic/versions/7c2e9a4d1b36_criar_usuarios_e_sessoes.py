"""criar usuarios e sessoes (TASK-038)

Cria `app_user` (conta com perfil, situação e hash Argon2id da senha) e `user_session` (sessão
opaca, guardada pelo SHA-256 do token), do ADR-016 §§ 2 e 3. Não altera a migration da TASK-022.

Escrita à mão a partir de `Base.metadata` (sem PostgreSQL local para o autogenerate); a sincronia
com os modelos é conferida pelo teste de integração da migration no CI (`compare_metadata`). Os
perfis estão escritos por extenso, sem importar o domínio, para a revisão não mudar se o enum mudar.

Revision ID: 7c2e9a4d1b36
Revises: 1f4cfaff16e8
Create Date: 2026-09-26 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c2e9a4d1b36"
down_revision: str | Sequence[str] | None = "1f4cfaff16e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "app_user",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("role IN ('ADMIN', 'OPERATOR')", name=op.f("ck_app_user_role_valid")),
        sa.CheckConstraint(
            "username = lower(username)", name=op.f("ck_app_user_username_lowercase")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_app_user")),
        sa.UniqueConstraint("username", name=op.f("uq_app_user_username")),
    )
    op.create_table(
        "user_session",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "token_hash ~ '^[0-9a-f]{64}$'", name=op.f("ck_user_session_token_hash_hex")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app_user.id"],
            name=op.f("fk_user_session_user_id_app_user"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("token_hash", name=op.f("pk_user_session")),
    )
    op.create_index(op.f("ix_user_session_user_id"), "user_session", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_user_session_user_id"), table_name="user_session")
    op.drop_table("user_session")
    op.drop_table("app_user")
