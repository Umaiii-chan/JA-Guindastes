"""Seed da demonstração reproduzível — dados FICTÍCIOS (TASK-035; doc-fonte § 23, Estação 5).

FICTÍCIO: fabricante, guindaste, configuração, ficha técnica e tabela de carga deste módulo são
inventados só para a demonstração. Nenhum número vem de ficha técnica ou tabela de fabricante, e
nada aqui pode ser apresentado como capacidade real (ADR-012; ADR-013 C-4, regra 2).

Cadastra, pelos casos de uso e repositórios existentes:

1. fabricante, guindaste e configuração FICTÍCIOS (`ManageCraneCatalog`, TASK-030), com a ficha
   técnica compatível com o modelo 3D ilustrativo do guindaste sobre caminhão
   (`frontend/public/models/guindaste-80t.glb`, TASK-069): a = 0,46 m, h = 3,3 m e as
   faixas dos sliders (lança 12–22 m, inclinação 0–80°, cabo 1–15 m, giro contínuo). Desde a
   TASK-046 (ADR-018), a configuração tem duas zonas de giro FICTÍCIAS, `FRONTAL` (305° a 55°) e
   `LATERAL_TRASEIRA` (55° a 305°), no formato "frontal 110° + lateral e traseira 250°", e um peso
   de gancho FICTÍCIO de 200 kg;
2. as tabelas de carga FICTÍCIAS, importadas pelo fluxo real (`ImportLoadChart`: zona conferida,
   validação, arquivo-fonte preservado, gravação em `DRAFT`) e ativadas (`ActivateLoadChart`), uma
   por zona:
   - `demo_data/tabela_carga_ficticia_demo_v1.csv` na zona `FRONTAL`;
   - `demo_data/tabela_carga_ficticia_demo_lateral_traseira_v1.csv` (a v1 com a capacidade × 0,8)
     na zona `LATERAL_TRASEIRA`.

**Idempotente:** os ids são fixos (`DemoSeedIds`); o que já existe não é recriado nem duplicado, e
cada passo diz se criou, se já existia ou se ativou. A tabela de demonstração já substituída por
outra versão (`SUPERSEDED`, depois do passo "ativar outra versão" do roteiro) não é reativada:
reativar `SUPERSEDED` não está no fluxo da doc-fonte § 13.2; para recomeçar do zero, recrie o banco
(`docs/demo.md`).

É parte da raiz de composição, como `app.main`: fica fora das camadas do import-linter e nenhum
módulo das camadas deve importá-lo.

Rodar, em `backend/`, com `DATABASE_URL` e `FILE_STORAGE_DIR` definidas e o banco em `head`:

    uv run python -m app.demo_seed

No Docker Compose: `docker compose run --rm backend sh -c "alembic upgrade head && python -m
app.demo_seed"` (ver `docs/demo.md`).
"""

import os
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from enum import StrEnum
from pathlib import Path
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError

from app.application.ports.accessory_repository import AccessoryRepository
from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.file_storage import FileStorageError, FileStoragePort
from app.application.ports.load_chart_activation import LoadChartActivationRepository
from app.application.ports.load_chart_repository import LoadChartRepository
from app.application.use_cases.activate_load_chart import ActivateLoadChart
from app.application.use_cases.crane_catalog import ManageCraneCatalog
from app.application.use_cases.import_load_chart import ImportLoadChart
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones
from app.infrastructure.database.config import (
    DATABASE_URL_ENV_VAR,
    DatabaseConfigurationError,
    DatabaseSettings,
)
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.load_chart_parser_selector import CSV_CONTENT_TYPE
from app.infrastructure.repositories.sqlalchemy_accessory_repository import (
    SqlAlchemyAccessoryRepository,
)
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_activation_repository import (
    SqlAlchemyLoadChartActivationRepository,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
)
from app.infrastructure.storage.local_file_storage import (
    FILE_STORAGE_DIR_ENV_VAR,
    LocalFileStorage,
)

DEMO_DATA_DIR = Path(__file__).resolve().parent / "demo_data"
"""Pasta dos arquivos FICTÍCIOS da demonstração (ver `demo_data/README.md`)."""

