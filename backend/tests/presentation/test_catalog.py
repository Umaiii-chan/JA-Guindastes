"""Rotas REST do catálogo com `TestClient` e repositório em memória (TASK-030). Dados FICTÍCIOS."""

from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.infrastructure.database.config import DatabaseConfigurationError
from app.main import build_catalog_repository
from app.presentation.api.catalog import create_catalog_router
from app.presentation.api.main import create_app
from tests.fixtures.crane_catalog_ficticio import (
    CONFIGURACAO_FICTICIA_NOME,
    FABRICANTE_FICTICIO_NOME,
    MODELO_FICTICIO_NOME,
    InMemoryCraneCatalog,
    geometry_payload_ficticio,
)

MANUFACTURERS = "/api/v1/manufacturers"
CRANES = "/api/v1/cranes"
CONFIGURATIONS = "/api/v1/configurations"


@pytest.fixture
def repository() -> InMemoryCraneCatalog:
    return InMemoryCraneCatalog()


@pytest.fixture
def client(repository: InMemoryCraneCatalog) -> TestClient:
    return TestClient(create_app(catalog_repository=repository))


def create_manufacturer(client: TestClient, name: str = FABRICANTE_FICTICIO_NOME) -> str:
    response = client.post(MANUFACTURERS, json={"name": name})
    assert response.status_code == 201, response.text
    manufacturer_id: str = response.json()["id"]
    return manufacturer_id


def create_crane(
    client: TestClient, manufacturer_id: str, model_name: str = MODELO_FICTICIO_NOME
) -> str:
    response = client.post(
        CRANES, json={"manufacturer_id": manufacturer_id, "model_name": model_name}
    )
    assert response.status_code == 201, response.text
    crane_id: str = response.json()["id"]
    return crane_id


def configurations_path(crane_id: str) -> str:
    return f"{CRANES}/{crane_id}/configurations"


# --- Fabricantes (CA-1) -------------------------------------------------------------------------


def test_post_manufacturer_returns_201_with_server_generated_uuid(client: TestClient) -> None:
    response = client.post(MANUFACTURERS, json={"name": FABRICANTE_FICTICIO_NOME})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == FABRICANTE_FICTICIO_NOME
    assert UUID(body["id"]).version == 4


def test_list_and_get_manufacturers(client: TestClient) -> None:
    second = create_manufacturer(client, "Fabricante FICTÍCIO B")
    first = create_manufacturer(client, "Fabricante FICTÍCIO A")

    listed = client.get(MANUFACTURERS)
    fetched = client.get(f"{MANUFACTURERS}/{second}")

    assert listed.status_code == 200
    assert listed.json() == [
        {"id": first, "name": "Fabricante FICTÍCIO A"},
        {"id": second, "name": "Fabricante FICTÍCIO B"},
    ]
    assert fetched.status_code == 200
    assert fetched.json() == {"id": second, "name": "Fabricante FICTÍCIO B"}


def test_empty_catalog_lists_nothing(client: TestClient) -> None:
    assert client.get(MANUFACTURERS).json() == []
    assert client.get(CRANES).json() == []


def test_get_missing_manufacturer_returns_404(client: TestClient) -> None:
    response = client.get(f"{MANUFACTURERS}/NAO-EXISTE")

    assert response.status_code == 404
    assert "fabricante" in response.json()["detail"]


# --- Guindastes (CA-2) --------------------------------------------------------------------------


def test_post_crane_list_and_get(client: TestClient) -> None:
    manufacturer_id = create_manufacturer(client)
    other_manufacturer_id = create_manufacturer(client, "Outro fabricante FICTÍCIO")

    response = client.post(
        CRANES, json={"manufacturer_id": manufacturer_id, "model_name": MODELO_FICTICIO_NOME}
    )
    other_crane_id = create_crane(client, other_manufacturer_id, "Modelo FICTÍCIO Z")

    assert response.status_code == 201
    crane = response.json()
    assert crane["manufacturer_id"] == manufacturer_id
    assert crane["model_name"] == MODELO_FICTICIO_NOME
    assert UUID(crane["id"]).version == 4
    assert client.get(f"{CRANES}/{crane['id']}").json() == crane
    assert [item["id"] for item in client.get(CRANES).json()] == [crane["id"], other_crane_id]
    filtered = client.get(CRANES, params={"manufacturer_id": manufacturer_id})
    assert filtered.json() == [crane]


