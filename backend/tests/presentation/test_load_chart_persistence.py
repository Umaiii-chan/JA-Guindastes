"""Rotas `/import`, `GET /{id}` e `/{id}/activate` com `TestClient` e fakes (TASK-031).

Repositório e armazenamento em memória (`tests/fixtures/load_chart_persistence_fakes.py`); o
seletor de parser é o real, com os limites do XLSX (TASK-023, TASK-031). CSVs e planilhas
FICTÍCIOS (ADR-012).
"""

import hashlib
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from openpyxl import Workbook

from app.application.ports.load_chart_parser import ImportIssueCode
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.infrastructure.importers.load_chart_parser_selector import XLSX_CONTENT_TYPE
from app.infrastructure.importers.xlsx_resource_limits import (
    XlsxLimits,
    select_limited_load_chart_parser,
)
from app.infrastructure.storage.local_file_storage import FILE_STORAGE_DIR_ENV_VAR
from app.load_chart_persistence_composition import build_load_chart_persistence
from app.presentation.api.load_chart_persistence import (
    IMPORT_PATH,
    LoadChartPersistenceDependencies,
)
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import UploadLimits
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
    build_load_chart_ficticio,
)
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore
from tests.infrastructure.repositories.catalog_ficticio import SOURCE_FICTICIA

VALID_CSV = read_csv_ficticio(CSV_FICTICIO_VALIDO)
FORM_FICTICIO = {
    "configuration_id": CONFIGURATION_FICTICIA_ID,
    "chart_id": LOAD_CHART_FICTICIO_ID,
    "version": LOAD_CHART_FICTICIO_VERSION,
}


class Api:
    def __init__(self, xlsx_limits: XlsxLimits | None = None) -> None:
        limits = xlsx_limits or XlsxLimits()
        self.store = InMemoryLoadChartStore({CONFIGURATION_FICTICIA_ID})
        self.storage = InMemoryFileStorage()
        deps = LoadChartPersistenceDependencies(
            parser_selector=lambda name, kind: select_limited_load_chart_parser(
                name, kind, limits=limits
            ),
            repository=self.store,
            activation=self.store,
            file_storage=self.storage,
            upload_limits=UploadLimits(),
        )
        self.client = TestClient(create_app(load_chart_persistence=deps))

    def import_file(
        self,
        content: bytes,
        *,
        file_name: str = "tabela_ficticia.csv",
        content_type: str = "text/csv",
        form: dict[str, str] | None = None,
    ) -> Response:
        return self.client.post(
            IMPORT_PATH,
            data=form or FORM_FICTICIO,
            files={"file": (file_name, content, content_type)},
        )


@pytest.fixture
def api() -> Api:
    return Api()


def xlsx_ficticio(data_rows: int = len(POINTS_FICTICIOS)) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    assert sheet is not None
    sheet.append(("boom_length_m", "working_radius_m", "max_capacity_kg"))
    for index in range(data_rows):
        sheet.append((10.0, 3.0 + index, 9000.0))
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def ficticio(chart_id: str, status: LoadChartStatus) -> LoadChart:
    base = build_load_chart_ficticio()
    return LoadChart(
        id=chart_id,
        version=f"v-{chart_id}",
        configuration_id=CONFIGURATION_FICTICIA_ID,
        status=status,
        points=base.points,
    )


# --- POST /import ---------------------------------------------------------------------------


def test_import_valid_csv_returns_201_with_the_draft_and_the_source(api: Api) -> None:
    response = api.import_file(VALID_CSV, content_type="text/csv; charset=utf-8")

    assert response.status_code == 201
    body = response.json()
    sha256 = hashlib.sha256(VALID_CSV).hexdigest()
    assert body["chart_id"] == LOAD_CHART_FICTICIO_ID
    assert body["version"] == LOAD_CHART_FICTICIO_VERSION
    assert body["configuration_id"] == CONFIGURATION_FICTICIA_ID
    assert body["status"] == "DRAFT"
    assert body["point_count"] == len(POINTS_FICTICIOS)
    assert body["source"] == {
        "file_name": "tabela_ficticia.csv",
        "file_type": "text/csv",
        "sha256": sha256,
        "uri": f"memory://{sha256}",
    }
    assert api.store.status_of(LOAD_CHART_FICTICIO_ID) is LoadChartStatus.DRAFT
    assert api.storage.files == {f"memory://{sha256}": VALID_CSV}


