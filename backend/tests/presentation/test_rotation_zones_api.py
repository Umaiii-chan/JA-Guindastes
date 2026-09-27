"""Contrato REST/WebSocket das zonas de giro e do peso do gancho (TASK-046 § 3, CA-3).

Catálogo, importação, listagem, ativação e avaliação com adapters em memória e dados FICTÍCIOS
(ADR-012). Perfis e CSRF das rotas de escrita estão em `test_route_authorization.py`.
"""

from functools import partial
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.infrastructure.importers.xlsx_resource_limits import (
    XlsxLimits,
    select_limited_load_chart_parser,
)
from app.presentation.api.evaluations import EVALUATIONS_PATH, EvaluationDependencies
from app.presentation.api.load_chart_persistence import (
    IMPORT_PATH,
    LoadChartPersistenceDependencies,
)
from app.presentation.api.main import create_app
from app.presentation.websocket.evaluation import EVALUATION_WEBSOCKET_PATH
from tests.application.test_evaluate_operation_rotation_zones import (
    CONFIGURACAO_ZONAS_FICTICIA,
    FRONTAL,
    LATERAL,
    FakeProviders,
)
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_csv_ficticio import (
    CSV_FICTICIO_INCONSISTENCIAS,
    CSV_FICTICIO_VALIDO,
    read_csv_ficticio,
)
from tests.fixtures.load_chart_persistence_fakes import InMemoryFileStorage, InMemoryLoadChartStore
from tests.fixtures.rotation_zones_ficticias import (
    GANCHO_FICTICIO_KG,
    ZONA_FRONTAL_FICTICIA,
    ZONA_LATERAL_TRASEIRA_FICTICIA,
    zonas_payload_ficticio,
)

MANUFACTURERS = "/api/v1/manufacturers"
CRANES = "/api/v1/cranes"
CONFIGURATIONS = "/api/v1/configurations"
VALID_CSV = read_csv_ficticio(CSV_FICTICIO_VALIDO)


class Api:
    """Catálogo, listagem e importação em memória, ligados como na composição com banco."""

    def __init__(self) -> None:
        self.catalog = InMemoryCraneCatalog()
        self.store = InMemoryLoadChartStore(set())
        self.client = TestClient(
            create_app(
                catalog_repository=self.catalog,
                load_chart_listing=self.store,
                load_chart_persistence=LoadChartPersistenceDependencies(
                    parser_selector=partial(select_limited_load_chart_parser, limits=XlsxLimits()),
                    repository=self.store,
                    activation=self.store,
                    file_storage=InMemoryFileStorage(),
                    catalog=self.catalog,
                ),
            )
        )

    def crane(self) -> str:
        manufacturer = self.client.post(MANUFACTURERS, json={"name": "Fabricante FICTÍCIO"})
        crane = self.client.post(
            CRANES,
            json={"manufacturer_id": manufacturer.json()["id"], "model_name": "Modelo FICTÍCIO"},
        )
        return str(crane.json()["id"])

    def configuration(self, **body: Any) -> dict[str, Any]:
        response = self.client.post(
            f"{CRANES}/{self.crane()}/configurations",
            json={"name": "Configuração FICTÍCIA", **body},
        )
        assert response.status_code == 201, response.text
        configuration: dict[str, Any] = response.json()
        self.store.configuration_ids.add(configuration["id"])
        return configuration

    def import_chart(
        self,
        configuration_id: str,
        chart_id: str,
        zone: str | None = None,
        content: bytes = VALID_CSV,
    ) -> Any:
        form = {"configuration_id": configuration_id, "chart_id": chart_id, "version": chart_id}
        if zone is not None:
            form["rotation_zone_code"] = zone
        return self.client.post(
            IMPORT_PATH,
            data=form,
            files={"file": ("tabela_ficticia.csv", content, "text/csv")},
        )


@pytest.fixture
def api() -> Api:
    return Api()


def assert_coded(response: Any, status_code: int, code: str) -> None:
    assert response.status_code == status_code, response.text
    body = response.json()
    assert set(body) == {"detail", "code"}
    assert body["code"] == code
    assert isinstance(body["detail"], str) and body["detail"]


# --- configuração ---------------------------------------------------------------------------


def test_create_configuration_with_zones_and_hook_block(api: Api) -> None:
    configuration = api.configuration(
        rotation_zones=zonas_payload_ficticio(), hook_block_weight_kg=GANCHO_FICTICIO_KG
    )

    assert configuration["rotation_zones"] == zonas_payload_ficticio()
    assert configuration["hook_block_weight_kg"] == GANCHO_FICTICIO_KG
    fetched = api.client.get(f"{CONFIGURATIONS}/{configuration['id']}").json()
    assert fetched == configuration