def test_post_crane_for_missing_manufacturer_returns_404(
    client: TestClient, repository: InMemoryCraneCatalog
) -> None:
    response = client.post(
        CRANES, json={"manufacturer_id": "NAO-EXISTE", "model_name": MODELO_FICTICIO_NOME}
    )

    assert response.status_code == 404
    assert "fabricante" in response.json()["detail"]
    assert repository.cranes == {}


def test_list_cranes_of_missing_manufacturer_returns_404(client: TestClient) -> None:
    response = client.get(CRANES, params={"manufacturer_id": "NAO-EXISTE"})

    assert response.status_code == 404


def test_get_missing_crane_returns_404(client: TestClient) -> None:
    assert client.get(f"{CRANES}/NAO-EXISTE").status_code == 404


# --- Configurações (CA-3) -----------------------------------------------------------------------


def test_post_configuration_with_geometry_round_trips(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    geometry = geometry_payload_ficticio(
        boom_pivot_offset_m=-0.5, turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0
    )

    response = client.post(
        configurations_path(crane_id),
        json={"name": CONFIGURACAO_FICTICIA_NOME, "geometry": geometry},
    )

    assert response.status_code == 201
    configuration = response.json()
    assert configuration["crane_id"] == crane_id
    assert configuration["name"] == CONFIGURACAO_FICTICIA_NOME
    assert configuration["geometry"] == geometry
    assert UUID(configuration["id"]).version == 4
    assert client.get(f"{CONFIGURATIONS}/{configuration['id']}").json() == configuration
    assert client.get(configurations_path(crane_id)).json() == [configuration]


def test_post_configuration_without_geometry_returns_null_geometry(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))

    response = client.post(configurations_path(crane_id), json={"name": CONFIGURACAO_FICTICIA_NOME})

    assert response.status_code == 201
    assert response.json()["geometry"] is None


def test_optional_geometry_fields_can_be_omitted_and_integers_are_accepted(
    client: TestClient,
) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    geometry = {
        "boom_pivot_offset_m": 0,
        "boom_pivot_height_m": 2,
        "boom_length_min_m": 10,
        "boom_length_max_m": 10,
        "boom_angle_min_deg": 0,
        "boom_angle_max_deg": 80,
        "cable_length_min_m": 0,
    }

    response = client.post(
        configurations_path(crane_id),
        json={"name": CONFIGURACAO_FICTICIA_NOME, "geometry": geometry},
    )

    assert response.status_code == 201, response.text
    returned = response.json()["geometry"]
    assert returned["boom_length_max_m"] == 10.0
    assert returned["cable_length_max_m"] is None
    assert returned["turret_rotation_min_deg"] is None


def test_configurations_are_listed_by_name(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    for name in ("Configuração FICTÍCIA B", "Configuração FICTÍCIA A"):
        client.post(configurations_path(crane_id), json={"name": name})

    names = [item["name"] for item in client.get(configurations_path(crane_id)).json()]

    assert names == ["Configuração FICTÍCIA A", "Configuração FICTÍCIA B"]


def test_configuration_routes_for_missing_crane_return_404(client: TestClient) -> None:
    created = client.post(
        configurations_path("NAO-EXISTE"), json={"name": CONFIGURACAO_FICTICIA_NOME}
    )
    listed = client.get(configurations_path("NAO-EXISTE"))

    assert created.status_code == 404
    assert "guindaste" in created.json()["detail"]
    assert listed.status_code == 404


def test_get_missing_configuration_returns_404(client: TestClient) -> None:
    assert client.get(f"{CONFIGURATIONS}/NAO-EXISTE").status_code == 404


# --- Conflito (CA-4) ----------------------------------------------------------------------------


def test_repeated_id_signalled_by_the_repository_returns_409() -> None:
    app = FastAPI()
    app.include_router(
        create_catalog_router(InMemoryCraneCatalog(), id_generator=lambda: "ID-FICTICIO-REPETIDO")
    )
    client = TestClient(app)
    assert client.post(MANUFACTURERS, json={"name": FABRICANTE_FICTICIO_NOME}).status_code == 201

    response = client.post(MANUFACTURERS, json={"name": "Outro fabricante FICTÍCIO"})

    assert response.status_code == 409
    assert "já existe" in response.json()["detail"]


def test_repeated_names_are_accepted(client: TestClient) -> None:
    first = create_manufacturer(client)
    second = create_manufacturer(client)

    assert first != second


# --- Validação (CA-5) ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": ""},
        {"name": "   "},
        {"name": 123},
        {"name": None},
        {"name": FABRICANTE_FICTICIO_NOME, "id": "ID-DO-CLIENTE"},
    ],
    ids=["ausente", "vazio", "so-espacos", "numero", "nulo", "id-do-cliente"],
)
def test_malformed_manufacturer_returns_422(
    client: TestClient, repository: InMemoryCraneCatalog, body: dict[str, Any]
) -> None:
    response = client.post(MANUFACTURERS, json=body)

    assert response.status_code == 422
    assert repository.manufacturers == {}


