"""Entidades `LoadChartPoint` e `LoadChart` (doc-fonte §§ 10.2, 13.1 e 13.2; RN-001, RN-005)."""

import pytest

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.exceptions.domain_errors import (
    ConflictingLoadChartPointsError,
    InvalidLoadChartError,
    InvalidQuantityError,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
    build_load_chart_ficticio,
    point_ficticio,
)


def test_ficticio_point_keeps_boom_length_radius_and_capacity() -> None:
    point = point_ficticio(10.0, 5.0, 6000.0)

    assert point.boom_length == Length(10.0)
    assert point.working_radius == Length(5.0)
    assert point.max_capacity == Mass(6000.0)


def test_ficticio_point_rejects_negative_capacity() -> None:
    with pytest.raises(InvalidQuantityError):
        point_ficticio(10.0, 5.0, -1.0)


def test_point_rejects_raw_number_instead_of_mass() -> None:
    with pytest.raises(InvalidLoadChartError):
        LoadChartPoint(
            boom_length=Length(10.0),
            working_radius=Length(5.0),
            max_capacity=-1.0,  # type: ignore[arg-type]
        )


def test_ficticio_chart_keeps_header_and_points() -> None:
    chart = build_load_chart_ficticio()

    assert chart.id == LOAD_CHART_FICTICIO_ID
    assert chart.version == LOAD_CHART_FICTICIO_VERSION
    assert chart.configuration_id == CONFIGURATION_FICTICIA_ID
    assert chart.status is LoadChartStatus.ACTIVE
    assert len(chart.points) == len(POINTS_FICTICIOS)


def test_load_chart_status_has_exactly_the_source_document_states() -> None:
    # Doc-fonte § 13.2.
    assert {status.value for status in LoadChartStatus} == {
        "DRAFT",
        "VALIDATED",
        "ACTIVE",
        "SUPERSEDED",
        "INVALID",
    }


@pytest.mark.parametrize("status", list(LoadChartStatus))
def test_ficticio_chart_accepts_every_status(status: LoadChartStatus) -> None:
    assert build_load_chart_ficticio(status=status).status is status


def test_ficticio_chart_rejects_status_outside_the_enum() -> None:
    with pytest.raises(InvalidLoadChartError):
        build_load_chart_ficticio(status="PUBLISHED")  # type: ignore[arg-type]


@pytest.mark.parametrize("field_name", ["id", "version", "configuration_id"])
@pytest.mark.parametrize("blank", ["", "   "])
def test_ficticio_chart_requires_id_version_and_configuration(field_name: str, blank: str) -> None:
    # RN-001 (configuração), RN-005 (versão); doc-fonte § 13.1: "versão/origem informadas".
    header = {
        "id": LOAD_CHART_FICTICIO_ID,
        "version": LOAD_CHART_FICTICIO_VERSION,
        "configuration_id": CONFIGURATION_FICTICIA_ID,
    }
    header[field_name] = blank

    with pytest.raises(InvalidLoadChartError):
        LoadChart(**header, status=LoadChartStatus.DRAFT, points=())


def test_ficticio_chart_rejects_conflicting_duplicate_points() -> None:
    points = (point_ficticio(10.0, 5.0, 6000.0), point_ficticio(10.0, 5.0, 5999.0))

    with pytest.raises(ConflictingLoadChartPointsError) as error:
        build_load_chart_ficticio(points=points)

    assert error.value.boom_length_m == 10.0
    assert error.value.working_radius_m == 5.0


def test_conflicting_points_error_is_an_invalid_load_chart_error() -> None:
    assert issubclass(ConflictingLoadChartPointsError, InvalidLoadChartError)


def test_ficticio_chart_accepts_repeated_points_with_same_capacity() -> None:
    points = (point_ficticio(10.0, 5.0, 6000.0), point_ficticio(10.0, 5.0, 6000.0))

    chart = build_load_chart_ficticio(points=points)

    assert chart.points == points


def test_ficticio_chart_accepts_same_radius_on_different_boom_lengths() -> None:
    points = (point_ficticio(10.0, 5.0, 6000.0), point_ficticio(20.0, 5.0, 5000.0))

    assert build_load_chart_ficticio(points=points).points == points


def test_ficticio_chart_stores_points_as_immutable_tuple() -> None:
    points = [point_ficticio(10.0, 5.0, 6000.0)]

    chart = build_load_chart_ficticio(points=points)  # type: ignore[arg-type]

    assert isinstance(chart.points, tuple)
    points.append(point_ficticio(20.0, 5.0, 5000.0))
    assert len(chart.points) == 1


def test_ficticio_chart_finds_point_by_exact_boom_length_and_radius() -> None:
    chart = build_load_chart_ficticio()

    point = chart.point_at(Length(20.0), Length(10.0))

    assert point is not None
    assert point.max_capacity == Mass(3000.0)


def test_ficticio_chart_returns_none_when_combination_is_not_a_point() -> None:
    assert build_load_chart_ficticio().point_at(Length(20.0), Length(12.0)) is None