@pytest.mark.parametrize("body", [{}, {"rotation_zones": None}, {"rotation_zones": []}])
def test_configuration_without_zones_answers_null(api: Api, body: dict[str, Any]) -> None:
    configuration = api.configuration(**body)

    assert configuration["rotation_zones"] is None
    assert configuration["hook_block_weight_kg"] is None


def _zones_with(**changes: Any) -> list[dict[str, Any]]:
    zones = zonas_payload_ficticio()
    zones[0].update(changes)
    return zones


@pytest.mark.parametrize(
    "zones",
    [
        pytest.param(zonas_payload_ficticio()[:1], id="uma zona"),
        pytest.param(_zones_with(end_deg=90.0), id="sobreposição"),
        pytest.param(_zones_with(end_deg=40.0), id="buraco"),
        pytest.param(_zones_with(code="frontal"), id="código minúsculo"),
        pytest.param(_zones_with(code="A" * 33), id="código longo"),
        pytest.param(_zones_with(code=ZONA_LATERAL_TRASEIRA_FICTICIA), id="código repetido"),
        pytest.param(_zones_with(name=""), id="nome vazio"),
        pytest.param(_zones_with(name="N" * 81), id="nome longo"),
        pytest.param(_zones_with(start_deg=360.0), id="ângulo 360"),
        pytest.param(_zones_with(start_deg=-5.0), id="ângulo negativo"),
    ],
)
def test_invalid_zones_answer_422_invalid_rotation_zones(
    api: Api, zones: list[dict[str, Any]]
) -> None:
    response = api.client.post(
        f"{CRANES}/{api.crane()}/configurations",
        json={"name": "Configuração FICTÍCIA", "rotation_zones": zones},
    )

    assert_coded(response, 422, "INVALID_ROTATION_ZONES")


@pytest.mark.parametrize(
    "zone",
    [
        {"code": "FRONTAL", "name": "Frontal", "start_deg": "305", "end_deg": 55.0},
        {"code": "FRONTAL", "name": "Frontal", "start_deg": 305.0},
        {"code": "FRONTAL", "name": "Frontal", "start_deg": 305.0, "end_deg": 55.0, "x": 1},
    ],
)
def test_malformed_zone_answers_the_standard_422(api: Api, zone: dict[str, Any]) -> None:
    response = api.client.post(
        f"{CRANES}/{api.crane()}/configurations",
        json={"name": "Configuração FICTÍCIA", "rotation_zones": [zone, zone]},
    )

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


@pytest.mark.parametrize("hook", [-0.1, 100_000.1, "200", True])
def test_hook_block_weight_out_of_range_or_not_a_number_answers_422(api: Api, hook: Any) -> None:
    response = api.client.post(
        f"{CRANES}/{api.crane()}/configurations",
        json={"name": "Configuração FICTÍCIA", "hook_block_weight_kg": hook},
    )

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


@pytest.mark.parametrize("hook", [0, 0.0, 100_000])
def test_hook_block_weight_limits_are_accepted(api: Api, hook: float) -> None:
    assert api.configuration(hook_block_weight_kg=hook)["hook_block_weight_kg"] == hook


def test_patch_replaces_zones_keeps_other_fields_and_removes_with_empty_list(api: Api) -> None:
    configuration = api.configuration(
        rotation_zones=zonas_payload_ficticio(), hook_block_weight_kg=GANCHO_FICTICIO_KG
    )
    path = f"{CONFIGURATIONS}/{configuration['id']}"
    new_zones = [
        {"code": "A", "name": "A FICTÍCIA", "start_deg": 0.0, "end_deg": 180.0},
        {"code": "B", "name": "B FICTÍCIA", "start_deg": 180.0, "end_deg": 0.0},
    ]

    replaced = api.client.patch(path, json={"rotation_zones": new_zones})
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["rotation_zones"] == new_zones
    assert replaced.json()["hook_block_weight_kg"] == GANCHO_FICTICIO_KG
    assert replaced.json()["name"] == "Configuração FICTÍCIA"

    removed = api.client.patch(path, json={"rotation_zones": []})
    assert removed.json()["rotation_zones"] is None


