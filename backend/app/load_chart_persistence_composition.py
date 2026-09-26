"""Composição da importação com gravação e da ativação de tabelas de carga (TASK-031).

Parte da raiz de composição (`app.main`): fica fora das camadas do import-linter, como `app.main`,
e só `app.main` deve importá-la. Está num módulo à parte para a mudança em `app.main` ser mínima.

As rotas só são ligadas quando as duas variáveis de ambiente estão definidas:
- `DATABASE_URL` (TASK-011): repositórios de tabela de carga no PostgreSQL;
- `FILE_STORAGE_DIR` (TASK-031): diretório local onde o arquivo-fonte é preservado.

Sem qualquer uma delas, `build_load_chart_persistence` devolve `None` e a API sobe sem essas rotas
(como antes), para `app.main` continuar importável sem banco (testes, desenvolvimento sem Docker).
Criar o engine e o armazenamento não conecta ao banco nem cria o diretório.

Os limites do XLSX são PROVISÓRIOS — A VALIDAR (P-008).
"""

import os
from functools import partial

from sqlalchemy import Engine

from app.infrastructure.database.config import DATABASE_URL_ENV_VAR, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.importers.xlsx_resource_limits import (
    XlsxLimits,
    select_limited_load_chart_parser,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_activation_repository import (
    SqlAlchemyLoadChartActivationRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.infrastructure.storage.local_file_storage import LocalFileStorage
from app.presentation.api.load_chart_persistence import LoadChartPersistenceDependencies
from app.presentation.api.upload_limits import UploadLimits


def build_load_chart_persistence(
    engine: Engine | None = None,
) -> LoadChartPersistenceDependencies | None:
    """Dependências das rotas da TASK-031, ou `None` sem `DATABASE_URL`/`FILE_STORAGE_DIR`.

    Com `engine` (composição da TASK-029), reaproveita o mesmo pool em vez de criar outro.
    """
    storage = LocalFileStorage.from_environment()
    if storage is None:
        return None
    if engine is None:
        if not os.environ.get(DATABASE_URL_ENV_VAR, "").strip():
            return None
        # Definida mas inválida: `DatabaseConfigurationError` propaga (erro de configuração claro).
        engine = create_database_engine(DatabaseSettings.from_environment())
    session_factory = create_session_factory(engine)
    return LoadChartPersistenceDependencies(
        parser_selector=partial(select_limited_load_chart_parser, limits=XlsxLimits()),
        repository=SqlAlchemyLoadChartRepository(session_factory),
        activation=SqlAlchemyLoadChartActivationRepository(session_factory),
        file_storage=storage,
        # Limite padrão PROVISÓRIO de 1 MiB por arquivo — A VALIDAR (P-008).
        upload_limits=UploadLimits(),
    )