DEMO_LOAD_CHART_FILE = DEMO_DATA_DIR / "tabela_carga_ficticia_demo_v1.csv"
"""Tabela de carga FICTÍCIA da zona frontal, importada e ativada pelo seed."""

DEMO_LOAD_CHART_SIDE_REAR_FILE = (
    DEMO_DATA_DIR / "tabela_carga_ficticia_demo_lateral_traseira_v1.csv"
)
"""Tabela FICTÍCIA da zona lateral e traseira (a v1 × 0,8), importada e ativada pelo seed."""

DEMO_LOAD_CHART_V2_FILE = DEMO_DATA_DIR / "tabela_carga_ficticia_demo_v2.csv"
"""Segunda versão FICTÍCIA da zona frontal, importada à mão no roteiro (troca de versão)."""

DEMO_LOAD_CHART_WITH_ERRORS_FILE = DEMO_DATA_DIR / "tabela_carga_ficticia_demo_com_erros.csv"
"""Tabela FICTÍCIA com inconsistências, para mostrar o relatório de erros no roteiro."""

DEMO_MANUFACTURER_NAME = "Fabricante de Demonstração"
DEMO_CRANE_MODEL_NAME = "Guindaste Telescópico 80 t"
DEMO_CONFIGURATION_NAME = "Configuração padrão"

# Nomes anteriores à TASK-069; o seed troca pelos atuais num banco já semeado (Render, Docker).
LEGACY_DEMO_MANUFACTURER_NAME = "Fabricante Demonstração FICTÍCIO"
LEGACY_DEMO_CRANE_MODEL_NAME = "Guindaste Demonstração FICTÍCIO"
LEGACY_DEMO_CONFIGURATION_NAME = "Configuração Demonstração FICTÍCIA"
LEGACY_DEMO_ZONE_NAMES = {
    "Frontal FICTÍCIA": "Frontal",
    "Lateral e traseira FICTÍCIA": "Lateral e traseira",
}
DEMO_LOAD_CHART_VERSION = "demo-ficticia-v1"
DEMO_LOAD_CHART_SIDE_REAR_VERSION = "demo-ficticia-lateral-traseira-v1"

DEMO_FRONT_ZONE = "FRONTAL"
DEMO_SIDE_REAR_ZONE = "LATERAL_TRASEIRA"
DEMO_HOOK_BLOCK_WEIGHT_KG = 200.0
"""Peso de gancho FICTÍCIO da demonstração (ADR-018 § 2): a avaliação compara carga + 200 kg."""

# Exit codes da linha de comando.
EXIT_OK = 0
EXIT_FAILURE = 1
EXIT_CONFIGURATION_ERROR = 2


@dataclass(frozen=True)
class DemoSeedIds:
    """Ids fixos da demonstração: é o que torna o seed idempotente e o roteiro reproduzível.

    A porta do catálogo aceita qualquer texto não vazio como id (TASK-022); a API gera UUIDs só
    quando o cadastro vem por ela (TASK-030). Os testes de integração trocam os ids para não
    colidir com uma demonstração já semeada no mesmo banco.
    """

    manufacturer_id: str = "demo-ficticio-fabricante"
    crane_id: str = "demo-ficticio-guindaste"
    configuration_id: str = "demo-ficticio-configuracao"
    load_chart_id: str = "demo-ficticio-tabela-v1"
    side_rear_load_chart_id: str = "demo-ficticio-tabela-lateral-traseira-v1"


DEMO_SEED_IDS = DemoSeedIds()


def build_demo_rotation_zones() -> RotationZones:
    """Zonas de giro FICTÍCIAS: frontal de 305° a 55° (110°) e lateral/traseira de 55° a 305°.

    Imitam o formato de uma tabela de fabricante com "área frontal" e "áreas lateral e traseira"
    (ADR-018), mas os ângulos são inventados para a demonstração.
    """
    return RotationZones(
        zones=(
            RotationZone(DEMO_FRONT_ZONE, "Frontal", 305.0, 55.0),
            RotationZone(DEMO_SIDE_REAR_ZONE, "Lateral e traseira", 55.0, 305.0),
        )
    )


@dataclass(frozen=True)
class DemoLoadChart:
    """Uma tabela FICTÍCIA da demonstração e a zona em que é importada."""

    chart_id: str
    version: str
    rotation_zone_code: str
    file: Path
    content: bytes | None = None
    """Substitui o conteúdo de `file` (testes)."""

    def read(self) -> bytes:
        return self.file.read_bytes() if self.content is None else self.content


