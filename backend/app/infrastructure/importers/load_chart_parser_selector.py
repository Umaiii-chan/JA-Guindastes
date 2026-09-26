"""Escolha do adapter de leitura da tabela de carga pelo arquivo enviado (TASK-023).

Para a raiz de composição usar (a apresentação não importa a infraestrutura). Ainda NÃO está
ligado na API: a TASK-019 continua lendo todo upload como CSV até a composição mudar.

Regra (provisória, TASK-023):
1. a **extensão do nome do arquivo** decide, sem diferenciar maiúsculas: `.csv` → CSV,
   `.xlsx` → XLSX. Ela vem antes do tipo de conteúdo porque o navegador costuma mandar
   `application/vnd.ms-excel` para um `.csv` no Windows com o Excel instalado;
2. sem extensão reconhecida, o **tipo de conteúdo** (sem parâmetros como `charset`) decide:
   `text/csv` → CSV; o tipo oficial do XLSX → XLSX;
3. nenhum dos dois reconhecido → `None` (formato não suportado). O que responder nesse caso
   (ex.: 415, ou ler como CSV como hoje) é decisão da composição/pessoa responsável.

`.xls` (binário antigo), `.xlsm` (com macros) e `application/vnd.ms-excel` (ambíguo) não são
reconhecidos.
"""

from pathlib import PurePath

from app.application.ports.load_chart_parser import LoadChartParser
from app.infrastructure.importers.csv_load_chart_parser import CsvLoadChartParser
from app.infrastructure.importers.xlsx_load_chart_parser import XlsxLoadChartParser

CSV_CONTENT_TYPE = "text/csv"
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def select_load_chart_parser(
    filename: str | None, content_type: str | None
) -> LoadChartParser | None:
    """Devolve o parser CSV ou XLSX para o arquivo, ou `None` se o formato não é suportado."""
    suffix = PurePath(filename.strip()).suffix.lower() if filename else ""
    if suffix == ".csv":
        return CsvLoadChartParser()
    if suffix == ".xlsx":
        return XlsxLoadChartParser()

    media_type = content_type.split(";", 1)[0].strip().lower() if content_type else ""
    if media_type == CSV_CONTENT_TYPE:
        return CsvLoadChartParser()
    if media_type == XLSX_CONTENT_TYPE:
        return XlsxLoadChartParser()
    return None
