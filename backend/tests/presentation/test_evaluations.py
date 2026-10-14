"""`POST /api/v1/evaluations` com `TestClient` (TASK-024; RN-004..RN-008; ADR-015).

Dados FICTÍCIOS (ADR-012): a ficha técnica de `tests/fixtures/crane_geometry_ficticia.py`
(a = 1,5 m; h = 2,5 m; L de 10 a 30 m; θ de 0° a 90°; c de 0 a 40 m) e a tabela de
`tests/fixtures/avaliacao_operacional_ficticia.py` (L = 10 m: 11,5 m → 4000 kg; L = 20 m: 11,5 m →
5000 kg e 21,5 m → 2000 kg; L = 30 m: 31,5 m → 0 kg). O raio é R = a + L·cos θ (ADR-013). Nenhum
número representa guindaste ou capacidade real.

Os testes montam a app com `create_app` e provedores falsos. Os da raiz de composição
(`app.main`, com e sem banco) ficam em `tests/test_composition.py` (TASK-029).
"""

import math
from collections.abc import Mapping
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.presentation.api.evaluations import EVALUATIONS_PATH, EvaluationDependencies
from app.presentation.api.main import create_app
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_ID,
    LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia

# Configurações FICTÍCIAS extras.
CONFIGURATION_SEM_TABELA_FICTICIA_ID = "CFG-FICTICIA-SEM-TABELA"
CONFIGURATION_PINO_ATRAS_FICTICIA_ID = "CFG-FICTICIA-PINO-ATRAS-DO-EIXO"
CONFIGURATION_DESCONHECIDA_FICTICIA_ID = "CFG-FICTICIA-DESCONHECIDA"

# Tolerância só para conferir o raio calculado com a conta à mão; não é o ε da consulta.
TOLERANCE_M = 1e-9


class FakeCraneGeometryProvider:
    def __init__(self, geometries: Mapping[str, CraneGeometry]) -> None:
        self._geometries = dict(geometries)

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return self._geometries.get(configuration_id)


class FakeActiveLoadChartProvider:
    def __init__(self, charts: Mapping[str, LoadChart]) -> None:
        self._charts = dict(charts)

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return self._charts.get(configuration_id)


def client_ficticio(
    *,
    interpolator: LoadChartInterpolator | None = None,
    charts: Mapping[str, LoadChart] | None = None,
    raise_server_exceptions: bool = True,
) -> TestClient:
    geometries = {
        CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia(),
        CONFIGURATION_SEM_TABELA_FICTICIA_ID: build_crane_geometry_ficticia(),
        # Pino 1,5 m atrás do eixo de giro: com θ = 90°, R = −1,5 + L·cos 90° < 0 (FICTÍCIO).
        CONFIGURATION_PINO_ATRAS_FICTICIA_ID: build_crane_geometry_ficticia(
            boom_pivot_offset_m=-1.5
        ),
    }
    if charts is None:
        charts = {
            CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio(),
            CONFIGURATION_PINO_ATRAS_FICTICIA_ID: build_load_chart_avaliacao_ficticio(
                configuration_id=CONFIGURATION_PINO_ATRAS_FICTICIA_ID
            ),
        }
    app = create_app(
        evaluation=EvaluationDependencies(
            crane_geometry_provider=FakeCraneGeometryProvider(geometries),
            active_load_chart_provider=FakeActiveLoadChartProvider(charts),
            load_chart_interpolator=(
                ConservativeTabulatedLookup() if interpolator is None else interpolator
            ),
        )
    )
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def body_ficticio(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "configuration_id": CONFIGURATION_AVALIACAO_FICTICIA_ID,
        "boom_length_m": 20.0,
        "boom_angle_deg": 30.0,
        "turret_rotation_deg": 0.0,
        "cable_length_m": 1.0,
        "load_weight_kg": 1500.0,
    }
    body.update(overrides)
    return body


@pytest.fixture
def client() -> TestClient:
    return client_ficticio()


def reason_codes(body: dict[str, Any]) -> list[tuple[str, str]]:
    return [(reason["code"], reason["category"]) for reason in body["reasons"]]


# Avaliado -----------------------------------------------------------------------------------------


