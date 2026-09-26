# FICTÍCIO — cadastro inventado só para testar a persistência (ADR-012).
#
# Nenhum nome, id ou arquivo daqui representa fabricante, guindaste ou tabela real.
"""Catálogo e metadados de origem FICTÍCIOS para os testes dos repositórios (TASK-022)."""

import hashlib

from app.application.ports.crane_catalog_repository import (
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.application.ports.load_chart_repository import LoadChartSource
from app.domain.value_objects.crane_geometry import CraneGeometry
from tests.fixtures.load_chart_ficticio import CONFIGURATION_FICTICIA_ID

MANUFACTURER_FICTICIO = Manufacturer(id="FAB-FICTICIO-1", name="Fabricante FICTÍCIO")
CRANE_FICTICIO = Crane(
    id="GUI-FICTICIO-1", manufacturer_id=MANUFACTURER_FICTICIO.id, model_name="Modelo FICTÍCIO"
)

CONTEUDO_CSV_FICTICIO = b"boom_length_m,working_radius_m,max_capacity_kg\n10,3,9000\n"
SOURCE_FICTICIA = LoadChartSource(
    file_name="tabela_ficticia.csv",
    file_type="text/csv",
    sha256=hashlib.sha256(CONTEUDO_CSV_FICTICIO).hexdigest(),
    uri="arquivos-ficticios/tabela_ficticia.csv",
)


def configuration_ficticia(
    geometry: CraneGeometry | None = None,
    configuration_id: str = CONFIGURATION_FICTICIA_ID,
) -> CraneConfiguration:
    return CraneConfiguration(
        id=configuration_id,
        crane_id=CRANE_FICTICIO.id,
        name="Configuração FICTÍCIA",
        geometry=geometry,
    )
