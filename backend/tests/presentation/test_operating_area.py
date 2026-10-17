"""`POST /api/v1/configurations/{id}/operating-area` (TASK-055; ADR-025; RN-011).

Dados FICTÍCIOS (ADR-012): ficha técnica e tabela de `tests/fixtures`. Com L = 20 m (a = 1,5 m), a
grade vai até R = 21 m; a tabela só cobre de 11,5 m (5000 kg) a 21,5 m (2000 kg), e entre os dois
vale a menor capacidade (2000 kg).
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.application.use_cases.compute_operating_area import ComputeOperatingArea
from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.safety_profile import SafetyProfile
from app.presentation.api.main import create_app
from app.presentation.api.operating_area import shared_compute_operating_area
from tests.fixtures.acessorios_ficticios import (
    CINTA_FICTICIA,
    GANCHO_ACESSORIO_FICTICIO,
    MANILHA_FICTICIA,
    InMemoryAccessories,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia

URL = f"/api/v1/configurations/{CONFIGURATION_AVALIACAO_FICTICIA_ID}/operating-area"


class FakeGeometry:
    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        if configuration_id == CONFIGURATION_AVALIACAO_FICTICIA_ID:
            return build_crane_geometry_ficticia()
        return None


class FakeCharts:
    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        if configuration_id == CONFIGURATION_AVALIACAO_FICTICIA_ID:
            return build_load_chart_avaliacao_ficticio()
        return None


class FakeProfile:
    def __init__(self, profile: SafetyProfile) -> None:
        self._profile = profile

    def get_safety_profile(self, configuration_id: str) -> SafetyProfile | None:
        return self._profile


def make_client(
    profile: SafetyProfile | None = None, accessories: InMemoryAccessories | None = None
) -> TestClient:
    use_case = ComputeOperatingArea(
        crane_geometry_provider=FakeGeometry(),
        active_load_chart_provider=FakeCharts(),
        load_chart_interpolator=ConservativeTabulatedLookup(),
        safety_profile_provider=None if profile is None else FakeProfile(profile),
        accessory_provider=accessories,
    )
    return TestClient(create_app(operating_area=shared_compute_operating_area(use_case)))


def level_at(body: dict[str, Any], psi: float, radius: float) -> str:
    return next(
        cell["level"]
        for cell in body["cells"]
        if cell["psi_deg"] == psi and cell["radius_m"] == radius
    )


def post(client: TestClient, **overrides: Any) -> Any:
    body = {"boom_length_m": 20.0, "load_weight_kg": 1500.0}
    body.update(overrides)
    return client.post(URL, json=body)


def test_grid_shape_and_defaults() -> None:
    response = post(make_client())

    assert response.status_code == 200
    body = response.json()
    assert (body["psi_step_deg"], body["radius_step_m"]) == (10, 1)
    assert body["max_radius_m"] == pytest.approx(21.5)
    assert len(body["cells"]) == 36 * 21
    assert {cell["level"] for cell in body["cells"]} <= {"GREEN", "YELLOW", "RED"}


def test_green_inside_the_table_and_red_outside() -> None:
    body = post(make_client()).json()

    assert level_at(body, 0.0, 12.0) == "GREEN"  # 1500 kg / 2000 kg = 75 %
    assert level_at(body, 0.0, 11.0) == "RED"  # abaixo do menor raio da tabela
    assert level_at(body, 0.0, 21.0) == "GREEN"


def test_yellow_in_the_warning_band_and_red_above_the_limit() -> None:
    client = make_client()
    assert level_at(post(client, load_weight_kg=1900.0).json(), 0.0, 12.0) == "YELLOW"
    assert level_at(post(client, load_weight_kg=2500.0).json(), 0.0, 12.0) == "RED"


def test_model_limit_turns_the_same_cell_red() -> None:
    client = make_client(SafetyProfile(capacity_limit_percent=50.0))
    # Capacidade efetiva 1000 kg: 1500 kg passa do limite.
    assert level_at(post(client).json(), 0.0, 12.0) == "RED"


def test_steps_are_applied() -> None:
    body = post(make_client(), psi_step_deg=90, radius_step_m=5).json()

    assert sorted({cell["psi_deg"] for cell in body["cells"]}) == [0, 90, 180, 270]
    assert sorted({cell["radius_m"] for cell in body["cells"]}) == [5, 10, 15, 20]


def test_unknown_configuration_is_404() -> None:
    response = make_client().post(
        "/api/v1/configurations/CFG-FICTICIA-NAO-EXISTE/operating-area",
        json={"boom_length_m": 20.0, "load_weight_kg": 0.0},
    )
    assert response.status_code == 404


def test_boom_outside_the_data_sheet_is_422() -> None:
    assert post(make_client(), boom_length_m=99.0).status_code == 422


def test_grid_too_large_is_422() -> None:
    response = post(make_client(), psi_step_deg=0.01, radius_step_m=0.01)
    assert response.status_code == 422


@pytest.mark.parametrize("field", ["psi_step_deg", "radius_step_m"])
def test_non_positive_step_is_422(field: str) -> None:
    assert post(make_client(), **{field: 0}).status_code == 422


def test_unknown_field_is_422() -> None:
    assert post(make_client(), extra=1).status_code == 422


# --- TASK-094 (F-15; RN-014): acessórios no peso comparado ---------------------------------------


def accessory_client() -> TestClient:
    return make_client(
        accessories=InMemoryAccessories(GANCHO_ACESSORIO_FICTICIO, MANILHA_FICTICIA, CINTA_FICTICIA)
    )


def test_accessories_add_to_the_compared_weight() -> None:
    # 1700 kg + moitão 200 + manilha 20 + cinta 15 = 1935 kg (sem gancho na configuração).
    ids = [GANCHO_ACESSORIO_FICTICIO.id, MANILHA_FICTICIA.id, CINTA_FICTICIA.id]
    client = accessory_client()

    without = post(client, load_weight_kg=1700.0).json()
    with_accessories = post(client, load_weight_kg=1700.0, accessory_ids=ids).json()

    assert without["compared_weight_kg"] == pytest.approx(1700.0)
    assert with_accessories["compared_weight_kg"] == pytest.approx(1935.0)
    # 1700 / 2000 = 85 % (verde); 1935 / 2000 = 96,75 % (faixa de atenção de 90 %).
    assert level_at(without, 0.0, 12.0) == "GREEN"
    assert level_at(with_accessories, 0.0, 12.0) == "YELLOW"


def test_accessories_can_push_a_cell_over_the_limit() -> None:
    # 1900 kg sozinhos ficam na atenção (95 %); com o moitão, 2100 kg passam de 2000 kg.
    client = accessory_client()

    assert level_at(post(client, load_weight_kg=1900.0).json(), 0.0, 12.0) == "YELLOW"
    body = post(client, load_weight_kg=1900.0, accessory_ids=[GANCHO_ACESSORIO_FICTICIO.id]).json()
    assert level_at(body, 0.0, 12.0) == "RED"


def test_a_repeated_accessory_adds_again() -> None:
    body = post(accessory_client(), accessory_ids=[MANILHA_FICTICIA.id, MANILHA_FICTICIA.id]).json()

    assert body["compared_weight_kg"] == pytest.approx(1540.0)


def test_unknown_accessory_is_422_instead_of_underestimating() -> None:
    response = post(accessory_client(), accessory_ids=[MANILHA_FICTICIA.id, "ACC-NAO-EXISTE"])

    assert response.status_code == 422
    assert "ACC-NAO-EXISTE" in response.json()["detail"]


def test_accessories_without_a_catalog_are_422() -> None:
    response = post(make_client(), accessory_ids=[MANILHA_FICTICIA.id])

    assert response.status_code == 422


@pytest.mark.parametrize("ids", [[""], ["x" * 65], ["ACC"] * 21, "ACC"])
def test_malformed_accessory_ids_are_422(ids: Any) -> None:
    assert post(accessory_client(), accessory_ids=ids).status_code == 422
