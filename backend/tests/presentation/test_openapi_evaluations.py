"""Contrato OpenAPI de `POST /api/v1/evaluations` (TASK-024; RNF-007)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.application.use_cases.evaluate_operation import NotEvaluableReason
from app.domain.exceptions.geometry_errors import OperationalLimitViolation
from app.domain.value_objects.capacity_result import CapacityUnsupportedReason
from app.main import app as composed_app
from app.presentation.api.evaluations import EVALUATIONS_PATH
from app.presentation.api.main import create_app


@pytest.fixture(scope="module")
def openapi() -> dict[str, Any]:
    response = TestClient(composed_app).get("/openapi.json")
    assert response.status_code == 200
    spec: dict[str, Any] = response.json()
    return spec


def resolve(spec: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Segue um `$ref` local (`#/components/schemas/...`)."""
    ref: str | None = schema.get("$ref")
    if ref is None:
        return schema
    resolved: dict[str, Any] = spec["components"]["schemas"][ref.rsplit("/", 1)[-1]]
    return resolved


def nullable_ref(spec: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Resolve o `$ref` de um campo `X | None` (`anyOf: [{$ref}, {type: null}]`)."""
    refs = [option for option in schema["anyOf"] if "$ref" in option]
    assert len(refs) == 1
    return resolve(spec, refs[0])


def response_schema(spec: dict[str, Any]) -> dict[str, Any]:
    responses = spec["paths"][EVALUATIONS_PATH]["post"]["responses"]
    return resolve(spec, responses["200"]["content"]["application/json"]["schema"])


def test_evaluation_endpoint_is_in_the_openapi_contract(openapi: dict[str, Any]) -> None:
    assert "post" in openapi["paths"][EVALUATIONS_PATH]


def test_request_body_is_json_with_the_six_required_fields(openapi: dict[str, Any]) -> None:
    request_body = openapi["paths"][EVALUATIONS_PATH]["post"]["requestBody"]

    assert request_body["required"] is True
    body = resolve(openapi, request_body["content"]["application/json"]["schema"])
    assert sorted(body["required"]) == [
        "boom_angle_deg",
        "boom_length_m",
        "cable_length_m",
        "configuration_id",
        "load_weight_kg",
        "turret_rotation_deg",
    ]
    assert body["additionalProperties"] is False
    for field in ("boom_length_m", "cable_length_m", "load_weight_kg"):
        assert body["properties"][field]["minimum"] == 0


def test_status_only_distinguishes_evaluated_from_not_evaluable(openapi: dict[str, Any]) -> None:
    # Sem níveis de alerta (PEND-004): nada de NORMAL, WARNING ou CRITICAL.
    result = response_schema(openapi)

    assert result["properties"]["status"]["enum"] == ["EVALUATED", "NOT_EVALUABLE"]
    assert set(result["properties"]) == {
        "status",
        "configuration_id",
        "geometry",
        "capacity",
        "utilization_percent",
        "load_chart_id",
        "load_chart_version",
        "reasons",
    }


def test_capacity_carries_the_used_point_and_the_provisional_strategy(
    openapi: dict[str, Any],
) -> None:
    capacity = nullable_ref(openapi, response_schema(openapi)["properties"]["capacity"])

    assert set(capacity["properties"]) == {
        "maximum_capacity_kg",
        "strategy",
        "queried_boom_length_m",
        "queried_working_radius_m",
        "used_point",
    }
    strategy = nullable_ref(openapi, capacity["properties"]["strategy"])
    assert strategy["enum"] == ["CONSERVATIVE_PROVISIONAL"]


def test_geometry_has_radius_heights_and_positions(openapi: dict[str, Any]) -> None:
    geometry = nullable_ref(openapi, response_schema(openapi)["properties"]["geometry"])

    assert set(geometry["properties"]) == {
        "working_radius_m",
        "tip_height_m",
        "hook_height_m",
        "boom_pivot",
        "boom_tip",
        "hook",
    }


def test_reason_codes_cover_every_domain_and_use_case_reason(openapi: dict[str, Any]) -> None:
    reason = resolve(openapi, response_schema(openapi)["properties"]["reasons"]["items"])
    codes = {
        value
        for option in reason["properties"]["code"]["anyOf"]
        for value in resolve(openapi, option)["enum"]
    }

    assert codes == {
        member.value
        for enum in (NotEvaluableReason, OperationalLimitViolation, CapacityUnsupportedReason)
        for member in enum
    }


def test_422_and_500_responses_are_documented(openapi: dict[str, Any]) -> None:
    responses = openapi["paths"][EVALUATIONS_PATH]["post"]["responses"]

    assert responses["422"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/HTTPValidationError"
    }
    assert "500" in responses


def test_app_without_evaluation_dependencies_does_not_expose_the_route() -> None:
    spec = TestClient(create_app()).get("/openapi.json").json()

    assert EVALUATIONS_PATH not in spec.get("paths", {})
