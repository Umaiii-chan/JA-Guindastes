"""Erro de limite de recurso ao ler o arquivo de uma tabela de carga (TASK-031; P-008).

Exceção explícita ao contrato do `LoadChartParser` ("não levanta exceção por problema no
conteúdo"): passar de um limite de recurso (ex.: XLSX grande demais depois de descompactado, ou com
linhas demais, proteção contra zip bomb) não é uma inconsistência da tabela para o relatório, e sim
um arquivo que nem deve ser aberto. O adapter que aplica o limite levanta este erro **antes** de
abrir o arquivo, e a API o traduz para 413.

Os limites são PROVISÓRIOS — A VALIDAR (P-008).
"""


class LoadChartFileLimitExceededError(Exception):
    """O arquivo passa de um limite de recurso e não foi aberto (P-008)."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)
