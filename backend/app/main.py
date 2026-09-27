"""Raiz de composição do backend (TASK-019, TASK-024, TASK-029; ADR-004): liga os adapters à API.

É o único módulo que importa a apresentação e a infraestrutura ao mesmo tempo. Fica fora das
camadas do contrato do import-linter (`backend/pyproject.toml`), em que `app.presentation` e
`app.infrastructure` são camadas independentes, que não se importam nem por meio de outro módulo.
Por isso nenhum módulo das camadas deve importar este.

Duas composições, escolhidas por `DATABASE_URL` (`compose_app`):

- **com `DATABASE_URL`** (`create_database_app`): engine e fábrica de sessões da TASK-011 e os
  repositórios SQLAlchemy da TASK-022 como `CraneGeometryProvider` e `ActiveLoadChartProvider`.
  - REST: dependência FastAPI por requisição que pega **uma conexão do pool** e a devolve no fim da
    requisição, mesmo com erro; as sessões dos repositórios usam essa conexão e cada uma é fechada
    pelo próprio repositório.
  - WebSocket: um `EvaluateOperation` com os repositórios ligados à fábrica de sessões do engine.
    Cada mensagem abre e fecha as próprias sessões (uma por consulta do caso de uso) e nada fica
    preso à conexão WebSocket. Sessão por conexão foi descartada: prenderia uma conexão do pool
    enquanto o cliente ficar conectado (o pool padrão tem 5 + 10) e leria dados cada vez mais
    velhos (por exemplo, uma tabela ativada depois da abertura do WebSocket).
  - Saúde: `SELECT 1` numa conexão do pool.
  - Uma `DATABASE_URL` **inválida** impede a aplicação de subir (não cai para "sem banco" em
    silêncio); a mensagem de erro não repete a URL (`DatabaseSettings`).
- **sem `DATABASE_URL`** (`create_app_without_database`): os provedores "não configurados" (sempre
  `None`). A API sobe, a avaliação responde `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e
  `ACTIVE_LOAD_CHART_NOT_FOUND` (nunca dados inventados), a saúde mostra `NOT_CONFIGURED`, e um
  aviso vai para o log.

Nas duas, a estratégia de consulta é a `ConservativeTabulatedLookup` (ADR-015, provisória), e REST e
WebSocket usam a mesma montagem do `EvaluateOperation` (`build_evaluate_operation`).

Autenticação (TASK-038; ADR-016): só com `DATABASE_URL` (`build_auth`, em `app.auth_composition`,
no mesmo engine). Sem banco não há login e as rotas continuam abertas (ADR-016 § 5).

Catálogo (TASK-030): as rotas de cadastro usam o `SqlAlchemyCraneCatalogRepository` (TASK-022) e só
são registradas quando `DATABASE_URL` está definida (`create_database_app`, no mesmo engine da
avaliação). `build_catalog_repository` hoje só é usado pelos testes (`docs/known-gaps.md` D-002).
As edições do catálogo e a listagem das tabelas de uma configuração (TASK-044) também só existem
com `DATABASE_URL`; a listagem não depende de `FILE_STORAGE_DIR`.

Rodar a API completa, em `backend/`: `uv run uvicorn app.main:app --reload`.
"""

import logging
import os
from collections.abc import Iterator, Mapping

from fastapi import FastAPI
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.auth_composition import build_auth
from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.infrastructure.database.config import DATABASE_URL_ENV_VAR, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.load_chart_persistence_composition import build_load_chart_persistence
from app.presentation.api.evaluations import (
    EvaluateOperationDependency,
    shared_evaluate_operation,
)
from app.presentation.api.health import DatabaseHealthCheck
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import UploadLimits

logger = logging.getLogger(__name__)

load_chart_interpolator = ConservativeTabulatedLookup()
"""Estratégia de consulta da composição: provisória (ADR-015; PEND-001, PEND-003)."""


class UnconfiguredCraneGeometryProvider:
    """Sem `DATABASE_URL`: nenhuma ficha técnica disponível; sempre devolve `None`.

    Cumpre a porta `CraneGeometryProvider`: "sem ficha técnica" é `None`, sem exceção.
    """

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return None


class UnconfiguredActiveLoadChartProvider:
    """Sem `DATABASE_URL`: nenhuma tabela de carga ativa disponível; sempre devolve `None`.

    Cumpre a porta `ActiveLoadChartProvider`: "sem tabela ativa" é `None`, sem exceção.
    """

    def get_active_load_chart(self, configuration_id: str) -> LoadChart | None:
        return None


def build_evaluate_operation(
    crane_geometry_provider: CraneGeometryProvider,
    active_load_chart_provider: ActiveLoadChartProvider,
) -> EvaluateOperation:
    """Monta o caso de uso com a estratégia da composição (a mesma para REST e WebSocket)."""
    return EvaluateOperation(
        crane_geometry_provider=crane_geometry_provider,
        active_load_chart_provider=active_load_chart_provider,
        load_chart_interpolator=load_chart_interpolator,
    )