def test_ficticio_radius_between_points_is_evaluated_with_the_conservative_capacity(
    client: TestClient,
) -> None:
    # L = 20 m, θ = 30° → R = 1,5 + 10√3 ≈ 18,82 m, entre 11,5 m (5000 kg) e 21,5 m (2000 kg):
    # vale o menor vizinho, 2000 kg (ADR-015). Carga FICTÍCIA de 1500 kg → 75 %.
    response = client.post(EVALUATIONS_PATH, json=body_ficticio())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "EVALUATED"
    assert body["configuration_id"] == CONFIGURATION_AVALIACAO_FICTICIA_ID
    assert body["reasons"] == []
    assert body["utilization_percent"] == pytest.approx(75.0)
    assert (body["load_chart_id"], body["load_chart_version"]) == (
        LOAD_CHART_AVALIACAO_FICTICIO_ID,
        LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    )
    radius_m = 1.5 + 10 * math.sqrt(3)
    assert body["geometry"]["working_radius_m"] == pytest.approx(radius_m, abs=TOLERANCE_M)
    capacity = body["capacity"]
    assert capacity["maximum_capacity_kg"] == 2000.0
    assert capacity["strategy"] == "CONSERVATIVE_PROVISIONAL"
    assert capacity["queried_boom_length_m"] == 20.0
    assert capacity["queried_working_radius_m"] == pytest.approx(radius_m, abs=TOLERANCE_M)
    assert capacity["used_point"] == {
        "boom_length_m": 20.0,
        "working_radius_m": 21.5,
        "max_capacity_kg": 2000.0,
    }


def test_ficticio_geometry_has_radius_heights_and_hook_position(client: TestClient) -> None:
    # L = 10 m, θ = 0°, ψ = 90°, c = 3 m → R = 11,5 m; y_T = h = 2,5 m; y_G = −0,5 m.
    # Com ψ = 90°, a lança aponta para +X:
    # P = (1,5; 2,5; 0), T = (11,5; 2,5; 0), G = (11,5; −0,5; 0).
    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(
            boom_length_m=10.0,
            boom_angle_deg=0.0,
            turret_rotation_deg=90.0,
            cable_length_m=3.0,
            load_weight_kg=2000.0,
        ),
    )

    body = response.json()
    assert body["status"] == "EVALUATED"
    geometry = body["geometry"]
    assert geometry["working_radius_m"] == 11.5
    assert geometry["tip_height_m"] == pytest.approx(2.5)
    assert geometry["hook_height_m"] == pytest.approx(-0.5)
    expected = {
        "boom_pivot": (1.5, 2.5, 0.0),
        "boom_tip": (11.5, 2.5, 0.0),
        "hook": (11.5, -0.5, 0),
    }
    for name, (x_m, y_m, z_m) in expected.items():
        assert geometry[name]["x_m"] == pytest.approx(x_m, abs=TOLERANCE_M)
        assert geometry[name]["y_m"] == pytest.approx(y_m, abs=TOLERANCE_M)
        assert geometry[name]["z_m"] == pytest.approx(z_m, abs=TOLERANCE_M)
    # Raio igual a um raio tabelado (11,5 m em L = 10 m): o ponto usado é esse, 4000 kg → 50 %.
    assert body["capacity"]["used_point"] == {
        "boom_length_m": 10.0,
        "working_radius_m": 11.5,
        "max_capacity_kg": 4000.0,
    }
    assert body["utilization_percent"] == pytest.approx(50.0)


def test_ficticio_utilization_above_100_percent_is_still_only_evaluated(client: TestClient) -> None:
    # Sem níveis de alerta (PEND-004): 3000 kg sobre 2000 kg dá 150 % e continua `EVALUATED`.
    response = client.post(EVALUATIONS_PATH, json=body_ficticio(load_weight_kg=3000.0))

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "EVALUATED"
    assert body["utilization_percent"] == pytest.approx(150.0)


def test_injected_strategy_without_mark_returns_capacity_without_strategy_or_used_point() -> None:
    # Com a `ExactPointLookup` (sem marca), a capacidade vem sem `strategy` nem ponto usado.
    client = client_ficticio(interpolator=ExactPointLookup())

    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(boom_length_m=10.0, boom_angle_deg=0.0, load_weight_kg=2000.0),
    )

    body = response.json()
    assert body["status"] == "EVALUATED"
    assert body["capacity"] == {
        "maximum_capacity_kg": 4000.0,
        "strategy": None,
        "queried_boom_length_m": None,
        "queried_working_radius_m": None,
        "used_point": None,
    }


