"""Seed da demonstração FICTÍCIA contra um PostgreSQL real (TASK-035; marcador `integration`).

Precisa do banco em `head` (`uv run alembic upgrade head`; o CI roda antes do pytest). Cada teste
roda numa transação desfeita no fim; o arquivo-fonte vai para um diretório temporário do pytest. Os
ids levam um sufixo único, para não colidir com uma demonstração já semeada no mesmo banco. Dados
FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.demo_seed import (
    DEMO_FRONT_ZONE,
    DEMO_SIDE_REAR_ZONE,
    DemoSeedIds,
    SeedAction,
    build_demo_crane_geometry,
    build_demo_rotation_zones,
    seed_demo,
)
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.mass import Mass
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_activation_repository import (
    SqlAlchemyLoadChartActivationRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.infrastructure.storage.local_file_storage import LocalFileStorage
from tests.fixtures.crane_geometry_ficticia import state_ficticio
from tests.infrastructure.database.postgres_integration_support import (
    integration_engine,
    rolled_back_session_factory,
)
from tests.test_demo_seed import (
    CABO_M,
    CARGA_FICTICIA_KG,
    ROTEIRO_FICTICIO,
    CenarioFicticio,
    assert_cenario,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def engine() -> Iterator[Engine]:
    yield from integration_engine()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker[Session]]:
    yield from rolled_back_session_factory(engine)


@pytest.fixture
def ids() -> DemoSeedIds:
    suffix = uuid4().hex[:8]
    return DemoSeedIds(
        manufacturer_id=f"demo-ficticio-fabricante-{suffix}",
        crane_id=f"demo-ficticio-guindaste-{suffix}",
        configuration_id=f"demo-ficticio-configuracao-{suffix}",
        load_chart_id=f"demo-ficticio-tabela-v1-{suffix}",
        side_rear_load_chart_id=f"demo-ficticio-tabela-lateral-traseira-v1-{suffix}",
    )


def run_seed(
    session_factory: sessionmaker[Session], storage_dir: Path, ids: DemoSeedIds
) -> list[SeedAction]:
    result = seed_demo(
        SqlAlchemyCraneCatalogRepository(session_factory),
        SqlAlchemyLoadChartRepository(session_factory),
        SqlAlchemyLoadChartActivationRepository(session_factory),
        LocalFileStorage(storage_dir),
        ids=ids,
    )
    return [step.action for step in result.steps]


def test_seed_e_idempotente_no_postgres(
    session_factory: sessionmaker[Session], tmp_path: Path, ids: DemoSeedIds
) -> None:
    first = run_seed(session_factory, tmp_path, ids)
    second = run_seed(session_factory, tmp_path, ids)

    assert first == [
        SeedAction.CREATED,
        SeedAction.CREATED,
        SeedAction.CREATED,
        SeedAction.CREATED,
        SeedAction.ACTIVATED,
        SeedAction.CREATED,
        SeedAction.ACTIVATED,
    ]
    assert second == [
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_ACTIVE,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_ACTIVE,
    ]
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    assert [crane.id for crane in catalog.list_cranes(ids.manufacturer_id)] == [ids.crane_id]
    configurations = catalog.list_configurations(ids.crane_id)
    assert [configuration.id for configuration in configurations] == [ids.configuration_id]
    assert configurations[0].geometry == build_demo_crane_geometry()
    assert configurations[0].rotation_zones == build_demo_rotation_zones()
    charts = SqlAlchemyLoadChartRepository(session_factory)
    for chart_id, zone in (
        (ids.load_chart_id, DEMO_FRONT_ZONE),
        (ids.side_rear_load_chart_id, DEMO_SIDE_REAR_ZONE),
    ):
        stored = charts.get_by_id(chart_id)
        assert stored is not None
        assert stored.chart.status is LoadChartStatus.ACTIVE
        assert stored.chart.rotation_zone_code == zone
        assert stored.source.uri is not None
    assert len(list(tmp_path.iterdir())) == 2


@pytest.mark.parametrize("cenario", ROTEIRO_FICTICIO, ids=lambda cenario: cenario.nome)
def test_valores_do_roteiro_com_os_repositorios_reais(
    session_factory: sessionmaker[Session],
    tmp_path: Path,
    ids: DemoSeedIds,
    cenario: CenarioFicticio,
) -> None:
    run_seed(session_factory, tmp_path, ids)
    catalog = SqlAlchemyCraneCatalogRepository(session_factory)
    use_case = EvaluateOperation(
        crane_geometry_provider=catalog,
        active_load_chart_provider=SqlAlchemyLoadChartRepository(session_factory),
        load_chart_interpolator=ConservativeTabulatedLookup(),
        configuration_load_rules_provider=catalog,
    )

    result = use_case.execute(
        configuration_id=ids.configuration_id,
        state=state_ficticio(
            boom_length_m=cenario.boom_length_m,
            boom_angle_deg=cenario.boom_angle_deg,
            turret_rotation_deg=cenario.turret_rotation_deg,
            cable_length_m=CABO_M,
        ),
        load_weight=Mass(CARGA_FICTICIA_KG),
    )

    assert_cenario(result, cenario)