def build_demo_crane_geometry() -> CraneGeometry:
    """Ficha técnica FICTÍCIA, coerente com o modelo 3D ilustrativo do guindaste sobre caminhão.

    a = 0,46 m (pino à frente do eixo de giro) é o valor do modelo 3D do guindaste 80 t
    (`TRUCK_CRANE_MODEL_MEASUREMENTS` em `frontend/src/three/loaders/loadTruckCraneModel.ts`,
    TASK-069), para o gancho desenhado coincidir com o G calculado. Antes, era −1,56 m (TASK-043).
    h = 3,3 m, lança 12–22 m, inclinação 0–80°, cabo 1–15 m: as mesmas faixas de
    `PROVISIONAL_CRANE_LIMITS` (`frontend/src/three/crane/provisionalCraneSpec.ts`). O slider de
    giro vai de −180° a 180° (volta inteira), então o giro é contínuo: sem limites (ADR-013 C-4).
    """
    return CraneGeometry(
        boom_pivot_offset_m=0.46,
        boom_pivot_height=Length(3.3),
        boom_length_min=Length(12.0),
        boom_length_max=Length(22.0),
        boom_angle_min=Angle(0.0),
        boom_angle_max=Angle(80.0),
        cable_length_min=Length(1.0),
        cable_length_max=Length(15.0),
    )


class SeedAction(StrEnum):
    """O que o seed fez em cada passo."""

    CREATED = "criado"
    ALREADY_EXISTS = "já existia; nada alterado"
    ACTIVATED = "ativada"
    ALREADY_ACTIVE = "já estava ativa; nada alterado"
    UPDATED = "atualizada (ficha e nomes atuais)"
    RENAMED = "renomeado (nome atual)"
    SUPERSEDED_KEPT = "está SUPERSEDED (outra versão foi ativada); não reativada"


@dataclass(frozen=True)
class SeedStep:
    """Um passo do seed, para a mensagem ao usuário."""

    entity: str
    entry_id: str
    action: SeedAction

    def message(self) -> str:
        return f"{self.entity} {self.entry_id!r}: {self.action}"


@dataclass(frozen=True)
class DemoSeedResult:
    steps: tuple[SeedStep, ...]

    @property
    def changed(self) -> bool:
        """`True` se algum passo gravou algo no banco."""
        return any(step.action in {SeedAction.CREATED, SeedAction.ACTIVATED} for step in self.steps)


class DemoSeedError(Exception):
    """O seed não pode continuar sem sobrescrever dados ou com dados de demonstração inválidos."""


# Acessórios com modelo 3D de terceiros (TASK-065). Peso e altura são valores de referência do
# fabricante típico; o administrador ajusta no catálogo. Os créditos CC BY 4.0 estão em
# frontend/public/models/acessorios/CREDITS.md.
DEMO_ACCESSORIES: tuple[Accessory, ...] = (
    Accessory(
        id="acessorio-moitao-mccarthy",
        type=AccessoryType.HOOK_BLOCK,
        name="Moitão de 4 polias",
        weight=Mass(350.0),
        rigging_height_m=1.4,
        model_file="moitao-mccarthy-harmony-rs.glb",
        credit="P11789F - McCarthy - Hook Block 4, de Harmony-RS (Sketchfab)",
        license="CC BY 4.0",
    ),
    Accessory(
        id="acessorio-gancho-giratorio",
        type=AccessoryType.SWIVEL_HOOK,
        name="Gancho giratório",
        weight=Mass(25.0),
        rigging_height_m=0.6,
        model_file="gancho-polydavid.glb",
        credit="Crane Hook, de PolyDavid (Sketchfab)",
        license="CC BY 4.0",
    ),
    Accessory(
        id="acessorio-manilha-3t",
        type=AccessoryType.SHACKLE,
        name="Manilha curva 3,25 t",
        weight=Mass(1.2),
        rigging_height_m=0.15,
        model_file="manilha-3ddomino.glb",
        credit="3 Ton Bow Shackle, de 3DDomino (Sketchfab)",
        license="CC BY 4.0",
    ),
)