def test_patch_with_null_removes_zones_and_hook_block(api: Api) -> None:
    configuration = api.configuration(
        rotation_zones=zonas_payload_ficticio(), hook_block_weight_kg=GANCHO_FICTICIO_KG
    )

    response = api.client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}",
        json={"rotation_zones": None, "hook_block_weight_kg": None},
    )

    assert response.status_code == 200, response.text
    assert response.json()["rotation_zones"] is None
    assert response.json()["hook_block_weight_kg"] is None


def test_patch_only_the_name_keeps_zones_and_hook_block(api: Api) -> None:
    configuration = api.configuration(
        rotation_zones=zonas_payload_ficticio(), hook_block_weight_kg=GANCHO_FICTICIO_KG
    )

    response = api.client.patch(f"{CONFIGURATIONS}/{configuration['id']}", json={"name": "Nova"})

    assert response.json()["rotation_zones"] == zonas_payload_ficticio()
    assert response.json()["hook_block_weight_kg"] == GANCHO_FICTICIO_KG


def test_patch_invalid_zones_on_a_missing_configuration_answers_422_before_404(api: Api) -> None:
    response = api.client.patch(
        f"{CONFIGURATIONS}/CFG-INEXISTENTE", json={"rotation_zones": zonas_payload_ficticio()[:1]}
    )

    assert_coded(response, 422, "INVALID_ROTATION_ZONES")


def test_patch_valid_zones_on_a_missing_configuration_answers_404(api: Api) -> None:
    response = api.client.patch(
        f"{CONFIGURATIONS}/CFG-INEXISTENTE", json={"rotation_zones": zonas_payload_ficticio()}
    )

    assert response.status_code == 404
    assert set(response.json()) == {"detail"}


@pytest.mark.parametrize(
    "body",
    [
        {"rotation_zones": None},
        {"rotation_zones": []},
        {
            "rotation_zones": [
                {"code": "FRONTAL_2", "name": "Renomeada", "start_deg": 305.0, "end_deg": 55.0},
                {
                    "code": ZONA_LATERAL_TRASEIRA_FICTICIA,
                    "name": "L",
                    "start_deg": 55.0,
                    "end_deg": 305.0,
                },
            ]
        },
    ],
)
def test_removing_or_renaming_a_zone_with_charts_answers_409(
    api: Api, body: dict[str, Any]
) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())
    assert api.import_chart(configuration["id"], "LC-F1", ZONA_FRONTAL_FICTICIA).status_code == 201

    response = api.client.patch(f"{CONFIGURATIONS}/{configuration['id']}", json=body)

    assert_coded(response, 409, "ROTATION_ZONE_IN_USE")
    kept = api.client.get(f"{CONFIGURATIONS}/{configuration['id']}").json()
    assert kept["rotation_zones"] == zonas_payload_ficticio()


def test_adding_zones_to_a_configuration_with_zoneless_charts_answers_409(api: Api) -> None:
    configuration = api.configuration()
    assert api.import_chart(configuration["id"], "LC-SEM-ZONA").status_code == 201
    path = f"{CONFIGURATIONS}/{configuration['id']}"

    response = api.client.patch(
        path, json={"rotation_zones": zonas_payload_ficticio(), "hook_block_weight_kg": 200.0}
    )

    assert_coded(response, 409, "ZONELESS_LOAD_CHARTS_EXIST")
    assert "sem zona" in response.json()["detail"]
    kept = api.client.get(path).json()
    assert kept["rotation_zones"] is None
    assert kept["hook_block_weight_kg"] is None


def test_zoneless_charts_error_comes_after_422_and_404(api: Api) -> None:
    configuration = api.configuration()
    assert api.import_chart(configuration["id"], "LC-SEM-ZONA").status_code == 201

    invalid = api.client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}",
        json={"rotation_zones": zonas_payload_ficticio()[:1]},
    )
    missing = api.client.patch(
        f"{CONFIGURATIONS}/CFG-INEXISTENTE", json={"rotation_zones": zonas_payload_ficticio()}
    )

    assert_coded(invalid, 422, "INVALID_ROTATION_ZONES")
    assert missing.status_code == 404


def test_configuration_without_zones_and_zoneless_charts_accepts_other_edits(api: Api) -> None:
    configuration = api.configuration()
    assert api.import_chart(configuration["id"], "LC-SEM-ZONA").status_code == 201

    response = api.client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}",
        json={"hook_block_weight_kg": 200.0, "rotation_zones": []},
    )

    assert response.status_code == 200, response.text
    assert response.json()["hook_block_weight_kg"] == 200.0


# --- importação -----------------------------------------------------------------------------


