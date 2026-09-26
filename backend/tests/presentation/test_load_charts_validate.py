"""`POST /api/v1/load-charts/validate` com `TestClient` (TASK-019; RF-006, RF-009, RNF-006).

Os CSVs e os metadados são FICTÍCIOS (`tests/fixtures/`): servem só para testar o mecanismo e não
representam capacidade real (ADR-012). Os testes que usam o CSV de verdade passam pela raiz de
composição sem banco (`compose_app({})`, com o `CsvLoadChartParser`): sem banco a rota fica aberta
(ADR-016 § 5), e o teste não depende da `DATABASE_URL` do ambiente. Os de limite de tamanho usam um
parser espião, para provar que o arquivo recusado nem chega a ser lido.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response

from app.application.ports.load_chart_parser import ImportIssueCode, LoadChartParseResult
from app.main import compose_app
from app.presentation.api.load_charts import VALIDATE_PATH
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import MIB, UploadLimits
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_ficticio import (
    CONFIGURATION_FICTICIA_ID,
    LOAD_CHART_FICTICIO_ID,
    LOAD_CHART_FICTICIO_VERSION,
    POINTS_FICTICIOS,
)

FORM_FICTICIO = {
    "configuration_id": CONFIGURATION_FICTICIA_ID,
    "chart_id": LOAD_CHART_FICTICIO_ID,
    "version": LOAD_CHART_FICTICIO_VERSION,
}


class SpyParser:
    """Parser falso: guarda o conteúdo recebido e devolve uma leitura sem pontos."""

    def __init__(self) -> None:
        self.received: list[bytes] = []

    def parse(self, content: bytes) -> LoadChartParseResult:
        self.received.append(content)
        return LoadChartParseResult(points=(), issues=())


@pytest.fixture
def client() -> TestClient:
    return TestClient(compose_app({}))


def spied_client(upload_limits: UploadLimits | None = None) -> tuple[TestClient, SpyParser]:
    parser = SpyParser()
    app: FastAPI = create_app(load_chart_parser=parser, upload_limits=upload_limits)
    return TestClient(app), parser


def post_csv(client: TestClient, content: bytes, form: dict[str, str] | None = None) -> Response:
    return client.post(
        VALIDATE_PATH,
        files={"file": ("tabela_ficticia.csv", content, "text/csv")},
        data=FORM_FICTICIO if form is None else form,
    )


# CA-1 ---------------------------------------------------------------------------------------------


def test_ficticio_valid_csv_returns_200_draft_with_the_points(client: TestClient) -> None:
    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_VALIDO))

    assert response.status_code == 200
    assert response.json() == {
        "chart_id": LOAD_CHART_FICTICIO_ID,
        "version": LOAD_CHART_FICTICIO_VERSION,
        "configuration_id": CONFIGURATION_FICTICIA_ID,
        "status": "DRAFT",
        "point_count": len(POINTS_FICTICIOS),
        "points": [
            {"boom_length_m": boom, "working_radius_m": radius, "max_capacity_kg": capacity}
            for boom, radius, capacity in POINTS_FICTICIOS
        ],
        "issues": [],
    }


# CA-2 ---------------------------------------------------------------------------------------------


def test_ficticio_csv_with_inconsistencies_returns_200_invalid_with_the_full_report(
    client: TestClient,
) -> None:
    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INVALID"
    assert body["point_count"] == 0
    assert body["points"] == []
    assert [(issue["line"], issue["column"], issue["code"]) for issue in body["issues"]] == [
        (2, None, ImportIssueCode.CONFLICTING_POINTS),
        (3, "max_capacity_kg", ImportIssueCode.EMPTY_VALUE),
        (4, "working_radius_m", ImportIssueCode.INVALID_NUMBER),
        (5, "max_capacity_kg", ImportIssueCode.NEGATIVE_VALUE),
        (6, "max_capacity_kg", ImportIssueCode.NON_FINITE_NUMBER),
        (7, None, ImportIssueCode.WRONG_FIELD_COUNT),
        (8, None, ImportIssueCode.CONFLICTING_POINTS),
        (9, "max_capacity_kg", ImportIssueCode.INVALID_NUMBER),
    ]
    assert all(issue["message"].strip() for issue in body["issues"])


def test_invalid_import_echoes_the_metadata_sent(client: TestClient) -> None:
    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    body = response.json()
    assert (body["chart_id"], body["version"], body["configuration_id"]) == (
        LOAD_CHART_FICTICIO_ID,
        LOAD_CHART_FICTICIO_VERSION,
        CONFIGURATION_FICTICIA_ID,
    )


def test_file_that_is_not_utf8_returns_invalid_encoding_report(client: TestClient) -> None:
    # Latin-1, como gravaria um editor que não usa UTF-8: "ç" vira o byte 0xE7, inválido em UTF-8.
    content = "boom_length_m,working_radius_m,max_capacity_kg\nação\n".encode("latin-1")

    response = post_csv(client, content)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INVALID"
    assert [(issue["code"], issue["line"]) for issue in body["issues"]] == [
        (ImportIssueCode.NO_POINTS, None),
        (ImportIssueCode.INVALID_ENCODING, 2),
    ]


def test_blank_metadata_returns_invalid_with_missing_metadata(client: TestClient) -> None:
    # Só espaços passam pela validação do FastAPI; quem recusa é o caso de uso (RN-001, RN-005).
    form = {"configuration_id": "  ", "chart_id": " ", "version": "   "}
    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_VALIDO), form)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "INVALID"
    assert [issue["code"] for issue in body["issues"]] == [ImportIssueCode.MISSING_METADATA] * 3


# CA-3 ---------------------------------------------------------------------------------------------


def test_file_exactly_at_the_default_limit_is_not_rejected_for_size() -> None:
    client, parser = spied_client()

    response = post_csv(client, b"x" * MIB)

    assert response.status_code == 200
    assert [len(content) for content in parser.received] == [MIB]


def test_file_one_byte_over_the_default_limit_returns_413_without_being_parsed() -> None:
    client, parser = spied_client()

    response = post_csv(client, b"x" * (MIB + 1))

    assert response.status_code == 413
    assert response.json() == {"detail": f"o arquivo excede o tamanho máximo de {MIB} bytes"}
    assert parser.received == []


def test_composed_app_rejects_a_file_over_the_default_limit(client: TestClient) -> None:
    response = post_csv(client, b"x" * (MIB + 1))

    assert response.status_code == 413


def test_request_body_over_the_limit_returns_413_before_the_form_is_read() -> None:
    limits = UploadLimits()
    client, parser = spied_client(limits)

    response = post_csv(client, b"x" * limits.max_request_bytes)

    assert response.status_code == 413
    assert response.json() == {
        "detail": f"a requisição excede o tamanho máximo de {limits.max_request_bytes} bytes"
    }
    assert parser.received == []


def test_configured_limit_replaces_the_default() -> None:
    client, parser = spied_client(UploadLimits(max_file_bytes=10))

    assert post_csv(client, b"x" * 10).status_code == 200
    assert post_csv(client, b"x" * 11).status_code == 413
    assert [len(content) for content in parser.received] == [10]


# CA-4 ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("missing", ["configuration_id", "chart_id", "version"])
def test_missing_form_field_returns_fastapi_422(client: TestClient, missing: str) -> None:
    form = {name: value for name, value in FORM_FICTICIO.items() if name != missing}

    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_VALIDO), form)

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        ("missing", ["body", missing])
    ]


def test_missing_file_returns_fastapi_422(client: TestClient) -> None:
    response = client.post(VALIDATE_PATH, data=FORM_FICTICIO)

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        ("missing", ["body", "file"])
    ]


def test_empty_form_field_counts_as_missing_for_fastapi(client: TestClient) -> None:
    form = {**FORM_FICTICIO, "chart_id": ""}

    response = post_csv(client, read_csv_ficticio(CSV_FICTICIO_VALIDO), form)

    assert response.status_code == 422
    assert [error["loc"] for error in response.json()["detail"]] == [["body", "chart_id"]]


def test_text_field_instead_of_a_file_returns_fastapi_422(client: TestClient) -> None:
    response = client.post(VALIDATE_PATH, data={**FORM_FICTICIO, "file": "10.0,3.0,9000.0"})

    assert response.status_code == 422
    assert [error["loc"] for error in response.json()["detail"]] == [["body", "file"]]


def test_request_without_body_returns_fastapi_422(client: TestClient) -> None:
    response = client.post(VALIDATE_PATH)

    assert response.status_code == 422
    assert {tuple(error["loc"]) for error in response.json()["detail"]} == {
        ("body", "file"),
        ("body", "configuration_id"),
        ("body", "chart_id"),
        ("body", "version"),
    }
