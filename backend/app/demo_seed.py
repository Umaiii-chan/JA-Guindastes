"""Seed da demonstração reproduzível — dados FICTÍCIOS (TASK-035; doc-fonte § 23, Estação 5).

FICTÍCIO: fabricante, guindaste, configuração, ficha técnica e tabela de carga deste módulo são
inventados só para a demonstração. Nenhum número vem de ficha técnica ou tabela de fabricante, e
nada aqui pode ser apresentado como capacidade real (ADR-012; ADR-013 C-4, regra 2).

Cadastra, pelos casos de uso e repositórios existentes:

1. fabricante, guindaste e configuração FICTÍCIOS (`ManageCraneCatalog`, TASK-030), com a ficha
   técnica compatível com o guindaste provisório do frontend (TASK-013/016): a = −1,2 m,
   h = 3,3 m e as faixas dos sliders (lança 12–22 m, inclinação 0–80°, cabo 1–15 m, giro
   contínuo);
2. a tabela de carga FICTÍCIA `demo_data/tabela_carga_ficticia_demo_v1.csv`, importada pelo fluxo
   real (`ImportLoadChart`: validação, arquivo-fonte preservado, gravação em `DRAFT`) e ativada
   (`ActivateLoadChart`).

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
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError

from app.application.ports.crane_catalog_listing import CraneCatalogStore
from app.application.ports.file_storage import FileStorageError, FileStoragePort
from app.application.ports.load_chart_activation import LoadChartActivationRepository
from app.application.ports.load_chart_repository import LoadChartRepository
from app.application.use_cases.activate_load_chart import ActivateLoadChart
from app.application.use_cases.crane_catalog import ManageCraneCatalog
from app.application.use_cases.import_load_chart import ImportLoadChart
from app.application.use_cases.validate_load_chart_import import InvalidLoadChartImport
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.infrastructure.database.config import (
    DATABASE_URL_ENV_VAR,
    DatabaseConfigurationError,
    DatabaseSettings,
)
from app.infrastructure.database.engine import create_database_engine, create_session_factory
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.load_chart_parser_selector import CSV_CONTENT_TYPE
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
"""Tabela de carga FICTÍCIA importada e ativada pelo seed."""

DEMO_LOAD_CHART_V2_FILE = DEMO_DATA_DIR / "tabela_carga_ficticia_demo_v2.csv"
"""Segunda versão FICTÍCIA, importada à mão no roteiro (troca de versão); o seed não a usa."""

DEMO_LOAD_CHART_WITH_ERRORS_FILE = DEMO_DATA_DIR / "tabela_carga_ficticia_demo_com_erros.csv"
"""Tabela FICTÍCIA com inconsistências, para mostrar o relatório de erros no roteiro."""

DEMO_MANUFACTURER_NAME = "Fabricante Demonstração FICTÍCIO"
DEMO_CRANE_MODEL_NAME = "Guindaste Demonstração FICTÍCIO"
DEMO_CONFIGURATION_NAME = "Configuração Demonstração FICTÍCIA"
DEMO_LOAD_CHART_VERSION = "demo-ficticia-v1"

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


DEMO_SEED_IDS = DemoSeedIds()


def build_demo_crane_geometry() -> CraneGeometry:
    """Ficha técnica FICTÍCIA, igual ao guindaste provisório do frontend.

    Espelha `PROVISIONAL_CRANE_GEOMETRY` e `PROVISIONAL_CRANE_LIMITS`
    (`frontend/src/three/crane/createProvisionalCrane.ts`): a = −1,2 m (pino atrás do eixo de
    giro), h = 3,3 m, lança 12–22 m, inclinação 0–80°, cabo 1–15 m. O slider de giro vai de −180° a
    180° (volta inteira), então o giro é contínuo: sem limites (ADR-013 C-4).
    """
    return CraneGeometry(
        boom_pivot_offset_m=-1.2,
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


def seed_demo(
    catalog: CraneCatalogStore,
    load_charts: LoadChartRepository,
    activation: LoadChartActivationRepository,
    file_storage: FileStoragePort,
    *,
    ids: DemoSeedIds = DEMO_SEED_IDS,
    load_chart_content: bytes | None = None,
) -> DemoSeedResult:
    """Cadastra a demonstração FICTÍCIA, sem duplicar o que já existe.

    `load_chart_content` substitui o CSV de `DEMO_LOAD_CHART_FILE` (testes). Levanta
    `DemoSeedError` quando um registro com o id da demonstração existe com outro conteúdo (o seed
    não sobrescreve nada) ou quando a tabela de demonstração não passa na validação.
    """
    steps = [
        _seed_manufacturer(catalog, ids),
        _seed_crane(catalog, ids),
        _seed_configuration(catalog, ids),
    ]
    content = (
        DEMO_LOAD_CHART_FILE.read_bytes() if load_chart_content is None else load_chart_content
    )
    steps.extend(_seed_load_chart(load_charts, activation, file_storage, ids, content))
    return DemoSeedResult(steps=tuple(steps))


def _seed_manufacturer(catalog: CraneCatalogStore, ids: DemoSeedIds) -> SeedStep:
    entity = "fabricante"
    if catalog.get_manufacturer(ids.manufacturer_id) is not None:
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
        return SeedStep(entity, ids.crane_id, SeedAction.ALREADY_EXISTS)
    ManageCraneCatalog(catalog, id_generator=lambda: ids.crane_id).create_crane(
        ids.manufacturer_id, DEMO_CRANE_MODEL_NAME
    )
    return SeedStep(entity, ids.crane_id, SeedAction.CREATED)


def _seed_configuration(catalog: CraneCatalogStore, ids: DemoSeedIds) -> SeedStep:
    entity = "configuração"
    existing = catalog.get_configuration(ids.configuration_id)
    if existing is not None:
        if existing.crane_id != ids.crane_id or existing.geometry != build_demo_crane_geometry():
            raise DemoSeedError(
                f"a configuração {ids.configuration_id!r} já existe com outro guindaste ou outra "
                "ficha técnica; o seed não sobrescreve cadastros (os valores do roteiro "
                "dependem da ficha FICTÍCIA de demonstração)"
            )
        return SeedStep(entity, ids.configuration_id, SeedAction.ALREADY_EXISTS)
    ManageCraneCatalog(catalog, id_generator=lambda: ids.configuration_id).create_configuration(
        ids.crane_id, DEMO_CONFIGURATION_NAME, build_demo_crane_geometry()
    )
    return SeedStep(entity, ids.configuration_id, SeedAction.CREATED)


def _seed_load_chart(
    load_charts: LoadChartRepository,
    activation: LoadChartActivationRepository,
    file_storage: FileStoragePort,
    ids: DemoSeedIds,
    content: bytes,
) -> list[SeedStep]:
    entity = "tabela de carga"
    chart_id = ids.load_chart_id
    steps: list[SeedStep] = []

    existing = load_charts.get_by_id(chart_id)
    if existing is None:
        result = ImportLoadChart(load_charts, file_storage).execute(
            content,
            parser=CsvLoadChartParser(),
            file_name=DEMO_LOAD_CHART_FILE.name,
            file_type=CSV_CONTENT_TYPE,
            load_chart_id=chart_id,
            version=DEMO_LOAD_CHART_VERSION,
            configuration_id=ids.configuration_id,
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
            or chart.version != DEMO_LOAD_CHART_VERSION
        ):
            raise DemoSeedError(
                f"a tabela de carga {chart_id!r} já existe em outra configuração ou versão "
                f"({chart.configuration_id!r}, {chart.version!r}); o seed não sobrescreve tabelas"
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