def build_database_evaluate_operation(session_factory: sessionmaker[Session]) -> EvaluateOperation:
    """Caso de uso ligado aos repositórios da TASK-022 sobre `session_factory`."""
    return build_evaluate_operation(
        SqlAlchemyCraneCatalogRepository(session_factory),
        SqlAlchemyLoadChartRepository(session_factory),
    )


def evaluate_operation_per_request(engine: Engine) -> EvaluateOperationDependency:
    """Dependência FastAPI da avaliação REST: uma conexão do pool por requisição.

    O `with` devolve a conexão ao pool no fim da requisição, inclusive quando a rota levanta
    exceção (o FastAPI repassa a exceção ao gerador). As sessões dos repositórios usam essa conexão;
    como ela não está numa transação aberta por fora, cada sessão abre e encerra a própria.
    """

    def provide_evaluate_operation() -> Iterator[EvaluateOperation]:
        with engine.connect() as connection:
            yield build_database_evaluate_operation(sessionmaker(bind=connection))

    return provide_evaluate_operation


def database_health_check(engine: Engine) -> DatabaseHealthCheck:
    """`SELECT 1` numa conexão do pool. O log leva só o tipo do erro, nunca a URL nem a mensagem."""

    def check_database() -> bool:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError as error:
            logger.warning(
                "o banco não respondeu à verificação de saúde (%s)", type(error).__name__
            )
            return False
        return True

    return check_database


def build_catalog_repository(
    environ: Mapping[str, str] | None = None,
) -> SqlAlchemyCraneCatalogRepository | None:
    """Repositório do catálogo (TASK-022) para as rotas de cadastro (TASK-030).

    Sem `DATABASE_URL` (testes sem banco, execução local sem PostgreSQL), devolve `None` e as rotas
    do catálogo não são registradas. `DATABASE_URL` presente mas inválida levanta
    `DatabaseConfigurationError` na subida. Criar o engine não abre conexão.
    """
    source = os.environ if environ is None else environ
    if not source.get(DATABASE_URL_ENV_VAR, "").strip():
        return None
    settings = DatabaseSettings.from_environment(source)
    return SqlAlchemyCraneCatalogRepository(
        create_session_factory(create_database_engine(settings))
    )


def create_database_app(engine: Engine, environ: Mapping[str, str] | None = None) -> FastAPI:
    """Aplicação completa com persistência no banco de `engine` e autenticação (ADR-016).

    `environ` (por padrão, `os.environ`) fornece `SESSION_COOKIE_SECURE`.
    """
    session_factory = create_session_factory(engine)
    return create_app(
        load_chart_parser=CsvLoadChartParser(),
        # Limite padrão PROVISÓRIO de 1 MiB por arquivo — A VALIDAR (P-008).
        upload_limits=UploadLimits(),
        evaluation=evaluate_operation_per_request(engine),
        evaluation_websocket=build_database_evaluate_operation(session_factory),
        database_health_check=database_health_check(engine),
        # Catálogo (TASK-030) e suas edições (TASK-044) no mesmo engine da avaliação: um pool só.
        catalog_repository=SqlAlchemyCraneCatalogRepository(session_factory),
        # Listagem das tabelas de uma configuração (TASK-044): só banco, sem FILE_STORAGE_DIR.
        load_chart_listing=SqlAlchemyLoadChartRepository(session_factory),
        # Importação com gravação e ativação (TASK-031): mesmo engine; exige FILE_STORAGE_DIR.
        load_chart_persistence=build_load_chart_persistence(engine),
        # Login, sessões e perfis (TASK-038): mesmo engine.
        auth=build_auth(engine, environ),
        on_shutdown=engine.dispose,
    )


def create_app_without_database() -> FastAPI:
    """Aplicação sem persistência: avaliação sempre "não avaliável", saúde `NOT_CONFIGURED`."""
    logger.warning(
        "%s não definida: persistência não configurada; a avaliação responde NOT_EVALUABLE",
        DATABASE_URL_ENV_VAR,
    )
    use_case = build_evaluate_operation(
        UnconfiguredCraneGeometryProvider(), UnconfiguredActiveLoadChartProvider()
    )
    return create_app(
        load_chart_parser=CsvLoadChartParser(),
        # Limite padrão PROVISÓRIO de 1 MiB por arquivo — A VALIDAR (P-008).
        upload_limits=UploadLimits(),
        evaluation=shared_evaluate_operation(use_case),
        evaluation_websocket=use_case,
    )


def compose_app(environ: Mapping[str, str] | None = None) -> FastAPI:
    """Escolhe a composição por `DATABASE_URL` em `environ` (por padrão, `os.environ`).

    Ausente ou em branco: sem banco. Definida: valida (`DatabaseConfigurationError` se inválida,
    sem repetir o valor) e liga o banco. Criar o engine não abre conexão.
    """
    source = os.environ if environ is None else environ
    if not source.get(DATABASE_URL_ENV_VAR, "").strip():
        return create_app_without_database()
    settings = DatabaseSettings.from_environment(source)
    return create_database_app(create_database_engine(settings), source)


app = compose_app()
