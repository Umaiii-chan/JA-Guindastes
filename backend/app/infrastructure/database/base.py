"""Base declarativa dos modelos ORM (TASK-011).

Ainda não há modelos: as tabelas entram com cada caso de uso. Os modelos devem herdar de `Base`
para que o Alembic os enxergue em `Base.metadata` (ver `backend/alembic/env.py`).
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Nomes determinísticos para constraints e índices, para que as migrations geradas pelo Alembic
# consigam alterá-los ou removê-los depois (convenção sugerida na documentação do SQLAlchemy).
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Classe-base de todos os modelos ORM."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
