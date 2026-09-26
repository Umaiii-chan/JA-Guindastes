# FICTÍCIO — cadastro inventado só para testar os cadastros do catálogo (ADR-012).
#
# Nenhum nome ou número daqui representa fabricante, guindaste, configuração ou ficha técnica real.
"""Repositório de catálogo em memória e dados FICTÍCIOS para os testes da TASK-030."""

from typing import Any

from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    CatalogReferenceNotFoundError,
    Crane,
    CraneConfiguration,
    Manufacturer,
)

FABRICANTE_FICTICIO_NOME = "Fabricante FICTÍCIO"
MODELO_FICTICIO_NOME = "Modelo FICTÍCIO"
CONFIGURACAO_FICTICIA_NOME = "Configuração FICTÍCIA"


def geometry_payload_ficticio(**overrides: Any) -> dict[str, Any]:
    """Ficha técnica FICTÍCIA no formato da API (mesmos valores de `crane_geometry_ficticia`)."""
    payload: dict[str, Any] = {
        "boom_pivot_offset_m": 1.5,
        "boom_pivot_height_m": 2.5,
        "boom_length_min_m": 10.0,
        "boom_length_max_m": 30.0,
        "boom_angle_min_deg": 0.0,
        "boom_angle_max_deg": 90.0,
        "cable_length_min_m": 0.0,
        "cable_length_max_m": 40.0,
        "turret_rotation_min_deg": None,
        "turret_rotation_max_deg": None,
    }
    payload.update(overrides)
    return payload


class InMemoryCraneCatalog:
    """`CraneCatalogStore` em memória, com o mesmo contrato do repositório SQLAlchemy."""

    def __init__(self) -> None:
        self.manufacturers: dict[str, Manufacturer] = {}
        self.cranes: dict[str, Crane] = {}
        self.configurations: dict[str, CraneConfiguration] = {}

    def add_manufacturer(self, manufacturer: Manufacturer) -> None:
        if manufacturer.id in self.manufacturers:
            raise CatalogEntryAlreadyExistsError("fabricante", manufacturer.id)
        self.manufacturers[manufacturer.id] = manufacturer

    def get_manufacturer(self, manufacturer_id: str) -> Manufacturer | None:
        return self.manufacturers.get(manufacturer_id)

    def add_crane(self, crane: Crane) -> None:
        if crane.id in self.cranes:
            raise CatalogEntryAlreadyExistsError("guindaste", crane.id)
        if crane.manufacturer_id not in self.manufacturers:
            raise CatalogReferenceNotFoundError("fabricante", crane.manufacturer_id)
        self.cranes[crane.id] = crane

    def get_crane(self, crane_id: str) -> Crane | None:
        return self.cranes.get(crane_id)

    def add_configuration(self, configuration: CraneConfiguration) -> None:
        if configuration.id in self.configurations:
            raise CatalogEntryAlreadyExistsError("configuração", configuration.id)
        if configuration.crane_id not in self.cranes:
            raise CatalogReferenceNotFoundError("guindaste", configuration.crane_id)
        self.configurations[configuration.id] = configuration

    def get_configuration(self, configuration_id: str) -> CraneConfiguration | None:
        return self.configurations.get(configuration_id)

    def list_manufacturers(self) -> list[Manufacturer]:
        return sorted(self.manufacturers.values(), key=lambda item: (item.name, item.id))

    def list_cranes(self, manufacturer_id: str | None = None) -> list[Crane]:
        cranes = [
            crane
            for crane in self.cranes.values()
            if manufacturer_id is None or crane.manufacturer_id == manufacturer_id
        ]
        return sorted(cranes, key=lambda item: (item.model_name, item.id))

    def list_configurations(self, crane_id: str) -> list[CraneConfiguration]:
        configurations = [
            item for item in self.configurations.values() if item.crane_id == crane_id
        ]
        return sorted(configurations, key=lambda item: (item.name, item.id))


class SequentialIds:
    """Gerador de ids previsível para os testes: `ID-FICTICIO-1`, `ID-FICTICIO-2`, ..."""

    def __init__(self) -> None:
        self.count = 0

    def __call__(self) -> str:
        self.count += 1
        return f"ID-FICTICIO-{self.count}"