def test_import_into_a_zone_answers_201_with_the_zone(api: Api) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())

    response = api.import_chart(configuration["id"], "LC-F1", ZONA_FRONTAL_FICTICIA)

    assert response.status_code == 201, response.text
    assert response.json()["rotation_zone_code"] == ZONA_FRONTAL_FICTICIA
    fetched = api.client.get(f"/api/v1/load-charts/{response.json()['chart_id']}").json()
    assert fetched["rotation_zone_code"] == ZONA_FRONTAL_FICTICIA


@pytest.mark.parametrize("zone", [None, "", "   "])
def test_import_without_zone_into_a_configuration_with_zones_answers_422(
    api: Api, zone: str | None
) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())

    response = api.import_chart(configuration["id"], "LC-F1", zone)

    assert_coded(response, 422, "ROTATION_ZONE_REQUIRED")


@pytest.mark.parametrize("zone", ["TRASEIRA", "frontal"])
def test_import_into_an_unknown_zone_answers_422(api: Api, zone: str) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())

    response = api.import_chart(configuration["id"], "LC-F1", zone)

    assert_coded(response, 422, "UNKNOWN_ROTATION_ZONE")


def test_import_with_zone_into_a_configuration_without_zones_answers_422(api: Api) -> None:
    configuration = api.configuration()

    response = api.import_chart(configuration["id"], "LC-F1", ZONA_FRONTAL_FICTICIA)

    assert_coded(response, 422, "ROTATION_ZONE_NOT_ALLOWED")


def test_import_without_zone_into_a_configuration_without_zones_works_as_before(api: Api) -> None:
    configuration = api.configuration()

    response = api.import_chart(configuration["id"], "LC-SEM", "")

    assert response.status_code == 201, response.text
    assert response.json()["rotation_zone_code"] is None


def test_zone_error_comes_before_the_content_report(api: Api) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())
    invalid = read_csv_ficticio(CSV_FICTICIO_INCONSISTENCIAS)

    response = api.import_chart(configuration["id"], "LC-F1", None, content=invalid)

    assert_coded(response, 422, "ROTATION_ZONE_REQUIRED")


def test_import_into_an_unknown_configuration_answers_404(api: Api) -> None:
    response = api.import_chart("CFG-INEXISTENTE", "LC-F1", ZONA_FRONTAL_FICTICIA)

    assert response.status_code == 404


# --- ativação e listagem --------------------------------------------------------------------


def test_activation_is_per_zone_and_listing_reports_each_active_chart(api: Api) -> None:
    configuration = api.configuration(rotation_zones=zonas_payload_ficticio())
    configuration_id = configuration["id"]
    for chart_id, zone in (
        ("LC-F1", ZONA_FRONTAL_FICTICIA),
        ("LC-L1", ZONA_LATERAL_TRASEIRA_FICTICIA),
        ("LC-F2", ZONA_FRONTAL_FICTICIA),
    ):
        assert api.import_chart(configuration_id, chart_id, zone).status_code == 201

    first = api.client.post("/api/v1/load-charts/LC-F1/activate")
    side = api.client.post("/api/v1/load-charts/LC-L1/activate")
    second = api.client.post("/api/v1/load-charts/LC-F2/activate")

    assert first.json()["superseded_chart_id"] is None
    assert side.json()["superseded_chart_id"] is None
    assert side.json()["rotation_zone_code"] == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert second.json()["superseded_chart_id"] == "LC-F1"
    assert second.json()["rotation_zone_code"] == ZONA_FRONTAL_FICTICIA

    listing = api.client.get(f"{CONFIGURATIONS}/{configuration_id}/load-charts").json()
    assert listing["active_chart_id"] is None
    assert listing["active_charts"] == [
        {"rotation_zone_code": ZONA_FRONTAL_FICTICIA, "chart_id": "LC-F2"},
        {"rotation_zone_code": ZONA_LATERAL_TRASEIRA_FICTICIA, "chart_id": "LC-L1"},
    ]
    zones = {item["chart_id"]: item["rotation_zone_code"] for item in listing["items"]}
    assert zones == {
        "LC-F1": ZONA_FRONTAL_FICTICIA,
        "LC-F2": ZONA_FRONTAL_FICTICIA,
        "LC-L1": ZONA_LATERAL_TRASEIRA_FICTICIA,
    }


# --- avaliação ------------------------------------------------------------------------------


