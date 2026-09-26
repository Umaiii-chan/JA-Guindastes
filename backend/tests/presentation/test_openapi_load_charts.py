"""Contrato OpenAPI de `POST /api/v1/load-charts/validate` (TASK-019; RNF-007)."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.application.ports.load_chart_parser import ImportIssueCode
from app.main import app as composed_app
from app.presentation.api.load_charts import VALIDATE_PATH
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


def test_validate_endpoint_is_in_the_openapi_contract(openapi: dict[str, Any]) -> None:
    assert "post" in openapi["paths"][VALIDATE_PATH]


def test_request_body_is_multipart_with_the_file_and_the_three_required_fields(
    openapi: dict[str, Any],
) -> None:
    request_body = openapi["paths"][VALIDATE_PATH]["post"]["requestBody"]

    assert request_body["required"] is True
    assert list(request_body["content"]) == ["multipart/form-data"]
    body = resolve(openapi, request_body["content"]["multipart/form-data"]["schema"])
    assert sorted(body["required"]) == ["chart_id", "configuration_id", "file", "version"]
    assert body["properties"]["file"]["contentMediaType"] == "application/octet-stream"


def test_200_response_is_the_validation_result_with_status_draft_or_invalid(
    openapi: dict[str, Any],
) -> None:
    responses = openapi["paths"][VALIDATE_PATH]["post"]["responses"]
    result = resolve(openapi, responses["200"]["content"]["application/json"]["schema"])

    assert result["properties"]["status"]["enum"] == ["DRAFT", "INVALID"]
    assert set(result["required"]) == {
        "chart_id",
        "version",
        "configuration_id",
        "status",
        "point_count",
        "points",
        "issues",
    }
    point = resolve(openapi, result["properties"]["points"]["items"])
    assert set(point["properties"]) == {"boom_length_m", "working_radius_m", "max_capacity_kg"}


def test_issue_schema_has_code_message_line_and_column(openapi: dict[str, Any]) -> None:
    responses = openapi["paths"][VALIDATE_PATH]["post"]["responses"]
    result = resolve(openapi, responses["200"]["content"]["application/json"]["schema"])
    issue = resolve(openapi, result["properties"]["issues"]["items"])

    assert set(issue["properties"]) == {"code", "message", "line", "column"}
    code = resolve(openapi, issue["properties"]["code"])
    assert set(code["enum"]) == {member.value for member in ImportIssueCode}


def test_413_and_422_responses_are_documented(openapi: dict[str, Any]) -> None:
    responses = openapi["paths"][VALIDATE_PATH]["post"]["responses"]

    too_large = resolve(openapi, responses["413"]["content"]["application/json"]["schema"])
    assert set(too_large["properties"]) == {"detail"}
    assert responses["422"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/HTTPValidationError"
    }


def test_app_without_a_parser_does_not_expose_the_load_chart_routes() -> None:
    # Sem adapter, `create_app` não registra a rota: quem liga o parser é a raiz de composição.
    spec = TestClient(create_app()).get("/openapi.json").json()

    assert VALIDATE_PATH not in spec.get("paths", {})
