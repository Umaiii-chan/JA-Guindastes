"""Seed da demonstração FICTÍCIA contra repositórios em memória (TASK-035).

Confere a idempotência, as mensagens e os valores esperados do roteiro (`docs/demo.md`): cada
cenário de `ROTEIRO_FICTICIO` roda o `EvaluateOperation` real (consulta conservadora provisória,
ADR-015) sobre o que o seed gravou. Todos os dados são FICTÍCIOS (ADR-012).
"""

import io
from dataclasses import dataclass
from pathlib import Path

import pytest

from app.application.use_cases.activate_load_chart import ActivateLoadChart
from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
)
from app.application.use_cases.import_load_chart import ImportedLoadChart, ImportLoadChart
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.demo_seed import (
    DEMO_CONFIGURATION_NAME,
    DEMO_CRANE_MODEL_NAME,
    DEMO_LOAD_CHART_FILE,
    DEMO_LOAD_CHART_V2_FILE,
    DEMO_LOAD_CHART_VERSION,
    DEMO_LOAD_CHART_WITH_ERRORS_FILE,
    DEMO_MANUFACTURER_NAME,
    DEMO_SEED_IDS,
    EXIT_CONFIGURATION_ERROR,
    DemoSeedError,
    DemoSeedResult,
    SeedAction,
    build_demo_crane_geometry,
    main,
    seed_demo,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.mass import Mass
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.crane_geometry_ficticia import state_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore

# --- Roteiro FICTÍCIO (docs/demo.md § 5): estado dos sliders, carga e resultado esperado ---

CARGA_FICTICIA_KG = 3000.0
GIRO_DEG = 0.0
CABO_M = 5.0


@dataclass(frozen=True)
class CenarioFicticio:
    nome: str
    boom_length_m: float
    boom_angle_deg: float
    working_radius_m: float
    capacity_kg: float | None = None
    used_point: tuple[float, float] | None = None
    utilization_percent: float | None = None
    reasons: tuple[str, ...] = ()


ROTEIRO_FICTICIO = (
    CenarioFicticio("A: pose inicial", 12.0, 35.0, 8.27, 4200.0, (12.0, 10.0), 71.43),
    CenarioFicticio("B: lança mais alta", 12.0, 60.0, 4.44, 7000.0, (12.0, 6.0), 42.86),
    CenarioFicticio("C: lança estendida", 22.0, 35.0, 16.46, 1500.0, (22.0, 18.0), 200.00),
    CenarioFicticio(
        "D: lança fora da tabela", 17.5, 35.0, 12.78, reasons=("BOOM_LENGTH_NOT_IN_CHART",)
    ),
    CenarioFicticio(
        "E: raio abaixo da tabela", 12.0, 80.0, 0.52, reasons=("RADIUS_BELOW_CHART_MIN",)
    ),
)
"""Valores arredondados a 2 casas, como em `docs/demo.md`; a tabela ativa é a v1."""

CENARIO_A_COM_V2 = CenarioFicticio("A com a v2", 12.0, 35.0, 8.27, 3780.0, (12.0, 10.0), 79.37)

ERROS_ESPERADOS = (
    ("CONFLICTING_POINTS", 2, None),
    ("INVALID_NUMBER", 3, "working_radius_m"),
    ("NEGATIVE_VALUE", 4, "max_capacity_kg"),
    ("EMPTY_VALUE", 5, "max_capacity_kg"),
    ("CONFLICTING_POINTS", 6, None),
)
"""Relatório de `tabela_carga_ficticia_demo_com_erros.csv` (código, linha, coluna), na ordem."""


class DemoProviders:
    """Adapta os fakes às portas da avaliação (ficha técnica e tabela ativa)."""

    def __init__(self, catalog: InMemoryCraneCatalog, charts: InMemoryLoadChartStore) -> None:
        self._catalog = catalog
        self._charts = charts

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        configuration = self._catalog.get_configuration(configuration_id)
        return None if configuration is None else configuration.geometry

    def get_active_load_chart(self, configuration_id: str) -> LoadChart | None:
        for stored in self._charts.charts.values():
            chart = stored.chart
            if (
                chart.configuration_id == configuration_id
                and chart.status is LoadChartStatus.ACTIVE
            ):
                return chart
        return None


def evaluate(
    providers: DemoProviders, cenario: CenarioFicticio
) -> EvaluatedOperation | NotEvaluableOperation:
    use_case = EvaluateOperation(
        crane_geometry_provider=providers,
        active_load_chart_provider=providers,
        load_chart_interpolator=ConservativeTabulatedLookup(),
    )
    return use_case.execute(
        configuration_id=DEMO_SEED_IDS.configuration_id,
        state=state_ficticio(
            boom_length_m=cenario.boom_length_m,
            boom_angle_deg=cenario.boom_angle_deg,
            turret_rotation_deg=GIRO_DEG,
            cable_length_m=CABO_M,
        ),
        load_weight=Mass(CARGA_FICTICIA_KG),
    )


def assert_cenario(
    result: EvaluatedOperation | NotEvaluableOperation, cenario: CenarioFicticio
) -> None:
    assert result.geometry is not None
    assert result.geometry.working_radius.meters == pytest.approx(
        cenario.working_radius_m, abs=0.005
    )
    if cenario.reasons:
        assert isinstance(result, NotEvaluableOperation)
        assert tuple(str(reason) for reason in result.reasons) == cenario.reasons
        return
    assert isinstance(result, EvaluatedOperation)
    assert result.capacity.max_capacity.kilograms == cenario.capacity_kg
    used = result.capacity.used_point  # type: ignore[attr-defined]
    assert (used.boom_length.meters, used.working_radius.meters) == cenario.used_point
    assert result.utilization_percent == pytest.approx(cenario.utilization_percent, abs=0.005)


class Demo:
    def __init__(self) -> None:
        self.catalog = InMemoryCraneCatalog()
        self.charts = InMemoryLoadChartStore({DEMO_SEED_IDS.configuration_id})
        self.storage = InMemoryFileStorage()

    def seed(self) -> DemoSeedResult:
        return seed_demo(self.catalog, self.charts, self.charts, self.storage)

    @property
    def providers(self) -> DemoProviders:
        return DemoProviders(self.catalog, self.charts)


@pytest.fixture
def demo() -> Demo:
    return Demo()


def test_primeira_execucao_cria_catalogo_e_ativa_tabela_ficticia(demo: Demo) -> None:
    result = demo.seed()

    assert [(step.entity, step.action) for step in result.steps] == [
        ("fabricante", SeedAction.CREATED),
        ("guindaste", SeedAction.CREATED),
        ("configuração", SeedAction.CREATED),
        ("tabela de carga", SeedAction.CREATED),
        ("tabela de carga", SeedAction.ACTIVATED),
    ]
    assert result.changed
    assert demo.catalog.manufacturers[DEMO_SEED_IDS.manufacturer_id].name == DEMO_MANUFACTURER_NAME
    assert demo.catalog.cranes[DEMO_SEED_IDS.crane_id].model_name == DEMO_CRANE_MODEL_NAME
    configuration = demo.catalog.configurations[DEMO_SEED_IDS.configuration_id]
    assert configuration.name == DEMO_CONFIGURATION_NAME
    assert configuration.geometry == build_demo_crane_geometry()
    stored = demo.charts.charts[DEMO_SEED_IDS.load_chart_id]
    assert stored.chart.status is LoadChartStatus.ACTIVE
    assert stored.chart.version == DEMO_LOAD_CHART_VERSION
    assert len(stored.chart.points) == 27
    assert stored.source.file_name == DEMO_LOAD_CHART_FILE.name
    assert stored.source.file_type == "text/csv"
    assert demo.storage.saves == 1


def test_segunda_execucao_nao_duplica_nem_altera(demo: Demo) -> None:
    demo.seed()
    charts_before = dict(demo.charts.charts)

    result = demo.seed()

    assert [step.action for step in result.steps] == [
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_ACTIVE,
    ]
    assert not result.changed
    assert len(demo.catalog.manufacturers) == 1
    assert len(demo.catalog.cranes) == 1
    assert len(demo.catalog.configurations) == 1
    assert demo.charts.charts == charts_before
    assert demo.storage.saves == 1


def test_tabela_em_draft_de_execucao_interrompida_e_ativada(demo: Demo) -> None:
    demo.seed()
    demo.charts._set(DEMO_SEED_IDS.load_chart_id, LoadChartStatus.DRAFT)

    result = demo.seed()

    assert result.steps[-1].action is SeedAction.ACTIVATED
    assert demo.charts.status_of(DEMO_SEED_IDS.load_chart_id) is LoadChartStatus.ACTIVE


def test_tabela_substituida_pela_v2_nao_e_reativada(demo: Demo) -> None:
    demo.seed()
    importar_e_ativar_v2(demo)

    result = demo.seed()

    assert result.steps[-1].action is SeedAction.SUPERSEDED_KEPT
    assert not result.changed
    assert demo.charts.status_of(DEMO_SEED_IDS.load_chart_id) is LoadChartStatus.SUPERSEDED


def test_configuracao_existente_com_outra_ficha_nao_e_sobrescrita(demo: Demo) -> None:
    demo.seed()
    configuration = demo.catalog.configurations[DEMO_SEED_IDS.configuration_id]
    other = CraneGeometry(
        boom_pivot_offset_m=0.0,
        boom_pivot_height=configuration.geometry.boom_pivot_height,  # type: ignore[union-attr]
        boom_length_min=configuration.geometry.boom_length_min,  # type: ignore[union-attr]
        boom_length_max=configuration.geometry.boom_length_max,  # type: ignore[union-attr]
        boom_angle_min=configuration.geometry.boom_angle_min,  # type: ignore[union-attr]
        boom_angle_max=configuration.geometry.boom_angle_max,  # type: ignore[union-attr]
        cable_length_min=configuration.geometry.cable_length_min,  # type: ignore[union-attr]
    )
    demo.catalog.configurations[configuration.id] = type(configuration)(
        id=configuration.id,
        crane_id=configuration.crane_id,
        name=configuration.name,
        geometry=other,
    )

    with pytest.raises(DemoSeedError, match="não sobrescreve"):
        demo.seed()


def test_tabela_de_demonstracao_invalida_nao_grava_nada(demo: Demo) -> None:
    content = DEMO_LOAD_CHART_WITH_ERRORS_FILE.read_bytes()

    with pytest.raises(DemoSeedError, match="não passou na validação"):
        seed_demo(demo.catalog, demo.charts, demo.charts, demo.storage, load_chart_content=content)

    assert demo.charts.charts == {}
    assert demo.storage.saves == 0


def test_ficha_ficticia_bate_com_o_modelo_3d_ilustrativo() -> None:
    geometry = build_demo_crane_geometry()

    assert geometry.boom_pivot_offset_m == -1.56
    assert geometry.boom_pivot_height.meters == 3.3
    assert (geometry.boom_length_min.meters, geometry.boom_length_max.meters) == (12.0, 22.0)
    assert (geometry.boom_angle_min.degrees, geometry.boom_angle_max.degrees) == (0.0, 80.0)
    assert geometry.cable_length_min.meters == 1.0
    assert geometry.cable_length_max is not None and geometry.cable_length_max.meters == 15.0
    assert geometry.turret_rotation_min is None and geometry.turret_rotation_max is None


@pytest.mark.parametrize("cenario", ROTEIRO_FICTICIO, ids=lambda cenario: cenario.nome)
def test_valores_esperados_do_roteiro(demo: Demo, cenario: CenarioFicticio) -> None:
    demo.seed()

    assert_cenario(evaluate(demo.providers, cenario), cenario)


def importar_e_ativar_v2(demo: Demo) -> None:
    result = ImportLoadChart(demo.charts, demo.storage).execute(
        DEMO_LOAD_CHART_V2_FILE.read_bytes(),
        parser=CsvLoadChartParser(),
        file_name=DEMO_LOAD_CHART_V2_FILE.name,
        file_type="text/csv",
        load_chart_id="demo-ficticio-tabela-v2",
        version="demo-ficticia-v2",
        configuration_id=DEMO_SEED_IDS.configuration_id,
    )
    assert isinstance(result, ImportedLoadChart)
    activation = ActivateLoadChart(demo.charts, demo.charts).execute("demo-ficticio-tabela-v2")
    assert activation.superseded_load_chart_id == DEMO_SEED_IDS.load_chart_id


def test_roteiro_ativar_v2_muda_a_capacidade(demo: Demo) -> None:
    demo.seed()
    importar_e_ativar_v2(demo)

    assert_cenario(evaluate(demo.providers, CENARIO_A_COM_V2), CENARIO_A_COM_V2)


def test_roteiro_tabela_com_erros_gera_relatorio(demo: Demo) -> None:
    demo.seed()

    result = ImportLoadChart(demo.charts, demo.storage).execute(
        DEMO_LOAD_CHART_WITH_ERRORS_FILE.read_bytes(),
        parser=CsvLoadChartParser(),
        file_name=DEMO_LOAD_CHART_WITH_ERRORS_FILE.name,
        file_type="text/csv",
        load_chart_id="demo-ficticio-tabela-com-erros",
        version="demo-ficticia-com-erros",
        configuration_id=DEMO_SEED_IDS.configuration_id,
    )

    assert isinstance(result, InvalidLoadChartImport)
    issues = tuple((str(issue.code), issue.line, issue.column) for issue in result.issues)
    assert issues == ERROS_ESPERADOS
    assert "demo-ficticio-tabela-com-erros" not in demo.charts.charts


def test_arquivos_de_demonstracao_sao_rotulados_ficticios() -> None:
    for path in (DEMO_LOAD_CHART_FILE, DEMO_LOAD_CHART_V2_FILE, DEMO_LOAD_CHART_WITH_ERRORS_FILE):
        assert "ficticia" in path.name
    readme = (DEMO_LOAD_CHART_FILE.parent / "README.md").read_text(encoding="utf-8")
    assert "FICTÍCIO" in readme


@pytest.mark.parametrize(
    ("environ", "expected"),
    [
        ({}, "defina DATABASE_URL"),
        ({"DATABASE_URL": "postgresql+psycopg://u:p@localhost:5432/db"}, "defina FILE_STORAGE_DIR"),
    ],
)
def test_linha_de_comando_sem_configuracao_falha_com_mensagem_clara(
    environ: dict[str, str], expected: str
) -> None:
    out = io.StringIO()

    exit_code = main([], environ=environ, out=out)

    assert exit_code == EXIT_CONFIGURATION_ERROR
    assert expected in out.getvalue()
    assert "FICTÍCIOS" in out.getvalue()


def test_linha_de_comando_com_url_invalida_nao_repete_a_url(tmp_path: Path) -> None:
    out = io.StringIO()
    environ = {"DATABASE_URL": "nao-e-url-segredo", "FILE_STORAGE_DIR": str(tmp_path)}

    exit_code = main([], environ=environ, out=out)

    assert exit_code == EXIT_CONFIGURATION_ERROR
    assert "nao-e-url-segredo" not in out.getvalue()
