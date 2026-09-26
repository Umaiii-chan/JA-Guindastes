"""Criação do engine e da fábrica de sessões do SQLAlchemy (TASK-011).

Só a infraestrutura importa SQLAlchemy; domínio e aplicação não (ADR-004, RNF-002; contratos do
import-linter em `backend/pyproject.toml`).
"""

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.database.config import DatabaseSettings


def create_database_engine(settings: DatabaseSettings) -> Engine:
    """Cria o engine. Nenhuma conexão é aberta aqui: o SQLAlchemy conecta no primeiro uso."""
    # pool_pre_ping: descarta conexões mortas do pool (por exemplo, após reiniciar o container).
    return create_engine(settings.url, pool_pre_ping=True)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Cria a fábrica de sessões ligada ao engine. Criar uma sessão também não conecta."""
    return sessionmaker(bind=engine)
