"""Raiz de composição do backend (TASK-019; ADR-004): liga os adapters da infraestrutura à API.

É o único módulo que importa a apresentação e a infraestrutura ao mesmo tempo. Fica fora das
camadas do contrato do import-linter (`backend/pyproject.toml`), em que `app.presentation` e
`app.infrastructure` são camadas independentes, que não se importam nem por meio de outro módulo.
Por isso nenhum módulo das camadas deve importar este.

Rodar a API completa, em `backend/`: `uv run uvicorn app.main:app --reload`.
"""

from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.presentation.api.main import create_app
from app.presentation.api.upload_limits import UploadLimits

app = create_app(
    load_chart_parser=CsvLoadChartParser(),
    # Limite padrão PROVISÓRIO de 1 MiB por arquivo — A VALIDAR (P-008).
    upload_limits=UploadLimits(),
)
