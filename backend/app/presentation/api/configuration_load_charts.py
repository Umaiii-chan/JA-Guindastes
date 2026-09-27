"""Rota que lista as tabelas de carga de uma configuração, com a ativa (TASK-044).

`GET /api/v1/configurations/{configuration_id}/load-charts`:
- **200** `{"items": [...], "active_chart_id": ... | null}`; cada item é o `LoadChartResponse` de
  `GET /api/v1/load-charts/{chart_id}` sem `points`. Ordem: pela versão, da maior para a menor, em
  ordem natural, e pelo id na mesma versão (`ListConfigurationLoadCharts`): não há data de
  importação gravada;
- **404** `{"detail": ...}` quando a configuração não existe (configuração sem tabelas → 200 com
  `items` vazio).

Autorização (ADR-016): com banco, qualquer perfil autenticado (a composição passa a exigência de
sessão na inclusão do router). O router recebe o catálogo e a listagem prontos da raiz de
composição, porque a apresentação não importa a infraestrutura.
"""

from fastapi import APIRouter, HTTPException, status

from app.application.ports.crane_catalog_repository import CraneCatalogRepository
from app.application.ports.load_chart_listing import LoadChartListing
from app.application.use_cases.crane_catalog import CatalogEntryNotFoundError
from app.application.use_cases.list_configuration_load_charts import ListConfigurationLoadCharts
from app.presentation.api.catalog import CONFIGURATIONS_PATH
from app.presentation.api.catalog_schemas import CatalogErrorResponse
from app.presentation.api.load_chart_persistence_schemas import ConfigurationLoadChartsResponse

CONFIGURATION_LOAD_CHARTS_PATH = f"{CONFIGURATIONS_PATH}/{{configuration_id}}/load-charts"


def create_configuration_load_charts_router(
    catalog: CraneCatalogRepository, listing: LoadChartListing
) -> APIRouter:
    """Monta o router com o catálogo (existência da configuração) e a listagem de tabelas."""
    use_case = ListConfigurationLoadCharts(catalog, listing)
    router = APIRouter(tags=["load-charts"])

    @router.get(
        CONFIGURATION_LOAD_CHARTS_PATH,
        summary="Listar as tabelas de carga de uma configuração, com a ativa",
        description=(
            "Todas as versões gravadas da configuração, em qualquer status, sem os pontos. Ordem: "
            "pela versão, da maior para a menor, em ordem natural (`v10` antes de `v9`), e pelo "
            "`chart_id` decrescente na mesma versão; não há data de importação gravada. "
            "`active_chart_id` é a tabela `ACTIVE` (no máximo uma), ou `null`."
        ),
        responses={
            status.HTTP_404_NOT_FOUND: {
                "model": CatalogErrorResponse,
                "description": "A configuração não existe.",
            },
        },
    )
    def list_configuration_load_charts(configuration_id: str) -> ConfigurationLoadChartsResponse:
        try:
            result = use_case.execute(configuration_id)
        except CatalogEntryNotFoundError as error:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
        return ConfigurationLoadChartsResponse.from_result(result)

    return router