# Não avaliável ------------------------------------------------------------------------------------


def test_ficticio_state_outside_the_ranges_is_not_evaluable_with_every_violation(
    client: TestClient,
) -> None:
    response = client.post(
        EVALUATIONS_PATH, json=body_ficticio(boom_length_m=35.0, boom_angle_deg=95.0)
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [
        ("BOOM_LENGTH_ABOVE_MAX", "OPERATIONAL_LIMIT"),
        ("BOOM_ANGLE_ABOVE_MAX", "OPERATIONAL_LIMIT"),
    ]
    assert body["geometry"] is None
    assert body["capacity"] is None
    assert body["utilization_percent"] is None
    assert body["load_chart_id"] is None
    assert body["load_chart_version"] is None


def test_ficticio_configuration_without_active_chart_keeps_the_geometry() -> None:
    client = client_ficticio()

    response = client.post(
        EVALUATIONS_PATH, json=body_ficticio(configuration_id=CONFIGURATION_SEM_TABELA_FICTICIA_ID)
    )

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [("ACTIVE_LOAD_CHART_NOT_FOUND", "EVALUATION")]
    assert body["geometry"]["working_radius_m"] == pytest.approx(
        1.5 + 10 * math.sqrt(3), abs=TOLERANCE_M
    )
    assert body["capacity"] is None
    assert body["utilization_percent"] is None
    assert body["load_chart_id"] is None


@pytest.mark.parametrize(
    ("boom_length_m", "boom_angle_deg", "expected_reason"),
    [
        # L = 20 m, θ = 80° → R = 1,5 + 20·cos 80° ≈ 4,97 m, abaixo do menor raio (11,5 m).
        (20.0, 80.0, "RADIUS_BELOW_CHART_MIN"),
    ],
)
def test_ficticio_state_outside_the_chart_domain_is_not_evaluable_with_the_chart_version(
    client: TestClient, boom_length_m: float, boom_angle_deg: float, expected_reason: str
) -> None:
    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(boom_length_m=boom_length_m, boom_angle_deg=boom_angle_deg),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [(expected_reason, "LOAD_CHART_DOMAIN")]
    assert body["geometry"] is not None
    assert body["capacity"] is None
    assert body["utilization_percent"] is None
    assert (body["load_chart_id"], body["load_chart_version"]) == (
        LOAD_CHART_AVALIACAO_FICTICIO_ID,
        LOAD_CHART_AVALIACAO_FICTICIO_VERSION,
    )


def test_ficticio_boom_tip_behind_the_slewing_axis_is_outside_the_geometric_domain(
    client: TestClient,
) -> None:
    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(
            configuration_id=CONFIGURATION_PINO_ATRAS_FICTICIA_ID, boom_angle_deg=90
        ),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [("OUTSIDE_GEOMETRIC_DOMAIN", "EVALUATION")]
    assert body["geometry"] is None
    assert body["capacity"] is None


def test_ficticio_zero_capacity_is_not_evaluable_and_shows_the_chart_capacity(
    client: TestClient,
) -> None:
    # L = 30 m, θ = 0° → R = 31,5 m, ponto FICTÍCIO de 0 kg: utilização indefinida.
    response = client.post(
        EVALUATIONS_PATH, json=body_ficticio(boom_length_m=30.0, boom_angle_deg=0.0)
    )

    body = response.json()
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [("UTILIZATION_UNDEFINED", "EVALUATION")]
    assert body["capacity"]["maximum_capacity_kg"] == 0.0
    assert body["capacity"]["strategy"] == "CONSERVATIVE_PROVISIONAL"
    assert body["utilization_percent"] is None


def test_unknown_configuration_is_not_evaluable_with_both_missing_data_reasons(
    client: TestClient,
) -> None:
    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(configuration_id=CONFIGURATION_DESCONHECIDA_FICTICIA_ID),
    )

    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "NOT_EVALUABLE"
    assert reason_codes(body) == [
        ("CRANE_GEOMETRY_NOT_FOUND", "EVALUATION"),
        ("ACTIVE_LOAD_CHART_NOT_FOUND", "EVALUATION"),
    ]


