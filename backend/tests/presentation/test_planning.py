"""`POST /api/v1/planning/recommend` (TASK-075; ADR-038). Dados FICTÍCIOS (ADR-012)."""

from typing import Any

from fastapi.testclient import TestClient

from app.presentation.api.main import create_app
from app.presentation.api.planning import PLANNING_PATH, shared_recommend_lift_plan
from tests.fixtures.planejamento_ficticio import caso_de_uso_planejamento


def make_client(*, com_grande: bool = False) -> TestClient:
    use_case = caso_de_uso_planejamento(com_grande=com_grande)
    return TestClient(create_app(planning=shared_recommend_lift_plan(use_case)))


def body(weight_kg: float = 2000.0, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "load": {"weight_kg": weight_kg, "length_m": 3.0, "width_m": 1.5, "height_m": 1.2},
        "pick": {"x": -7.5, "z": 0.0},
        "delivery": {"x": 7.5, "z": 0.0},
        "scenario": {
            "terrain": {"slope_x_percent": 0, "slope_z_percent": 0, "features": []},
            "obstacles": [
                {
                    "id": "OBS-1",
                    "label": "Container FICTÍCIO",
                    "kind": "box",
                    "center_x": 0,
                    "center_z": 0,
                    "width_m": 6,
                    "depth_m": 3,
                    "height_m": 3,
                    "rotation_y_deg": 0,
                }
            ],
            "crane": {"x": 0, "z": 0, "heading_deg": 0},
        },
    }
    payload.update(overrides)
    return payload


def test_recomenda_com_o_contrato_da_tarefa() -> None:
    response = make_client().post(PLANNING_PATH, json=body())

    assert response.status_code == 200
    data = response.json()
    best = data["recommendations"][0]
    assert best["kind"] == "single"
    assert best["valid"] is True
    assert len(best["configuration_ids"]) == 1
    assert set(best["placements"][0]) == {"x", "z", "heading_deg"}
    assert best["max_limit_utilization_percent"] > 0
    assert best["tipping_risk"] in {"LOW", "ATTENTION", "HIGH"}
    first = best["trajectory"][0]
    assert set(first) == {"t_s", "crane_index", "state", "phase"}
    assert set(first["state"]) == {
        "boom_length_m",
        "boom_angle_deg",
        "turret_rotation_deg",
        "cable_length_m",
    }
    assert {point["phase"] for point in best["trajectory"]} == {
        "aproximar",
        "engatar",
        "levantar",
        "girar",
        "baixar",
        "soltar",
    }
    assert best["notes"]
    assert data["timed_out"] is False


def test_busca_cortada_pelo_tempo_vem_marcada() -> None:
    ticks = iter(range(0, 10_000))
    use_case = caso_de_uso_planejamento(time_budget_s=0.0, clock=lambda: float(next(ticks)))
    client = TestClient(create_app(planning=shared_recommend_lift_plan(use_case)))

    response = client.post(PLANNING_PATH, json=body())

    assert response.status_code == 200
    assert response.json()["timed_out"] is True


def test_carga_pesada_devolve_tandem_com_duas_trajetorias() -> None:
    # Viga FICTÍCIA de 16 m: o par de guindastes gira no mesmo sentido (TASK-089, F-04).
    payload = body(4000.0)
    payload["load"] = {"weight_kg": 4000.0, "length_m": 16.0, "width_m": 1.0, "height_m": 1.0}
    payload["pick"] = {"x": 0.0, "z": 0.0}
    payload["delivery"] = {"x": 4.0, "z": 0.0}
    del payload["scenario"]
    data = make_client().post(PLANNING_PATH, json=payload).json()

    best = data["recommendations"][0]
    assert best["kind"] == "tandem"
    assert len(best["placements"]) == 2
    assert {point["crane_index"] for point in best["trajectory"]} == {0, 1}


def test_sem_cenario_usa_chao_plano_e_livre() -> None:
    payload = body()
    del payload["scenario"]

    response = make_client().post(PLANNING_PATH, json=payload)

    assert response.status_code == 200
    assert response.json()["recommendations"][0]["details"][0]["crossed_obstacle_ids"] == []


def test_requisicao_malformada_e_422() -> None:
    payload = body()
    payload["load"]["weight_kg"] = 0

    assert make_client().post(PLANNING_PATH, json=payload).status_code == 422
    assert make_client().post(PLANNING_PATH, json={"load": {}}).status_code == 422


def test_cenario_invalido_e_422() -> None:
    payload = body()
    payload["scenario"]["obstacles"][0]["height_m"] = -1

    response = make_client().post(PLANNING_PATH, json=payload)

    assert response.status_code == 422


def test_acessorio_inexistente_e_422() -> None:
    response = make_client().post(PLANNING_PATH, json=body(accessory_ids=["NAO-EXISTE"]))

    assert response.status_code == 422
    assert "NAO-EXISTE" in response.json()["detail"]


def test_o_openapi_publica_a_rota() -> None:
    schema = make_client().get("/openapi.json").json()

    assert PLANNING_PATH in schema["paths"]
