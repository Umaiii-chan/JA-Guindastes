"""Mapeamento modelo ↔ domínio e tradução de erros dos repositórios (TASK-022). Sem banco.

Os erros do banco são simulados com um `IntegrityError` cujo `orig` imita o `diag` do psycopg.
Dados FICTÍCIOS (ADR-012).
"""

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, cast

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    CatalogReferenceNotFoundError,
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    DuplicateLoadChartVersionError,
    LoadChartAlreadyExistsError,
    LoadChartConfigurationNotFoundError,
    LoadChartNotDraftError,
    LoadChartNotFoundError,
    LoadChartSource,
)
from app.domain.entities.load_chart import LoadChartStatus
from app.domain.exceptions.geometry_errors import InvalidCraneGeometryError
from app.infrastructure.repositories.sqlalchemy_crane_catalog_repository import (
    SqlAlchemyCraneCatalogRepository,
    configuration_from_model,
    configuration_to_model,
    crane_from_model,
    crane_to_model,
    geometry_from_model,
    manufacturer_from_model,
    manufacturer_to_model,
)
from app.infrastructure.repositories.sqlalchemy_load_chart_repository import (
    SqlAlchemyLoadChartRepository,
    load_chart_from_model,
    load_chart_to_model,
    source_from_model,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia
from tests.fixtures.load_chart_ficticio import build_load_chart_ficticio, point_ficticio
from tests.infrastructure.repositories.catalog_ficticio import (
    CRANE_FICTICIO,
    MANUFACTURER_FICTICIO,
    SOURCE_FICTICIA,
    configuration_ficticia,
)

# --- catálogo -------------------------------------------------------------------------------


def test_manufacturer_and_crane_round_trip() -> None:
    assert manufacturer_from_model(manufacturer_to_model(MANUFACTURER_FICTICIO)) == (
        MANUFACTURER_FICTICIO
    )
    assert crane_from_model(crane_to_model(CRANE_FICTICIO)) == CRANE_FICTICIO


@pytest.mark.parametrize(
    "geometry",
    [
        build_crane_geometry_ficticia(),
        build_crane_geometry_ficticia(
            boom_pivot_offset_m=-0.75,
            cable_length_max_m=None,
            turret_rotation_min_deg=-30.0,
            turret_rotation_max_deg=30.0,
        ),
    ],
    ids=["giro-continuo", "giro-limitado-sem-cabo-maximo"],
)
def test_configuration_with_geometry_round_trip(geometry: object) -> None:
    configuration = configuration_ficticia(geometry=cast(Any, geometry))

    model = configuration_to_model(configuration)

    assert configuration_from_model(model) == configuration
    assert geometry_from_model(model) == geometry


def test_configuration_without_geometry_has_null_columns_and_no_geometry() -> None:
    model = configuration_to_model(configuration_ficticia(geometry=None))

    assert model.boom_pivot_offset_m is None
    assert model.cable_length_min_m is None
    assert geometry_from_model(model) is None
    assert configuration_from_model(model).geometry is None


def test_incoherent_geometry_in_the_database_is_not_silently_accepted() -> None:
    model = configuration_to_model(configuration_ficticia(build_crane_geometry_ficticia()))
    model.boom_length_min_m = 50.0  # FICTÍCIO: maior que o máximo

    with pytest.raises(InvalidCraneGeometryError):
        geometry_from_model(model)


@pytest.mark.parametrize(
    "build",
    [
        lambda: Manufacturer(id=" ", name="Fabricante FICTÍCIO"),
        lambda: Crane(id="GUI-FICTICIO", manufacturer_id="", model_name="Modelo FICTÍCIO"),
        lambda: CraneConfiguration(id="CFG-FICTICIA", crane_id="GUI-FICTICIO", name=""),
    ],
)
def test_catalog_records_require_ids_and_names(build: Any) -> None:
    with pytest.raises(ValueError):
        build()


# --- tabela de carga ----------------------------------------------------------------------


def test_load_chart_round_trip_keeps_point_order_and_repeated_points() -> None:
    points = (
        point_ficticio(20.0, 10.0, 3000.0),
        point_ficticio(10.0, 3.0, 9000.0),
        point_ficticio(20.0, 10.0, 3000.0),  # repetido com a mesma capacidade: aceito
        point_ficticio(10.0, 0.1 + 0.2, 1234.5),  # float sem representação curta
    )
    chart = build_load_chart_ficticio(points=points, status=LoadChartStatus.DRAFT)

    model = load_chart_to_model(chart, SOURCE_FICTICIA)

    assert [point.position for point in model.points] == [0, 1, 2, 3]
    model.points.reverse()  # a ordem vem de `position`, não da lista
    assert load_chart_from_model(model) == chart
    assert load_chart_from_model(model).points == points
    assert source_from_model(model) == SOURCE_FICTICIA


def test_status_is_stored_as_text_and_read_back_as_enum() -> None:
    model = load_chart_to_model(
        build_load_chart_ficticio(status=LoadChartStatus.DRAFT), SOURCE_FICTICIA
    )
    assert model.status == "DRAFT"

    model.status = "ACTIVE"
    assert load_chart_from_model(model).status is LoadChartStatus.ACTIVE


@pytest.mark.parametrize(
    "kwargs",
    [
        {"file_name": "", "file_type": "text/csv", "sha256": "0" * 64},
        {"file_name": "a.csv", "file_type": " ", "sha256": "0" * 64},
        {"file_name": "a.csv", "file_type": "text/csv", "sha256": "0" * 63},
        {"file_name": "a.csv", "file_type": "text/csv", "sha256": "A" * 64},
        {"file_name": "a.csv", "file_type": "text/csv", "sha256": "0" * 64, "uri": ""},
    ],
)
def test_load_chart_source_is_validated(kwargs: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        LoadChartSource(**kwargs)


# --- tradução de erros do banco -------------------------------------------------------------


@dataclass
class _Diag:
    constraint_name: str | None


class _FakeDbError(Exception):
    def __init__(self, constraint_name: str | None) -> None:
        super().__init__("violação FICTÍCIA")
        self.diag = _Diag(constraint_name)


class _FakeSession:
    def __init__(self, stored: object) -> None:
        self._stored = stored

    def add(self, model: object) -> None:
        pass

    def get(self, entity: object, ident: object) -> object:
        return self._stored


class _FakeSessionFactory:
    """Imita `sessionmaker`: a transação de `begin()` falha no commit com a restrição dada."""

    def __init__(self, constraint_name: str | None, stored: object = None) -> None:
        self._constraint_name = constraint_name
        self._stored = stored

    @contextmanager
    def begin(self) -> Iterator[_FakeSession]:
        yield _FakeSession(self._stored)
        raise IntegrityError("INSERT FICTÍCIO", {}, _FakeDbError(self._constraint_name))


def _factory(constraint_name: str | None, stored: object = None) -> sessionmaker[Session]:
    return cast(sessionmaker[Session], _FakeSessionFactory(constraint_name, stored))


@pytest.mark.parametrize(
    ("constraint", "expected"),
    [
        ("pk_crane_configurations", CatalogEntryAlreadyExistsError),
        ("fk_crane_configurations_crane_id_cranes", CatalogReferenceNotFoundError),
        ("outra_restricao", IntegrityError),
        (None, IntegrityError),
    ],
)
def test_catalog_integrity_errors_are_translated(
    constraint: str | None, expected: type[Exception]
) -> None:
    repository = SqlAlchemyCraneCatalogRepository(_factory(constraint))

    with pytest.raises(expected):
        repository.add_configuration(configuration_ficticia())


def test_crane_with_unknown_manufacturer_is_translated() -> None:
    repository = SqlAlchemyCraneCatalogRepository(
        _factory("fk_cranes_manufacturer_id_manufacturers")
    )

    with pytest.raises(CatalogReferenceNotFoundError) as info:
        repository.add_crane(CRANE_FICTICIO)

    assert info.value.entry_id == MANUFACTURER_FICTICIO.id


@pytest.mark.parametrize(
    ("constraint", "expected"),
    [
        ("pk_load_charts", LoadChartAlreadyExistsError),
        ("uq_load_charts_configuration_id_version", DuplicateLoadChartVersionError),
        (
            "fk_load_charts_configuration_id_crane_configurations",
            LoadChartConfigurationNotFoundError,
        ),
        ("outra_restricao", IntegrityError),
    ],
)
def test_save_draft_integrity_errors_are_translated(
    constraint: str, expected: type[Exception]
) -> None:
    repository = SqlAlchemyLoadChartRepository(_factory(constraint))

    with pytest.raises(expected):
        repository.save_draft(
            build_load_chart_ficticio(status=LoadChartStatus.DRAFT), SOURCE_FICTICIA
        )


@pytest.mark.parametrize(
    "status", [status for status in LoadChartStatus if status is not LoadChartStatus.DRAFT]
)
def test_save_draft_rejects_charts_not_in_draft_before_touching_the_database(
    status: LoadChartStatus,
) -> None:
    repository = SqlAlchemyLoadChartRepository(_factory("nao-deveria-chegar-ao-banco"))

    with pytest.raises(LoadChartNotDraftError):
        repository.save_draft(build_load_chart_ficticio(status=status), SOURCE_FICTICIA)


def test_second_active_chart_is_translated_to_conflict() -> None:
    stored = load_chart_to_model(
        build_load_chart_ficticio(status=LoadChartStatus.VALIDATED), SOURCE_FICTICIA
    )
    repository = SqlAlchemyLoadChartRepository(
        _factory("uq_load_charts_one_active_per_configuration_zone", stored=stored)
    )

    with pytest.raises(ActiveLoadChartConflictError) as info:
        repository.change_status(stored.id, LoadChartStatus.ACTIVE)

    assert info.value.configuration_id == stored.configuration_id


def test_change_status_of_unknown_chart_raises_not_found() -> None:
    repository = SqlAlchemyLoadChartRepository(_factory(None, stored=None))

    with pytest.raises(LoadChartNotFoundError):
        repository.change_status("LC-FICTICIO-INEXISTENTE", LoadChartStatus.ACTIVE)