@pytest.mark.parametrize(
    "body",
    [
        {"model_name": MODELO_FICTICIO_NOME},
        {"manufacturer_id": "", "model_name": MODELO_FICTICIO_NOME},
        {"manufacturer_id": "FAB", "model_name": " "},
        {"manufacturer_id": "FAB", "model_name": MODELO_FICTICIO_NOME, "capacity_kg": 1000},
    ],
    ids=["sem-fabricante", "fabricante-vazio", "modelo-so-espacos", "campo-desconhecido"],
)
def test_malformed_crane_returns_422(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(CRANES, json=body).status_code == 422


@pytest.mark.parametrize(
    "geometry_overrides",
    [
        {"boom_length_min_m": 31.0},
        {"boom_angle_min_deg": 91.0},
        {"boom_angle_min_deg": -90.0},
        {"boom_angle_max_deg": 91.0},
        {"cable_length_min_m": 41.0},
        {"turret_rotation_min_deg": -30.0},
        {"turret_rotation_min_deg": 0.0, "turret_rotation_max_deg": 360.0},
        {"boom_pivot_height_m": -1.0},
        {"cable_length_max_m": -1.0},
        {"boom_length_max_m": "30"},
        {"boom_angle_max_deg": True},
        {"alcance_m": 5.0},
    ],
    ids=[
        "lanca-min-maior-que-max",
        "angulo-min-maior-que-max",
        "angulo-min-no-limite-inferior",
        "angulo-max-acima-de-90",
        "cabo-min-maior-que-max",
        "giro-com-um-so-limite",
        "giro-de-360",
        "altura-negativa",
        "cabo-max-negativo",
        "numero-em-texto",
        "booleano",
        "campo-desconhecido",
    ],
)
def test_malformed_geometry_returns_422(
    client: TestClient, repository: InMemoryCraneCatalog, geometry_overrides: dict[str, Any]
) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    body = {
        "name": CONFIGURACAO_FICTICIA_NOME,
        "geometry": geometry_payload_ficticio(**geometry_overrides),
    }

    response = client.post(configurations_path(crane_id), json=body)

    assert response.status_code == 422, response.text
    assert repository.configurations == {}


def test_missing_required_geometry_field_returns_422(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    geometry = geometry_payload_ficticio()
    del geometry["boom_pivot_height_m"]

    response = client.post(
        configurations_path(crane_id),
        json={"name": CONFIGURACAO_FICTICIA_NOME, "geometry": geometry},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity", "1e400"])
def test_non_finite_geometry_number_returns_valid_json_422(
    client: TestClient, literal: str
) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    content = (
        '{"name": "Configuração FICTÍCIA", "geometry": {"boom_pivot_offset_m": '
        + literal
        + ', "boom_pivot_height_m": 2.5, "boom_length_min_m": 10, "boom_length_max_m": 30, '
        '"boom_angle_min_deg": 0, "boom_angle_max_deg": 90, "cable_length_min_m": 0}}'
    )

    response = client.post(
        configurations_path(crane_id),
        content=content.encode(),
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_incoherent_geometry_error_explains_the_domain_rule(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    body = {
        "name": CONFIGURACAO_FICTICIA_NOME,
        "geometry": geometry_payload_ficticio(boom_length_min_m=31.0),
    }

    response = client.post(configurations_path(crane_id), json=body)

    messages = " ".join(error["msg"] for error in response.json()["detail"])
    assert "boom_length_min maior que boom_length_max" in messages


# --- Edição (TASK-044, CA-2) --------------------------------------------------------------------


def create_configuration(
    client: TestClient, crane_id: str, geometry: dict[str, Any] | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {"name": CONFIGURACAO_FICTICIA_NOME}
    if geometry is not None:
        body["geometry"] = geometry
    response = client.post(configurations_path(crane_id), json=body)
    assert response.status_code == 201, response.text
    configuration: dict[str, Any] = response.json()
    return configuration


def test_patch_manufacturer_renames_and_returns_the_create_schema(client: TestClient) -> None:
    manufacturer_id = create_manufacturer(client)

    response = client.patch(
        f"{MANUFACTURERS}/{manufacturer_id}", json={"name": "Fabricante FICTÍCIO renomeado"}
    )

    assert response.status_code == 200
    assert response.json() == {"id": manufacturer_id, "name": "Fabricante FICTÍCIO renomeado"}
    assert client.get(f"{MANUFACTURERS}/{manufacturer_id}").json() == response.json()


def test_patch_crane_renames_the_model_and_keeps_the_manufacturer(client: TestClient) -> None:
    manufacturer_id = create_manufacturer(client)
    crane_id = create_crane(client, manufacturer_id)

    response = client.patch(f"{CRANES}/{crane_id}", json={"model_name": "Modelo FICTÍCIO B"})

    assert response.status_code == 200
    assert response.json() == {
        "id": crane_id,
        "manufacturer_id": manufacturer_id,
        "model_name": "Modelo FICTÍCIO B",
        # Limites padrão do modelo (TASK-051).
        "capacity_limit_percent": 100.0,
        "warning_band_percent": 90.0,
        "max_ground_slope_deg": 1.0,
        "max_leveling_deg": 3.0,
        "slope_derating_percent_per_deg": 10.0,
        "crane_mass_kg": 36000.0,
        "outrigger_pad_area_m2": 0.5,
    }
    assert client.get(f"{CRANES}/{crane_id}").json() == response.json()


def test_patch_configuration_name_only_keeps_the_geometry(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    configuration = create_configuration(client, crane_id, geometry_payload_ficticio())

    response = client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}", json={"name": "Configuração FICTÍCIA B"}
    )

    assert response.status_code == 200
    assert response.json() == {**configuration, "name": "Configuração FICTÍCIA B"}


def test_patch_configuration_geometry_replaces_the_whole_sheet(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    configuration = create_configuration(
        client,
        crane_id,
        geometry_payload_ficticio(turret_rotation_min_deg=-30.0, turret_rotation_max_deg=30.0),
    )
    new_geometry = {
        "boom_pivot_offset_m": -1.56,
        "boom_pivot_height_m": 2.0,
        "boom_length_min_m": 9.0,
        "boom_length_max_m": 12.0,
        "boom_angle_min_deg": 0.0,
        "boom_angle_max_deg": 80.0,
        "cable_length_min_m": 0.0,
    }

    response = client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}", json={"geometry": new_geometry}
    )

    assert response.status_code == 200, response.text
    returned = response.json()
    assert returned["name"] == CONFIGURACAO_FICTICIA_NOME
    # A ficha inteira é trocada: os opcionais ausentes voltam como `null`, sem sobrar os antigos.
    assert returned["geometry"] == {
        **new_geometry,
        "cable_length_max_m": None,
        "turret_rotation_min_deg": None,
        "turret_rotation_max_deg": None,
    }
    assert client.get(f"{CONFIGURATIONS}/{configuration['id']}").json() == returned


def test_patch_configuration_adds_a_sheet_and_renames_together(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    configuration = create_configuration(client, crane_id)

    response = client.patch(
        f"{CONFIGURATIONS}/{configuration['id']}",
        json={"name": "Com ficha", "geometry": geometry_payload_ficticio()},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": configuration["id"],
        "crane_id": crane_id,
        "name": "Com ficha",
        "geometry": geometry_payload_ficticio(),
        "rotation_zones": None,
        "hook_block_weight_kg": None,
    }


@pytest.mark.parametrize(
    ("path", "body"),
    [
        (f"{MANUFACTURERS}/NAO-EXISTE", {"name": "Nome"}),
        (f"{CRANES}/NAO-EXISTE", {"model_name": "Modelo"}),
        (f"{CONFIGURATIONS}/NAO-EXISTE", {"name": "Configuração"}),
    ],
    ids=["fabricante", "guindaste", "configuracao"],
)
def test_patch_missing_record_returns_404(
    client: TestClient, path: str, body: dict[str, Any]
) -> None:
    response = client.patch(path, json=body)

    assert response.status_code == 404
    assert "não existe" in response.json()["detail"]


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": ""},
        {"name": "   "},
        {"name": 123},
        {"name": None},
        {"name": "Nome", "id": "OUTRO-ID"},
    ],
    ids=["ausente", "vazio", "so-espacos", "numero", "nulo", "id-no-corpo"],
)
def test_malformed_manufacturer_patch_returns_422(
    client: TestClient, repository: InMemoryCraneCatalog, body: dict[str, Any]
) -> None:
    manufacturer_id = create_manufacturer(client)

    response = client.patch(f"{MANUFACTURERS}/{manufacturer_id}", json=body)

    assert response.status_code == 422
    assert repository.manufacturers[manufacturer_id].name == FABRICANTE_FICTICIO_NOME


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"model_name": " "},
        {"model_name": None},
        {"model_name": "Modelo", "manufacturer_id": "OUTRO-FABRICANTE"},
    ],
    ids=["ausente", "so-espacos", "nulo", "troca-de-fabricante"],
)
def test_malformed_crane_patch_returns_422(client: TestClient, body: dict[str, Any]) -> None:
    crane_id = create_crane(client, create_manufacturer(client))

    assert client.patch(f"{CRANES}/{crane_id}", json=body).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": None},
        {"geometry": None},
        {"name": " "},
        {"crane_id": "OUTRO-GUINDASTE"},
        {"geometry": geometry_payload_ficticio(boom_length_min_m=31.0)},
        {"geometry": geometry_payload_ficticio(turret_rotation_min_deg=-30.0)},
        {"geometry": geometry_payload_ficticio(boom_length_max_m="30")},
    ],
    ids=[
        "nenhum-campo",
        "nome-nulo",
        "ficha-nula",
        "nome-so-espacos",
        "troca-de-guindaste",
        "ficha-incoerente",
        "giro-com-um-so-limite",
        "numero-em-texto",
    ],
)
def test_malformed_configuration_patch_returns_422_and_changes_nothing(
    client: TestClient, repository: InMemoryCraneCatalog, body: dict[str, Any]
) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    configuration = create_configuration(client, crane_id, geometry_payload_ficticio())

    response = client.patch(f"{CONFIGURATIONS}/{configuration['id']}", json=body)

    assert response.status_code == 422, response.text
    assert client.get(f"{CONFIGURATIONS}/{configuration['id']}").json() == configuration


