from fastapi.testclient import TestClient

from app.presentation.api.main import app


def test_openapi_contract_is_exposed() -> None:
    # RNF-007: o backend expõe contrato OpenAPI.
    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Crane Simulator API"