def test_import_valid_xlsx_returns_201(api: Api) -> None:
    response = api.import_file(
        xlsx_ficticio(), file_name="tabela_ficticia.xlsx", content_type=XLSX_CONTENT_TYPE
    )

    assert response.status_code == 201, response.text
    assert response.json()["point_count"] == len(POINTS_FICTICIOS)
    assert response.json()["source"]["file_type"] == XLSX_CONTENT_TYPE


def test_import_invalid_csv_returns_422_with_the_report_and_writes_nothing(api: Api) -> None:
    response = api.import_file(read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS))

    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "INVALID"
    assert body["points"] == []
    assert body["issues"]
    assert {issue["code"] for issue in body["issues"]} <= set(ImportIssueCode)
    assert api.store.charts == {}
    assert api.storage.saves == 0


def test_import_unknown_format_returns_415_without_reading(api: Api) -> None:
    response = api.import_file(
        b"%PDF-1.4 FICTICIO", file_name="tabela.pdf", content_type="application/pdf"
    )

    assert response.status_code == 415
    assert api.store.charts == {}
    assert api.storage.saves == 0


def test_import_duplicate_version_returns_409(api: Api) -> None:
    assert api.import_file(VALID_CSV).status_code == 201

    response = api.import_file(VALID_CSV, form=FORM_FICTICIO | {"chart_id": "LC-FICTICIO-OUTRO"})

    assert response.status_code == 409
    assert LOAD_CHART_FICTICIO_VERSION in response.json()["detail"]
    assert set(api.store.charts) == {LOAD_CHART_FICTICIO_ID}


def test_import_existing_id_returns_409(api: Api) -> None:
    assert api.import_file(VALID_CSV).status_code == 201
    response = api.import_file(VALID_CSV, form=FORM_FICTICIO | {"version": "FICTICIO-v9"})
    assert response.status_code == 409


def test_import_unknown_configuration_returns_404(api: Api) -> None:
    response = api.import_file(
        VALID_CSV, form=FORM_FICTICIO | {"configuration_id": "CFG-FICTICIA-INEXISTENTE"}
    )
    assert response.status_code == 404
    assert api.store.charts == {}


def test_import_xlsx_above_the_row_limit_returns_413_before_parsing() -> None:
    api = Api(XlsxLimits(max_rows=3))

    response = api.import_file(
        xlsx_ficticio(5), file_name="tabela_ficticia.xlsx", content_type=XLSX_CONTENT_TYPE
    )

    assert response.status_code == 413
    assert "linhas" in response.json()["detail"]
    assert api.store.charts == {}
    assert api.storage.saves == 0


def test_import_file_above_the_upload_limit_returns_413(api: Api) -> None:
    response = api.import_file(b"a" * (UploadLimits().max_file_bytes + 1))
    assert response.status_code == 413


def test_import_without_file_name_returns_422(api: Api) -> None:
    response = api.client.post(
        IMPORT_PATH, data=FORM_FICTICIO, files={"file": ("", VALID_CSV, "text/csv")}
    )
    assert response.status_code == 422


def test_import_without_content_type_records_octet_stream(api: Api) -> None:
    response = api.import_file(VALID_CSV, content_type="")
    assert response.status_code == 201
    assert response.json()["source"]["file_type"] == "application/octet-stream"


# --- GET /{id} -----------------------------------------------------------------------------