def seed_demo(
    catalog: CraneCatalogStore,
    load_charts: LoadChartRepository,
    activation: LoadChartActivationRepository,
    file_storage: FileStoragePort,
    *,
    ids: DemoSeedIds = DEMO_SEED_IDS,
    load_chart_content: bytes | None = None,
    accessories: AccessoryRepository | None = None,
) -> DemoSeedResult:
    """Cadastra a demonstração FICTÍCIA, sem duplicar o que já existe.

    `load_chart_content` substitui o CSV de `DEMO_LOAD_CHART_FILE`, a tabela da zona frontal
    (testes). Levanta `DemoSeedError` quando um registro com o id da demonstração existe com outro
    conteúdo (o seed não sobrescreve nada) ou quando uma tabela de demonstração não passa na
    validação.
    """
    steps = [
        _seed_manufacturer(catalog, ids),
        _seed_crane(catalog, ids),
        _seed_configuration(catalog, ids),
    ]
    for chart in (
        DemoLoadChart(
            ids.load_chart_id,
            DEMO_LOAD_CHART_VERSION,
            DEMO_FRONT_ZONE,
            DEMO_LOAD_CHART_FILE,
            load_chart_content,
        ),
        DemoLoadChart(
            ids.side_rear_load_chart_id,
            DEMO_LOAD_CHART_SIDE_REAR_VERSION,
            DEMO_SIDE_REAR_ZONE,
            DEMO_LOAD_CHART_SIDE_REAR_FILE,
        ),
    ):
        steps.extend(_seed_load_chart(catalog, load_charts, activation, file_storage, ids, chart))
    if accessories is not None:
        steps.extend(_seed_accessory(accessories, item) for item in DEMO_ACCESSORIES)
    return DemoSeedResult(steps=tuple(steps))


def _seed_accessory(accessories: AccessoryRepository, accessory: Accessory) -> SeedStep:
    entity = "acessório"
    if accessories.get(accessory.id) is not None:
        return SeedStep(entity, accessory.id, SeedAction.ALREADY_EXISTS)
    accessories.add(accessory)
    return SeedStep(entity, accessory.id, SeedAction.CREATED)


def _seed_manufacturer(catalog: CraneCatalogStore, ids: DemoSeedIds) -> SeedStep:
    entity = "fabricante"
    existing = catalog.get_manufacturer(ids.manufacturer_id)
    if existing is not None:
        if existing.name == LEGACY_DEMO_MANUFACTURER_NAME:
            catalog.update_manufacturer(replace(existing, name=DEMO_MANUFACTURER_NAME))
            return SeedStep(entity, ids.manufacturer_id, SeedAction.RENAMED)
        return SeedStep(entity, ids.manufacturer_id, SeedAction.ALREADY_EXISTS)
    ManageCraneCatalog(catalog, id_generator=lambda: ids.manufacturer_id).create_manufacturer(
        DEMO_MANUFACTURER_NAME
    )
    return SeedStep(entity, ids.manufacturer_id, SeedAction.CREATED)


def _seed_crane(catalog: CraneCatalogStore, ids: DemoSeedIds) -> SeedStep:
    entity = "guindaste"
    existing = catalog.get_crane(ids.crane_id)
    if existing is not None:
        if existing.manufacturer_id != ids.manufacturer_id:
            raise DemoSeedError(
                f"o guindaste {ids.crane_id!r} já existe, mas é de outro fabricante "
                f"({existing.manufacturer_id!r}); o seed não sobrescreve cadastros"
            )
        if existing.model_name == LEGACY_DEMO_CRANE_MODEL_NAME:
            catalog.update_crane(replace(existing, model_name=DEMO_CRANE_MODEL_NAME))
            return SeedStep(entity, ids.crane_id, SeedAction.RENAMED)
        return SeedStep(entity, ids.crane_id, SeedAction.ALREADY_EXISTS)
    ManageCraneCatalog(catalog, id_generator=lambda: ids.crane_id).create_crane(
        ids.manufacturer_id, DEMO_CRANE_MODEL_NAME
    )
    return SeedStep(entity, ids.crane_id, SeedAction.CREATED)