def test_configuration_patch_without_fields_explains_the_rule(client: TestClient) -> None:
    crane_id = create_crane(client, create_manufacturer(client))
    configuration = create_configuration(client, crane_id)

    response = client.patch(f"{CONFIGURATIONS}/{configuration['id']}", json={})

    messages = " ".join(error["msg"] for error in response.json()["detail"])
    assert "informe ao menos um campo" in messages


def test_patch_validates_the_body_before_looking_up_the_record(client: TestClient) -> None:
    response = client.patch(f"{CONFIGURATIONS}/NAO-EXISTE", json={"geometry": None})

    assert response.status_code == 422


def test_patch_accepts_a_repeated_name(client: TestClient) -> None:
    first = create_manufacturer(client, "Fabricante FICTÍCIO A")
    create_manufacturer(client, "Fabricante FICTÍCIO B")

    response = client.patch(f"{MANUFACTURERS}/{first}", json={"name": "Fabricante FICTÍCIO B"})

    assert response.status_code == 200


# --- Registro e composição ----------------------------------------------------------------------


def test_app_without_catalog_repository_does_not_expose_the_routes() -> None:
    client = TestClient(create_app())

    assert client.get(MANUFACTURERS).status_code == 404
    assert not any(
        path.startswith(MANUFACTURERS) for path in client.get("/openapi.json").json()["paths"]
    )


