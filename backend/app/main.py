"""Raiz de composição do backend (TASK-019, TASK-024; ADR-004): liga os adapters à API.

É o único módulo que importa a apresentação e a infraestrutura ao mesmo tempo. Fica fora das
camadas do contrato do import-linter (`backend/pyproject.toml`), em que `app.presentation` e
`app.infrastructure` são camadas independentes, que não se importam nem por meio de outro módulo.
Por isso nenhum módulo das camadas deve importar este.

Avaliação operacional (TASK-024): a estratégia de consulta é a `ConservativeTabulatedLookup`
(ADR-015). Os repositórios de banco da ficha técnica e da tabela ativa ainda não existem (TASK-022),
então a composição liga, **de forma explícita e provisória**, provedores que não encontram nada: a
rota responde `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`, nunca
com dados inventados. A troca pelos repositórios reais fica para a leva B.

Rodar a API completa, em `backend/`: `uv run uvicorn app.main:app --reload`.
"""

from app.domain.entities.load_chart import LoadChart
from app.domain.services.conservative_tabulated_lookup import ConservativeTabulatedLookup
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.presentation.api.evaluations import EvaluationDependencies
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import UploadLimits


class UnconfiguredCraneGeometryProvider:
    """PROVISÓRIO (TASK-024): nenhuma ficha técnica cadastrada; sempre devolve `None`.

    Existe só até os repositórios de banco (TASK-022) serem ligados aqui (leva B). Cumpre a porta
    `CraneGeometryProvider`: "sem ficha técnica" é `None`, sem exceção.
    """

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        return None


class UnconfiguredActiveLoadChartProvider:
    """PROVISÓRIO (TASK-024): nenhuma tabela de carga ativa; sempre devolve `None`.

    Existe só até os repositórios de banco (TASK-022) serem ligados aqui (leva B). Cumpre a porta
    `ActiveLoadChartProvider`: "sem tabela ativa" é `None`, sem exceção.
    """

    def get_active_load_chart(self, configuration_id: str) -> LoadChart | None:
        return None


evaluation_dependencies = EvaluationDependencies(
    crane_geometry_provider=UnconfiguredCraneGeometryProvider(),
    active_load_chart_provider=UnconfiguredActiveLoadChartProvider(),
    load_chart_interpolator=ConservativeTabulatedLookup(),
)

app = create_app(
    load_chart_parser=CsvLoadChartParser(),
    # Limite padrão PROVISÓRIO de 1 MiB por arquivo — A VALIDAR (P-008).
    upload_limits=UploadLimits(),
    evaluation=evaluation_dependencies,
)
