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

Nas duas, a estratégia de consulta é a `LinearInterpolationLookup` (ADR-030, provisória), e REST e
WebSocket usam a mesma montagem do `EvaluateOperation` (`build_evaluate_operation`).

Autenticação (TASK-038; ADR-016): só com `DATABASE_URL` (`build_auth`, em `app.auth_composition`,
no mesmo engine). Sem banco não há login e as rotas continuam abertas (ADR-016 § 5).

Catálogo (TASK-030): as rotas de cadastro usam o `SqlAlchemyCraneCatalogRepository` (TASK-022) e só
são registradas quando `DATABASE_URL` está definida (`create_database_app`, no mesmo engine da
avaliação). `build_catalog_repository` hoje só é usado pelos testes (`docs/known-gaps.md` D-002).
As edições do catálogo e a listagem das tabelas de uma configuração (TASK-044) também só existem
com `DATABASE_URL`; a listagem não depende de `FILE_STORAGE_DIR`.

Assistente de IA (TASK-076; ADR-039): `build_ai_assistant` (`app.ai_composition`) liga o Gemini com
`GEMINI_API_KEY`; sem a chave, `GET /ai/status` responde `enabled: false`.

Rodar a API completa, em `backend/`: `uv run uvicorn app.main:app --reload`.
"""

import logging
import os
from collections.abc import Iterator, Mapping

from fastapi import FastAPI
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.ai_composition import build_ai_assistant
from app.application.ports.accessory_repository import AccessoryProvider
from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import (
    ConfigurationLoadRulesProvider,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.crane_limits_provider import CraneLimitsProvider
from app.application.use_cases.compute_operating_area import ComputeOperatingArea
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.application.use_cases.recommend_lift_plan import RecommendLiftPlan
from app.auth_composition import build_auth
from app.domain.entities.load_chart import LoadChart
from app.domain.services.linear_interpolation_lookup import LinearInterpolationLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.safety_profile import SafetyProfile
from app.infrastructure.database.config import DATABASE_URL_ENV_VAR, DatabaseSettings
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.repositories.sqlalchemy_accessory_repository import (
    SqlAlchemyAccessoryRepository,
)
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.infrastructure.repositories.sqlalchemy_scenario_repository import (
    SqlAlchemyScenarioRepository,
)
from app.infrastructure.repositories.sqlalchemy_simulation_recording_repository import (
    SqlAlchemySimulationRecordingRepository,
)
from app.load_chart_persistence_composition import build_load_chart_persistence
from app.presentation.api.evaluations import (
    EvaluateOperationDependency,
    shared_evaluate_operation,
)
from app.presentation.api.health import DatabaseHealthCheck
from app.presentation.api.main import create_app
from app.presentation.api.operating_area import (
    ComputeOperatingAreaDependency,
    shared_compute_operating_area,
)
from app.presentation.api.planning import RecommendLiftPlanDependency
from app.presentation.api.upload_limits import UploadLimits

logger = logging.getLogger(__name__)

load_chart_interpolator = LinearInterpolationLookup()
"""Estratégia de consulta da composição: interpolação linear provisória (ADR-030; PEND-001,
PEND-003), a mesma na avaliação, na área de operação e no planejamento."""


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

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return None


class SafetyProfileFromCraneLimits:
    """Liga a porta de segurança da TASK-055 aos limites do modelo da TASK-051 (leva E)."""

    def __init__(self, crane_limits_provider: CraneLimitsProvider) -> None:
        self._crane_limits_provider = crane_limits_provider

    def get_safety_profile(self, configuration_id: str) -> SafetyProfile | None:
        limits = self._crane_limits_provider.get_crane_limits(configuration_id)
        if limits is None:
            return None
        return SafetyProfile(
            capacity_limit_percent=limits.capacity_limit_percent,
            warning_band_percent=limits.warning_band_percent,
            max_ground_slope_deg=limits.max_ground_slope_deg,
            slope_derating_percent_per_deg=limits.slope_derating_percent_per_deg,
            crane_mass_kg=limits.crane_mass_kg,
            outrigger_pad_area_m2=limits.outrigger_pad_area_m2,
        )


def build_evaluate_operation(
    crane_geometry_provider: CraneGeometryProvider,
    active_load_chart_provider: ActiveLoadChartProvider,
    configuration_load_rules_provider: ConfigurationLoadRulesProvider | None = None,
    crane_limits_provider: CraneLimitsProvider | None = None,
    accessory_provider: AccessoryProvider | None = None,
) -> EvaluateOperation:
    """Monta o caso de uso com a estratégia da composição (a mesma para REST e WebSocket).

    `configuration_load_rules_provider` (TASK-046): zonas de giro e peso do gancho; sem ele, a
    configuração é avaliada sem zonas e sem gancho (composição sem banco).
    `crane_limits_provider` (TASK-051): limite de capacidade do modelo; sem ele, valem os padrões.
    `accessory_provider` (TASK-056): catálogo de acessórios de içamento.
    """
    return EvaluateOperation(
        crane_geometry_provider=crane_geometry_provider,
        active_load_chart_provider=active_load_chart_provider,
        load_chart_interpolator=load_chart_interpolator,
        configuration_load_rules_provider=configuration_load_rules_provider,
        crane_limits_provider=crane_limits_provider,
        safety_profile_provider=(
            SafetyProfileFromCraneLimits(crane_limits_provider)
            if crane_limits_provider is not None
            else None
        ),
        accessory_provider=accessory_provider,
    )


def build_database_evaluate_operation(session_factory: sessionmaker[Session]) -> EvaluateOperation:
    """Caso de uso ligado aos repositórios da TASK-022 sobre `session_factory`."""
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    return build_evaluate_operation(
        catalog,
        SqlAlchemyLoadChartRepository(session_factory),
        catalog,
        catalog,
        SqlAlchemyAccessoryRepository(session_factory),
    )


def build_compute_operating_area(
    crane_geometry_provider: CraneGeometryProvider,
    active_load_chart_provider: ActiveLoadChartProvider,
    configuration_load_rules_provider: ConfigurationLoadRulesProvider | None = None,
    crane_limits_provider: CraneLimitsProvider | None = None,
    accessory_provider: AccessoryProvider | None = None,
) -> ComputeOperatingArea:
    """Área de operação (TASK-055) com a mesma estratégia de consulta da avaliação.

    `accessory_provider` (TASK-094; RN-014): catálogo de acessórios, para somar ao peso comparado
    os mesmos acessórios da avaliação.
    """
    return ComputeOperatingArea(
        crane_geometry_provider=crane_geometry_provider,
        active_load_chart_provider=active_load_chart_provider,
        load_chart_interpolator=load_chart_interpolator,
        configuration_load_rules_provider=configuration_load_rules_provider,
        safety_profile_provider=(
            SafetyProfileFromCraneLimits(crane_limits_provider)
            if crane_limits_provider is not None
            else None
        ),
        accessory_provider=accessory_provider,
    )


def operating_area_per_request(engine: Engine) -> ComputeOperatingAreaDependency:
    """Dependência FastAPI da área de operação: uma conexão do pool por requisição."""

    def provide() -> Iterator[ComputeOperatingArea]:
        with engine.connect() as connection:
            session_factory = sessionmaker(bind=connection)
            catalog = SqlAlchemyCraneCatalogRepository(session_factory)
            yield build_compute_operating_area(
                catalog,
                SqlAlchemyLoadChartRepository(session_factory),
                catalog,
                catalog,
                SqlAlchemyAccessoryRepository(session_factory),
            )

    return provide


def planning_per_request(engine: Engine) -> RecommendLiftPlanDependency:
    """Dependência FastAPI do planejamento (TASK-075): uma conexão do pool por requisição."""

    def provide() -> Iterator[RecommendLiftPlan]:
        with engine.connect() as connection:
            session_factory = sessionmaker(bind=connection)
            yield RecommendLiftPlan(
                catalog=SqlAlchemyCraneCatalogRepository(session_factory),
                active_load_chart_provider=SqlAlchemyLoadChartRepository(session_factory),
                load_chart_interpolator=load_chart_interpolator,
                accessory_provider=SqlAlchemyAccessoryRepository(session_factory),
            )

    return provide


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
        operating_area=operating_area_per_request(engine),
        planning=planning_per_request(engine),
        evaluation_websocket=build_database_evaluate_operation(session_factory),
        database_health_check=database_health_check(engine),
        # Catálogo (TASK-030) e suas edições (TASK-044) no mesmo engine da avaliação: um pool só.
        catalog_repository=SqlAlchemyCraneCatalogRepository(session_factory),
        # Catálogo de acessórios de içamento (TASK-056): mesmo engine.
        accessory_repository=SqlAlchemyAccessoryRepository(session_factory),
        # Listagem das tabelas de uma configuração (TASK-044): só banco, sem FILE_STORAGE_DIR.
        load_chart_listing=SqlAlchemyLoadChartRepository(session_factory),
        # Importação com gravação e ativação (TASK-031): mesmo engine; exige FILE_STORAGE_DIR.
        load_chart_persistence=build_load_chart_persistence(engine),
        # Login, sessões e perfis (TASK-038): mesmo engine.
        auth=build_auth(engine, environ),
        # Gravações de simulação (TASK-057): mesmo engine.
        simulation_recordings=SqlAlchemySimulationRecordingRepository(session_factory),
        # Cenários com terreno e obstáculos (TASK-052): mesmo engine; exigem a autenticação.
        scenario_repository=SqlAlchemyScenarioRepository(session_factory),
        # Assistente de IA (TASK-076; ADR-039): só liga com GEMINI_API_KEY.
        ai_assistant=build_ai_assistant(environ),
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
        operating_area=shared_compute_operating_area(
            build_compute_operating_area(
                UnconfiguredCraneGeometryProvider(), UnconfiguredActiveLoadChartProvider()
            )
        ),
        evaluation_websocket=use_case,
        ai_assistant=build_ai_assistant(),
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