def test_get_returns_the_stored_chart(api: Api) -> None:
    api.import_file(VALID_CSV)

    response = api.client.get(f"/api/v1/load-charts/{LOAD_CHART_FICTICIO_ID}")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "DRAFT"
    assert [
        (p["boom_length_m"], p["working_radius_m"], p["max_capacity_kg"]) for p in body["points"]
    ] == list(POINTS_FICTICIOS)
    assert body["source"]["sha256"] == hashlib.sha256(VALID_CSV).hexdigest()


def test_get_unknown_chart_returns_404(api: Api) -> None:
    assert api.client.get("/api/v1/load-charts/NAO-EXISTE").status_code == 404


# --- POST /{id}/activate --------------------------------------------------------------------


def test_activate_imported_draft_returns_200_active(api: Api) -> None:
    api.import_file(VALID_CSV)

    response = api.client.post(f"/api/v1/load-charts/{LOAD_CHART_FICTICIO_ID}/activate")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ACTIVE"
    assert body["superseded_chart_id"] is None
    assert api.store.status_of(LOAD_CHART_FICTICIO_ID) is LoadChartStatus.ACTIVE


def test_activate_supersedes_the_previous_active(api: Api) -> None:
    api.store.add(ficticio("ANTIGA", LoadChartStatus.ACTIVE), SOURCE_FICTICIA)
    api.import_file(VALID_CSV)

    response = api.client.post(f"/api/v1/load-charts/{LOAD_CHART_FICTICIO_ID}/activate")

    assert response.status_code == 200
    assert response.json()["superseded_chart_id"] == "ANTIGA"
    assert api.store.status_of("ANTIGA") is LoadChartStatus.SUPERSEDED


@pytest.mark.parametrize(
    "status", [LoadChartStatus.INVALID, LoadChartStatus.ACTIVE, LoadChartStatus.SUPERSEDED]
)
def test_activate_not_activatable_returns_409(api: Api, status: LoadChartStatus) -> None:
    api.store.add(ficticio("X", status), SOURCE_FICTICIA)

    response = api.client.post("/api/v1/load-charts/X/activate")

    assert response.status_code == 409
    assert api.store.status_of("X") is status


def test_activate_unknown_chart_returns_404(api: Api) -> None:
    assert api.client.post("/api/v1/load-charts/NAO-EXISTE/activate").status_code == 404


# --- composição e OpenAPI ------------------------------------------------------------------


def test_routes_are_absent_without_persistence_dependencies() -> None:
    paths = create_app().openapi()["paths"]
    assert IMPORT_PATH not in paths
    assert "/api/v1/load-charts/{chart_id}/activate" not in paths


def test_openapi_documents_the_new_routes(api: Api) -> None:
    paths = api.client.get("/openapi.json").json()["paths"]
    assert set(paths[IMPORT_PATH]["post"]["responses"]) >= {
        "201",
        "404",
        "409",
        "413",
        "415",
        "422",
    }
    assert set(paths["/api/v1/load-charts/{chart_id}"]["get"]["responses"]) >= {"200", "404"}
    assert set(paths["/api/v1/load-charts/{chart_id}/activate"]["post"]["responses"]) >= {
        "200",
        "404",
        "409",
    }


def test_composition_needs_database_url_and_storage_dir(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv(FILE_STORAGE_DIR_ENV_VAR, raising=False)
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://ficticio:ficticio@localhost:1/ficticio"
    )
    assert build_load_chart_persistence() is None

    monkeypatch.setenv(FILE_STORAGE_DIR_ENV_VAR, str(tmp_path / "arquivos"))
    monkeypatch.delenv("DATABASE_URL")
    assert build_load_chart_persistence() is None

    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://ficticio:ficticio@localhost:1/ficticio"
    )
    deps = build_load_chart_persistence()
    assert deps is not None
    assert not (tmp_path / "arquivos").exists()  # nada é criado nem conectado na composição