def _rename_legacy_zones(zones: RotationZones) -> RotationZones:
    """As mesmas zonas, com os nomes antigos da demonstração trocados pelos atuais."""
    return replace(
        zones,
        zones=tuple(
            replace(zone, name=LEGACY_DEMO_ZONE_NAMES.get(zone.name, zone.name))
            for zone in zones.zones
        ),
    )


LEGACY_DEMO_PIVOT_OFFSET_M = -1.56
"""Ficha de demonstração anterior à TASK-069 (modelo 3D antigo); o seed migra para a atual."""


def _seed_configuration(catalog: CraneCatalogStore, ids: DemoSeedIds) -> SeedStep:
    entity = "configuração"
    existing = catalog.get_configuration(ids.configuration_id)
    legacy_geometry = replace(
        build_demo_crane_geometry(), boom_pivot_offset_m=LEGACY_DEMO_PIVOT_OFFSET_M
    )
    if existing is not None and existing.crane_id == ids.crane_id:
        # Banco semeado antes da TASK-069 (Render, Docker local): troca só a ficha antiga, os nomes
        # antigos e os nomes antigos das zonas. Nada mais é sobrescrito.
        migrated = existing
        if migrated.geometry == legacy_geometry:
            migrated = replace(migrated, geometry=build_demo_crane_geometry())
        if migrated.name == LEGACY_DEMO_CONFIGURATION_NAME:
            migrated = replace(migrated, name=DEMO_CONFIGURATION_NAME)
        if migrated.rotation_zones is not None:
            renamed = _rename_legacy_zones(migrated.rotation_zones)
            if renamed != migrated.rotation_zones:
                migrated = replace(migrated, rotation_zones=renamed)
        if migrated != existing:
            catalog.update_configuration(migrated)
            existing = migrated
            updated = True
        else:
            updated = False
    else:
        updated = False
    if existing is not None:
        if (
            existing.crane_id != ids.crane_id
            or existing.geometry != build_demo_crane_geometry()
            or existing.rotation_zones != build_demo_rotation_zones()
            or existing.hook_block_weight != Mass(DEMO_HOOK_BLOCK_WEIGHT_KG)
        ):
            raise DemoSeedError(
                f"a configuração {ids.configuration_id!r} já existe com outro guindaste, outra "
                "ficha técnica, outras zonas de giro ou outro peso de gancho; o seed não "
                "sobrescreve cadastros (os valores do roteiro dependem dos dados FICTÍCIOS de "
                "demonstração). Banco semeado antes da TASK-046? Recrie o banco (docs/demo.md)"
            )
        return SeedStep(
            entity,
            ids.configuration_id,
            SeedAction.UPDATED if updated else SeedAction.ALREADY_EXISTS,
        )
    ManageCraneCatalog(catalog, id_generator=lambda: ids.configuration_id).create_configuration(
        ids.crane_id,
        DEMO_CONFIGURATION_NAME,
        build_demo_crane_geometry(),
        rotation_zones=build_demo_rotation_zones(),
        hook_block_weight=Mass(DEMO_HOOK_BLOCK_WEIGHT_KG),
    )
    return SeedStep(entity, ids.configuration_id, SeedAction.CREATED)