def test_openapi_documents_the_catalog_routes(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert set(paths[MANUFACTURERS]) == {"get", "post"}
    assert set(paths[f"{MANUFACTURERS}/{{manufacturer_id}}"]) == {"get", "patch"}
    assert set(paths[CRANES]) == {"get", "post"}
    assert set(paths[f"{CRANES}/{{crane_id}}"]) == {"get", "patch"}
    assert set(paths[f"{CRANES}/{{crane_id}}/configurations"]) == {"get", "post"}
    assert set(paths[f"{CONFIGURATIONS}/{{configuration_id}}"]) == {"get", "patch"}
    post_crane = paths[CRANES]["post"]["responses"]
    assert {"201", "404", "409", "422"} <= set(post_crane)
    patch_configuration = paths[f"{CONFIGURATIONS}/{{configuration_id}}"]["patch"]["responses"]
    assert {"200", "404", "422"} <= set(patch_configuration)


def test_composition_without_database_url_registers_no_catalog() -> None:
    assert build_catalog_repository({}) is None
    assert build_catalog_repository({"DATABASE_URL": "   "}) is None


def test_composition_with_database_url_builds_the_repository_without_connecting() -> None:
    # URL FICTÍCIA: criar o engine não abre conexão.
    url = "postgresql+psycopg://usuario_ficticio:senha_ficticia@host-ficticio.invalid:5432/banco"

    assert build_catalog_repository({"DATABASE_URL": url}) is not None


def test_composition_with_invalid_database_url_fails_fast() -> None:
    with pytest.raises(DatabaseConfigurationError):
        build_catalog_repository({"DATABASE_URL": "mysql://host-ficticio.invalid/banco"})
