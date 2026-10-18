"""Seed da demonstração FICTÍCIA contra repositórios em memória (TASK-035).

Confere a idempotência, as mensagens e os valores esperados do roteiro (`docs/demo.md`): cada
cenário de `ROTEIRO_FICTICIO` roda o `EvaluateOperation` real (consulta conservadora provisória,
ADR-015) sobre o que o seed gravou, com as zonas de giro e o gancho FICTÍCIOS (TASK-046). Todos os
dados são FICTÍCIOS (ADR-012).
"""

import dataclasses
import io
from dataclasses import dataclass, replace
from pathlib import Path

import pytest

from app.application.use_cases.activate_load_chart import ActivateLoadChart
from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    NotEvaluableOperation,
)
from app.application.use_cases.import_load_chart import (
    ImportedLoadChart,
    ImportLoadChart,
    RotationZoneRequiredError,
)
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.demo_seed import (
    DEMO_ACCESSORIES,
    DEMO_CONFIGURATION_NAME,
    DEMO_CRANE_MODEL_NAME,
    DEMO_FRONT_ZONE,
    DEMO_HOOK_BLOCK_WEIGHT_KG,
    DEMO_LOAD_CHART_FILE,
    DEMO_LOAD_CHART_SIDE_REAR_FILE,
    DEMO_LOAD_CHART_SIDE_REAR_VERSION,
    DEMO_LOAD_CHART_V2_FILE,
    DEMO_LOAD_CHART_VERSION,
    DEMO_LOAD_CHART_WITH_ERRORS_FILE,
    DEMO_MANUFACTURER_NAME,
    DEMO_SEED_IDS,
    DEMO_SIDE_REAR_ZONE,
    EXIT_CONFIGURATION_ERROR,
    LEGACY_DEMO_CONFIGURATION_NAME,
    LEGACY_DEMO_CRANE_MODEL_NAME,
    LEGACY_DEMO_PIVOT_OFFSET_M,
    LEGACY_MOITAO_MODEL_FILE,
    DemoSeedError,
    DemoSeedResult,
    SeedAction,
    _seed_accessory,
    build_demo_crane_geometry,
    build_demo_rotation_zones,
    main,
    seed_demo,
)
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.mass import Mass
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.crane_geometry_ficticia import state_ficticio
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore

# --- Roteiro FICTÍCIO (docs/demo.md § 5): estado dos sliders, carga e resultado esperado ---

CARGA_FICTICIA_KG = 3000.0
GANCHO_FICTICIO_KG = 200.0
PESO_COMPARADO_KG = CARGA_FICTICIA_KG + GANCHO_FICTICIO_KG
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
    turret_rotation_deg: float = GIRO_DEG
    zone: str = DEMO_FRONT_ZONE


ROTEIRO_FICTICIO = (
    # TASK-069: a = 0,46 m (eixo de giro real do modelo 3D), então R = 0,46 + L·cos θ.
    CenarioFicticio("A: pose inicial", 12.0, 35.0, 10.29, 3800.0, (12.0, 11.0), 84.21),
    CenarioFicticio("B: lança mais alta", 12.0, 60.0, 6.46, 5500.0, (12.0, 8.0), 58.18),
    CenarioFicticio("C: lança estendida", 22.0, 35.0, 18.48, 1200.0, (22.0, 20.0), 266.67),
    # ADR-029: 17,5 m usa a coluna de 22 m; 14,80 m fica entre 14 m (2400) e 16 m (1900 kg).
    CenarioFicticio("D: lança entre colunas", 17.5, 35.0, 14.80, 1900.0, (22.0, 16.0), 168.42),
    CenarioFicticio(
        "E: raio acima da tabela", 22.0, 0.0, 22.46, reasons=("RADIUS_ABOVE_CHART_MAX",)
    ),
    CenarioFicticio(
        "F: giro para trás",
        12.0,
        35.0,
        10.29,
        3040.0,
        (12.0, 11.0),
        105.26,
        turret_rotation_deg=180.0,
        zone=DEMO_SIDE_REAR_ZONE,
    ),
    CenarioFicticio(
        "G: giro na fronteira",
        12.0,
        35.0,
        10.29,
        3040.0,
        (12.0, 11.0),
        105.26,
        turret_rotation_deg=55.0,
        zone=DEMO_SIDE_REAR_ZONE,
    ),
)
"""Valores arredondados a 2 casas, como em `docs/demo.md`: carga FICTÍCIA de 3 000 kg + gancho
FICTÍCIO de 200 kg = 3 200 kg comparados; ativas a v1 (frontal) e a lateral/traseira v1."""