def evaluation_client(providers: FakeProviders) -> TestClient:
    use_case = EvaluateOperation(
        crane_geometry_provider=providers,
        active_load_chart_provider=providers,
        load_chart_interpolator=ConservativeTabulatedLookup(),
        configuration_load_rules_provider=providers,
    )
    return TestClient(
        create_app(
            evaluation=EvaluationDependencies(
                crane_geometry_provider=providers,
                active_load_chart_provider=providers,
                load_chart_interpolator=ConservativeTabulatedLookup(),
                configuration_load_rules_provider=providers,
            ),
            evaluation_websocket=use_case,
        )
    )


def evaluation_body(psi: float) -> dict[str, Any]:
    return {
        "configuration_id": CONFIGURACAO_ZONAS_FICTICIA,
        "boom_length_m": 10.0,
        "boom_angle_deg": 0.0,
        "turret_rotation_deg": psi,
        "cable_length_m": 5.0,
        "load_weight_kg": 1000.0,
    }


@pytest.mark.parametrize(
    ("psi", "zone", "name", "capacity", "chart_id"),
    [
        (0.0, ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 4000.0, FRONTAL.id),
        (180.0, ZONA_LATERAL_TRASEIRA_FICTICIA, "Lateral e traseira FICTÍCIA", 3000.0, LATERAL.id),
        (55.0, ZONA_LATERAL_TRASEIRA_FICTICIA, "Lateral e traseira FICTÍCIA", 3000.0, LATERAL.id),
    ],
)
def test_rest_evaluation_reports_zone_hook_block_and_compared_weight(
    psi: float, zone: str, name: str, capacity: float, chart_id: str
) -> None:
    response = evaluation_client(FakeProviders()).post(EVALUATIONS_PATH, json=evaluation_body(psi))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "EVALUATED"
    assert body["rotation_zone_code"] == zone
    assert body["rotation_zone_name"] == name
    assert body["hook_block_weight_kg"] == GANCHO_FICTICIO_KG
    assert body["compared_weight_kg"] == 1000.0 + GANCHO_FICTICIO_KG
    assert body["capacity"]["maximum_capacity_kg"] == capacity
    assert body["utilization_percent"] == pytest.approx(1200.0 / capacity * 100)
    assert body["load_chart_id"] == chart_id


def test_rest_evaluation_of_a_zone_without_active_chart_is_not_evaluable() -> None:
    response = evaluation_client(FakeProviders(charts=(FRONTAL,))).post(
        EVALUATIONS_PATH, json=evaluation_body(180.0)
    )

    body = response.json()
    assert body["status"] == "NOT_EVALUABLE"
    assert body["reasons"] == [{"code": "ACTIVE_LOAD_CHART_NOT_FOUND", "category": "EVALUATION"}]
    assert body["rotation_zone_code"] == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert body["compared_weight_kg"] == 1200.0
    assert body["utilization_percent"] is None


def test_websocket_evaluation_reports_zone_hook_block_and_compared_weight() -> None:
    client = evaluation_client(FakeProviders())

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(
            {"type": "simulation.state.changed", "sequence": 3, "payload": evaluation_body(0.0)}
        )
        evaluated = websocket.receive_json()["payload"]
        websocket.send_json(
            {"type": "simulation.state.changed", "sequence": 4, "payload": evaluation_body(200.0)}
        )
        side = websocket.receive_json()["payload"]

    assert evaluated["result"] == "EVALUATED"
    assert evaluated["rotation_zone_code"] == ZONA_FRONTAL_FICTICIA
    assert evaluated["rotation_zone_name"] == "Frontal FICTÍCIA"
    assert evaluated["hook_block_weight_kg"] == GANCHO_FICTICIO_KG
    assert evaluated["compared_weight_kg"] == 1200.0
    assert evaluated["utilization_percent"] == pytest.approx(30.0)
    assert side["rotation_zone_code"] == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert side["utilization_percent"] == pytest.approx(40.0)


def test_websocket_not_evaluable_also_carries_zone_and_weights() -> None:
    client = evaluation_client(FakeProviders(charts=(FRONTAL,)))

    with client.websocket_connect(EVALUATION_WEBSOCKET_PATH) as websocket:
        websocket.send_json(
            {"type": "simulation.state.changed", "sequence": 1, "payload": evaluation_body(90.0)}
        )
        payload = websocket.receive_json()["payload"]

    assert payload["result"] == "NOT_EVALUABLE"
    assert payload["reasons"] == ["ACTIVE_LOAD_CHART_NOT_FOUND"]
    assert payload["rotation_zone_code"] == ZONA_LATERAL_TRASEIRA_FICTICIA
    assert payload["hook_block_weight_kg"] == GANCHO_FICTICIO_KG
    assert payload["compared_weight_kg"] == 1200.0