def test_provider_breaking_the_active_chart_contract_returns_500() -> None:
    # Tabela `DRAFT` devolvida como ativa: erro de programação no adapter, não "não avaliável".
    draft = build_load_chart_avaliacao_ficticio(status=LoadChartStatus.DRAFT)
    client = client_ficticio(
        charts={CONFIGURATION_AVALIACAO_FICTICIA_ID: draft}, raise_server_exceptions=False
    )

    response = client.post(EVALUATIONS_PATH, json=body_ficticio())

    assert response.status_code == 500


# Validação 422 ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "missing",
    [
        "configuration_id",
        "boom_length_m",
        "boom_angle_deg",
        "turret_rotation_deg",
        "cable_length_m",
        "load_weight_kg",
    ],
)
def test_missing_field_returns_422(client: TestClient, missing: str) -> None:
    body = {name: value for name, value in body_ficticio().items() if name != missing}

    response = client.post(EVALUATIONS_PATH, json=body)

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        ("missing", ["body", missing])
    ]


@pytest.mark.parametrize(
    ("field", "value", "error_type"),
    [
        ("boom_length_m", "20", "float_type"),
        ("boom_angle_deg", True, "float_type"),
        ("load_weight_kg", None, "float_type"),
        ("configuration_id", 123, "string_type"),
        ("boom_length_m", -1.0, "greater_than_equal"),
        ("cable_length_m", -0.5, "greater_than_equal"),
        ("load_weight_kg", -10.0, "greater_than_equal"),
        ("configuration_id", "", "string_too_short"),
        ("configuration_id", "   ", "string_pattern_mismatch"),
    ],
)
def test_malformed_field_returns_422(
    client: TestClient, field: str, value: object, error_type: str
) -> None:
    response = client.post(EVALUATIONS_PATH, json=body_ficticio(**{field: value}))

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        (error_type, ["body", field])
    ]


@pytest.mark.parametrize(
    ("literal", "echoed_input"),
    [("NaN", "NaN"), ("Infinity", "Infinity"), ("-Infinity", "-Infinity"), ("1e400", "Infinity")],
)
def test_non_finite_number_returns_422(client: TestClient, literal: str, echoed_input: str) -> None:
    # `NaN` e `Infinity` não são JSON padrão, mas o `json` do Python os aceita; `1e400` vira inf.
    # O 422 padrão do FastAPI quebraria (500) ao ecoar o valor não finito em `input`.
    content = (
        '{"configuration_id": "CFG-FICTICIA-AVALIACAO", "boom_length_m": 20.0, '
        f'"boom_angle_deg": {literal}, "turret_rotation_deg": 0.0, "cable_length_m": 1.0, '
        '"load_weight_kg": 1500.0}'
    )

    response = client.post(
        EVALUATIONS_PATH, content=content, headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        ("finite_number", ["body", "boom_angle_deg"])
    ]
    assert response.json()["detail"][0]["input"] == echoed_input


def test_unknown_field_returns_422(client: TestClient) -> None:
    response = client.post(EVALUATIONS_PATH, json=body_ficticio(crane_id="GUINDASTE-FICTICIO"))

    assert response.status_code == 422
    assert [(error["type"], error["loc"]) for error in response.json()["detail"]] == [
        ("extra_forbidden", ["body", "crane_id"])
    ]


def test_integer_numbers_are_accepted(client: TestClient) -> None:
    response = client.post(
        EVALUATIONS_PATH,
        json=body_ficticio(boom_length_m=20, boom_angle_deg=30, load_weight_kg=1500),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "EVALUATED"


def test_body_that_is_not_json_returns_422(client: TestClient) -> None:
    response = client.post(
        EVALUATIONS_PATH, content=b"isto nao e json", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422


# ground_slope_deg opcional (TASK-052) -------------------------------------------------------------


def test_ground_slope_deg_is_accepted_and_does_not_change_the_result(client: TestClient) -> None:
    without = client.post(EVALUATIONS_PATH, json=body_ficticio())
    with_slope = client.post(EVALUATIONS_PATH, json=body_ficticio(ground_slope_deg=2.5))

    assert with_slope.status_code == 200
    assert with_slope.json() == without.json()


@pytest.mark.parametrize("value", [-0.1, "2"])
def test_invalid_ground_slope_deg_answers_422(client: TestClient, value: Any) -> None:
    response = client.post(EVALUATIONS_PATH, json=body_ficticio(ground_slope_deg=value))

    assert response.status_code == 422