CENARIO_A_COM_V2 = CenarioFicticio("A com a v2", 12.0, 35.0, 10.29, 3420.0, (12.0, 11.0), 93.57)
CENARIO_F_COM_V2 = ROTEIRO_FICTICIO[5]
"""Com a v2 ativa na zona frontal, a zona lateral/traseira não muda (troca por zona)."""

ERROS_ESPERADOS = (
    ("CONFLICTING_POINTS", 2, None),
    ("INVALID_NUMBER", 3, "working_radius_m"),
    ("NEGATIVE_VALUE", 4, "max_capacity_kg"),
    ("EMPTY_VALUE", 5, "max_capacity_kg"),
    ("CONFLICTING_POINTS", 6, None),
)
"""Relatório de `tabela_carga_ficticia_demo_com_erros.csv` (código, linha, coluna), na ordem."""


def evaluate(
    catalog: InMemoryCraneCatalog, charts: InMemoryLoadChartStore, cenario: CenarioFicticio
) -> EvaluatedOperation | NotEvaluableOperation:
    use_case = EvaluateOperation(
        crane_geometry_provider=catalog,
        active_load_chart_provider=charts,
        load_chart_interpolator=ConservativeTabulatedLookup(),
        configuration_load_rules_provider=catalog,
    )
    return use_case.execute(
        configuration_id=DEMO_SEED_IDS.configuration_id,
        state=state_ficticio(
            boom_length_m=cenario.boom_length_m,
            boom_angle_deg=cenario.boom_angle_deg,
            turret_rotation_deg=cenario.turret_rotation_deg,
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
    assert result.rotation_zone is not None and result.rotation_zone.code == cenario.zone
    assert result.hook_block_weight == Mass(GANCHO_FICTICIO_KG)
    assert result.compared_weight == Mass(PESO_COMPARADO_KG)
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

    def evaluate(self, cenario: CenarioFicticio) -> EvaluatedOperation | NotEvaluableOperation:
        return evaluate(self.catalog, self.charts, cenario)


@pytest.fixture
def demo() -> Demo:
    return Demo()


def test_primeira_execucao_cria_catalogo_e_ativa_tabela_ficticia(demo: Demo) -> None:
    result = demo.seed()

    assert [(step.entity, step.entry_id, step.action) for step in result.steps] == [
        ("fabricante", DEMO_SEED_IDS.manufacturer_id, SeedAction.CREATED),
        ("guindaste", DEMO_SEED_IDS.crane_id, SeedAction.CREATED),
        ("configuração", DEMO_SEED_IDS.configuration_id, SeedAction.CREATED),
        ("tabela de carga", DEMO_SEED_IDS.load_chart_id, SeedAction.CREATED),
        ("tabela de carga", DEMO_SEED_IDS.load_chart_id, SeedAction.ACTIVATED),
        ("tabela de carga", DEMO_SEED_IDS.side_rear_load_chart_id, SeedAction.CREATED),
        ("tabela de carga", DEMO_SEED_IDS.side_rear_load_chart_id, SeedAction.ACTIVATED),
    ]
    assert result.changed
    assert demo.catalog.manufacturers[DEMO_SEED_IDS.manufacturer_id].name == DEMO_MANUFACTURER_NAME
    assert demo.catalog.cranes[DEMO_SEED_IDS.crane_id].model_name == DEMO_CRANE_MODEL_NAME
    configuration = demo.catalog.configurations[DEMO_SEED_IDS.configuration_id]
    assert configuration.name == DEMO_CONFIGURATION_NAME
    assert configuration.geometry == build_demo_crane_geometry()
    assert configuration.rotation_zones == build_demo_rotation_zones()
    assert configuration.hook_block_weight == Mass(DEMO_HOOK_BLOCK_WEIGHT_KG)
    stored = demo.charts.charts[DEMO_SEED_IDS.load_chart_id]
    assert stored.chart.status is LoadChartStatus.ACTIVE
    assert stored.chart.version == DEMO_LOAD_CHART_VERSION
    assert stored.chart.rotation_zone_code == DEMO_FRONT_ZONE
    assert len(stored.chart.points) == 27
    assert stored.source.file_name == DEMO_LOAD_CHART_FILE.name
    assert stored.source.file_type == "text/csv"
    side = demo.charts.charts[DEMO_SEED_IDS.side_rear_load_chart_id]
    assert side.chart.status is LoadChartStatus.ACTIVE
    assert side.chart.version == DEMO_LOAD_CHART_SIDE_REAR_VERSION
    assert side.chart.rotation_zone_code == DEMO_SIDE_REAR_ZONE
    assert side.source.file_name == DEMO_LOAD_CHART_SIDE_REAR_FILE.name
    assert demo.storage.saves == 2


def test_zonas_e_gancho_ficticios_da_demonstracao() -> None:
    zones = build_demo_rotation_zones()

    assert [(zone.code, zone.start_deg, zone.end_deg) for zone in zones.zones] == [
        (DEMO_FRONT_ZONE, 305.0, 55.0),
        (DEMO_SIDE_REAR_ZONE, 55.0, 305.0),
    ]
    assert [zone.span_deg for zone in zones.zones] == pytest.approx([110.0, 250.0])
    assert [zone.name for zone in zones.zones] == ["Frontal", "Lateral e traseira"]
    assert DEMO_HOOK_BLOCK_WEIGHT_KG == GANCHO_FICTICIO_KG


def test_tabela_lateral_traseira_e_a_v1_vezes_0_8() -> None:
    parser = CsvLoadChartParser()
    front = parser.parse(DEMO_LOAD_CHART_FILE.read_bytes()).points
    side = parser.parse(DEMO_LOAD_CHART_SIDE_REAR_FILE.read_bytes()).points

    assert [(p.point.boom_length, p.point.working_radius) for p in side] == [
        (p.point.boom_length, p.point.working_radius) for p in front
    ]
    for front_point, side_point in zip(front, side, strict=True):
        assert side_point.point.max_capacity.kilograms == pytest.approx(
            front_point.point.max_capacity.kilograms * 0.8
        )


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
        SeedAction.ALREADY_EXISTS,
        SeedAction.ALREADY_ACTIVE,
    ]
    assert not result.changed
    assert len(demo.catalog.manufacturers) == 1
    assert len(demo.catalog.cranes) == 1
    assert len(demo.catalog.configurations) == 1
    assert demo.charts.charts == charts_before
    assert demo.storage.saves == 2


def test_tabela_em_draft_de_execucao_interrompida_e_ativada(demo: Demo) -> None:
    demo.seed()
    demo.charts._set(DEMO_SEED_IDS.side_rear_load_chart_id, LoadChartStatus.DRAFT)

    result = demo.seed()

    assert result.steps[-1].action is SeedAction.ACTIVATED
    assert demo.charts.status_of(DEMO_SEED_IDS.side_rear_load_chart_id) is LoadChartStatus.ACTIVE


def test_tabela_substituida_pela_v2_nao_e_reativada(demo: Demo) -> None:
    demo.seed()
    importar_e_ativar_v2(demo)

    result = demo.seed()

    assert result.steps[4].action is SeedAction.SUPERSEDED_KEPT
    assert result.steps[-1].action is SeedAction.ALREADY_ACTIVE
    assert not result.changed
    assert demo.charts.status_of(DEMO_SEED_IDS.load_chart_id) is LoadChartStatus.SUPERSEDED
    assert demo.charts.status_of(DEMO_SEED_IDS.side_rear_load_chart_id) is LoadChartStatus.ACTIVE


def test_configuracao_semeada_antes_das_zonas_nao_e_sobrescrita(demo: Demo) -> None:
    demo.seed()
    configuration = demo.catalog.configurations[DEMO_SEED_IDS.configuration_id]
    demo.catalog.configurations[configuration.id] = dataclasses.replace(
        configuration, rotation_zones=None, hook_block_weight=None
    )

    with pytest.raises(DemoSeedError, match="TASK-046"):
        demo.seed()


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
    demo.catalog.configurations[configuration.id] = dataclasses.replace(
        configuration, geometry=other
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

    assert geometry.boom_pivot_offset_m == 0.46
    assert geometry.boom_pivot_height.meters == 3.3
    assert (geometry.boom_length_min.meters, geometry.boom_length_max.meters) == (12.0, 22.0)
    assert (geometry.boom_angle_min.degrees, geometry.boom_angle_max.degrees) == (0.0, 80.0)
    assert geometry.cable_length_min.meters == 1.0
    assert geometry.cable_length_max is not None and geometry.cable_length_max.meters == 15.0
    assert geometry.turret_rotation_min is None and geometry.turret_rotation_max is None


@pytest.mark.parametrize("cenario", ROTEIRO_FICTICIO, ids=lambda cenario: cenario.nome)
def test_valores_esperados_do_roteiro(demo: Demo, cenario: CenarioFicticio) -> None:
    demo.seed()

    assert_cenario(demo.evaluate(cenario), cenario)


def importar_e_ativar_v2(demo: Demo) -> None:
    result = ImportLoadChart(demo.charts, demo.storage, demo.catalog).execute(
        DEMO_LOAD_CHART_V2_FILE.read_bytes(),
        parser=CsvLoadChartParser(),
        file_name=DEMO_LOAD_CHART_V2_FILE.name,
        file_type="text/csv",
        load_chart_id="demo-ficticio-tabela-v2",
        version="demo-ficticia-v2",
        configuration_id=DEMO_SEED_IDS.configuration_id,
        rotation_zone_code=DEMO_FRONT_ZONE,
    )
    assert isinstance(result, ImportedLoadChart)
    activation = ActivateLoadChart(demo.charts, demo.charts).execute("demo-ficticio-tabela-v2")
    assert activation.superseded_load_chart_id == DEMO_SEED_IDS.load_chart_id


def test_roteiro_ativar_v2_muda_a_capacidade_so_na_zona_frontal(demo: Demo) -> None:
    demo.seed()
    importar_e_ativar_v2(demo)

    assert_cenario(demo.evaluate(CENARIO_A_COM_V2), CENARIO_A_COM_V2)
    assert_cenario(demo.evaluate(CENARIO_F_COM_V2), CENARIO_F_COM_V2)


def test_roteiro_importar_sem_zona_e_recusado(demo: Demo) -> None:
    demo.seed()

    with pytest.raises(RotationZoneRequiredError):
        ImportLoadChart(demo.charts, demo.storage, demo.catalog).execute(
            DEMO_LOAD_CHART_V2_FILE.read_bytes(),
            parser=CsvLoadChartParser(),
            file_name=DEMO_LOAD_CHART_V2_FILE.name,
            file_type="text/csv",
            load_chart_id="demo-ficticio-tabela-v2",
            version="demo-ficticia-v2",
            configuration_id=DEMO_SEED_IDS.configuration_id,
        )


def test_roteiro_tabela_com_erros_gera_relatorio(demo: Demo) -> None:
    demo.seed()

    result = ImportLoadChart(demo.charts, demo.storage, demo.catalog).execute(
        DEMO_LOAD_CHART_WITH_ERRORS_FILE.read_bytes(),
        parser=CsvLoadChartParser(),
        file_name=DEMO_LOAD_CHART_WITH_ERRORS_FILE.name,
        file_type="text/csv",
        load_chart_id="demo-ficticio-tabela-com-erros",
        version="demo-ficticia-com-erros",
        configuration_id=DEMO_SEED_IDS.configuration_id,
        rotation_zone_code=DEMO_FRONT_ZONE,
    )

    assert isinstance(result, InvalidLoadChartImport)
    issues = tuple((str(issue.code), issue.line, issue.column) for issue in result.issues)
    assert issues == ERROS_ESPERADOS
    assert "demo-ficticio-tabela-com-erros" not in demo.charts.charts


def test_arquivos_de_demonstracao_sao_rotulados_ficticios() -> None:
    for path in (
        DEMO_LOAD_CHART_FILE,
        DEMO_LOAD_CHART_SIDE_REAR_FILE,
        DEMO_LOAD_CHART_V2_FILE,
        DEMO_LOAD_CHART_WITH_ERRORS_FILE,
    ):
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


def test_ficha_e_nomes_anteriores_a_task_069_sao_migrados(demo: Demo) -> None:
    # Banco semeado antes da TASK-069 (ex.: Render): a ficha tinha a = −1,56 m. O seed troca só a
    # ficha, sem falhar na subida do serviço.
    demo.seed()
    configuration = demo.catalog.get_configuration(DEMO_SEED_IDS.configuration_id)
    assert configuration is not None
    legacy = replace(
        configuration,
        name=LEGACY_DEMO_CONFIGURATION_NAME,
        geometry=replace(configuration.geometry, boom_pivot_offset_m=LEGACY_DEMO_PIVOT_OFFSET_M),
    )
    demo.catalog.update_configuration(legacy)
    crane = demo.catalog.get_crane(DEMO_SEED_IDS.crane_id)
    assert crane is not None
    demo.catalog.update_crane(replace(crane, model_name=LEGACY_DEMO_CRANE_MODEL_NAME))

    result = demo.seed()

    steps = {(step.entity, step.action) for step in result.steps}
    assert ("configuração", SeedAction.UPDATED) in steps
    migrated = demo.catalog.get_configuration(DEMO_SEED_IDS.configuration_id)
    assert migrated is not None
    assert migrated.geometry == build_demo_crane_geometry()
    assert migrated.name == DEMO_CONFIGURATION_NAME
    assert ("guindaste", SeedAction.RENAMED) in steps
    renamed_crane = demo.catalog.get_crane(DEMO_SEED_IDS.crane_id)
    assert renamed_crane is not None
    assert renamed_crane.model_name == DEMO_CRANE_MODEL_NAME


class _AccessoryRepo:
    """Repositório de acessórios em memória, só o que o seed usa."""

    def __init__(self, *items: Accessory) -> None:
        self.items = {item.id: item for item in items}

    def get(self, accessory_id: str) -> Accessory | None:
        return self.items.get(accessory_id)

    def add(self, accessory: Accessory) -> None:
        self.items[accessory.id] = accessory

    def update(self, accessory: Accessory) -> bool:
        if accessory.id not in self.items:
            return False
        self.items[accessory.id] = accessory
        return True


def _moitao() -> Accessory:
    return next(item for item in DEMO_ACCESSORIES if item.type is AccessoryType.HOOK_BLOCK)


def test_moitao_do_seed_nao_aponta_para_a_casa() -> None:
    assert _moitao().model_file is None
    assert _moitao().credit is None


def test_banco_com_o_modelo_errado_do_moitao_fica_pendente_sem_perder_edicoes() -> None:
    editado = replace(
        _moitao(),
        name="Moitão do cliente",
        weight=Mass(400.0),
        model_file=LEGACY_MOITAO_MODEL_FILE,
        credit="Harmony-RS",
        license="CC BY 4.0",
    )
    repo = _AccessoryRepo(editado)

    step = _seed_accessory(repo, _moitao())  # type: ignore[arg-type]

    assert step.action is SeedAction.MODEL_CLEARED
    atual = repo.items[editado.id]
    assert (atual.model_file, atual.credit, atual.license) == (None, None, None)
    assert (atual.name, atual.weight) == ("Moitão do cliente", Mass(400.0))
    # Rodar de novo não altera mais nada.
    assert _seed_accessory(repo, _moitao()).action is SeedAction.ALREADY_EXISTS  # type: ignore[arg-type]