def _seed_load_chart(
    catalog: CraneCatalogStore,
    load_charts: LoadChartRepository,
    activation: LoadChartActivationRepository,
    file_storage: FileStoragePort,
    ids: DemoSeedIds,
    demo_chart: DemoLoadChart,
) -> list[SeedStep]:
    entity = "tabela de carga"
    chart_id = demo_chart.chart_id
    steps: list[SeedStep] = []

    existing = load_charts.get_by_id(chart_id)
    if existing is None:
        result = ImportLoadChart(load_charts, file_storage, catalog).execute(
            demo_chart.read(),
            parser=CsvLoadChartParser(),
            file_name=demo_chart.file.name,
            file_type=CSV_CONTENT_TYPE,
            load_chart_id=chart_id,
            version=demo_chart.version,
            configuration_id=ids.configuration_id,
            rotation_zone_code=demo_chart.rotation_zone_code,
        )
        if isinstance(result, InvalidLoadChartImport):
            issues = "; ".join(
                f"linha {issue.line}: {issue.code} ({issue.message})" for issue in result.issues
            )
            raise DemoSeedError(
                f"a tabela FICTÍCIA de demonstração não passou na validação: {issues}"
            )
        steps.append(SeedStep(entity, chart_id, SeedAction.CREATED))
        status = LoadChartStatus.DRAFT
    else:
        chart = existing.chart
        if (
            chart.configuration_id != ids.configuration_id
            or chart.version != demo_chart.version
            or chart.rotation_zone_code != demo_chart.rotation_zone_code
        ):
            raise DemoSeedError(
                f"a tabela de carga {chart_id!r} já existe em outra configuração, versão ou zona "
                f"({chart.configuration_id!r}, {chart.version!r}, {chart.rotation_zone_code!r}); "
                "o seed não sobrescreve tabelas"
            )
        status = chart.status
        steps.append(SeedStep(entity, chart_id, SeedAction.ALREADY_EXISTS))

    match status:
        case LoadChartStatus.DRAFT | LoadChartStatus.VALIDATED:
            ActivateLoadChart(load_charts, activation).execute(chart_id)
            steps.append(SeedStep(entity, chart_id, SeedAction.ACTIVATED))
        case LoadChartStatus.ACTIVE:
            steps.append(SeedStep(entity, chart_id, SeedAction.ALREADY_ACTIVE))
        case LoadChartStatus.SUPERSEDED:
            steps.append(SeedStep(entity, chart_id, SeedAction.SUPERSEDED_KEPT))
        case LoadChartStatus.INVALID:
            raise DemoSeedError(
                f"a tabela de carga {chart_id!r} está INVALID e não pode ser ativada; "
                "recrie o banco para refazer a demonstração"
            )
    return steps


def main(
    argv: Sequence[str] | None = None,
    *,
    environ: Mapping[str, str] | None = None,
    out: TextIO | None = None,
) -> int:
    """Linha de comando: `python -m app.demo_seed`. Devolve o exit code.

    As mensagens nunca repetem a `DATABASE_URL` nem a mensagem do driver (pode conter a URL).
    """
    del argv  # sem opções
    source = os.environ if environ is None else environ
    stream = sys.stdout if out is None else out

    def say(text: str) -> None:
        print(text, file=stream)

    say("Seed da demonstração — dados FICTÍCIOS (ADR-012): não representam capacidade real.")
    if not source.get(DATABASE_URL_ENV_VAR, "").strip():
        say(f"ERRO: defina {DATABASE_URL_ENV_VAR} (ver .env.example).")
        return EXIT_CONFIGURATION_ERROR
    storage = LocalFileStorage.from_environment(source)
    if storage is None:
        say(
            f"ERRO: defina {FILE_STORAGE_DIR_ENV_VAR}: o arquivo-fonte da tabela importada é "
            "preservado nesse diretório (ver .env.example)."
        )
        return EXIT_CONFIGURATION_ERROR
    try:
        settings = DatabaseSettings.from_environment(source)
    except DatabaseConfigurationError as error:
        say(f"ERRO: {error}")
        return EXIT_CONFIGURATION_ERROR

    engine = create_database_engine(settings)
    try:
        session_factory = create_session_factory(engine)
        result = seed_demo(
            SqlAlchemyCraneCatalogRepository(session_factory),
            SqlAlchemyLoadChartRepository(session_factory),
            SqlAlchemyLoadChartActivationRepository(session_factory),
            storage,
            accessories=SqlAlchemyAccessoryRepository(session_factory),
        )
    except DemoSeedError as error:
        say(f"ERRO: {error}")
        return EXIT_FAILURE
    except SQLAlchemyError as error:
        say(
            f"ERRO: falha no banco ({type(error).__name__}). Confira se o PostgreSQL está no ar e "
            "se as migrations foram aplicadas (alembic upgrade head)."
        )
        return EXIT_FAILURE
    except (FileStorageError, OSError) as error:
        say(
            f"ERRO: não foi possível gravar o arquivo-fonte em {FILE_STORAGE_DIR_ENV_VAR} "
            f"({type(error).__name__})."
        )
        return EXIT_FAILURE
    finally:
        engine.dispose()

    for step in result.steps:
        say(f"- {step.message()}")
    if result.changed:
        say(f"Pronto: selecione a configuração {DEMO_SEED_IDS.configuration_id!r} na tela.")
    else:
        say("Nada a fazer: a demonstração já estava semeada.")
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
