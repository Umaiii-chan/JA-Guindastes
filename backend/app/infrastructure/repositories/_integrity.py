"""Leitura do nome da restrição violada num `IntegrityError` do PostgreSQL (TASK-022).

Os repositórios traduzem a violação para o erro da porta pelo nome da restrição, que é
determinístico por causa da convenção de nomes da `Base` (`app.infrastructure.database.base`).
"""

from sqlalchemy.exc import IntegrityError


def violated_constraint(error: IntegrityError) -> str | None:
    """Nome da restrição violada, informado pelo psycopg (`diag.constraint_name`), ou `None`."""
    diag = getattr(error.orig, "diag", None)
    name = getattr(diag, "constraint_name", None)
    return name if isinstance(name, str) else None
