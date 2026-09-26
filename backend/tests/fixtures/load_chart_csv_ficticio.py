# FICTÍCIO — acesso aos CSVs inventados de `tests/fixtures/load_chart_csv/` (ver o README de lá).
# Não representam capacidade real; não use fora dos testes (ADR-012; known-gaps P-007).
"""Leitura dos CSVs FICTÍCIOS de tabela de carga usados nos testes de importação (TASK-010)."""

from pathlib import Path

CSV_FICTICIO_DIR = Path(__file__).resolve().parent / "load_chart_csv"

CSV_FICTICIO_VALIDO = "load_chart_ficticio_valido.csv"
CSV_FICTICIO_INCONSISTENCIAS = "load_chart_ficticio_inconsistencias.csv"
CSV_FICTICIO_CABECALHO_INVALIDO = "load_chart_ficticio_cabecalho_invalido.csv"


def read_csv_ficticio(name: str) -> bytes:
    """Bytes do CSV FICTÍCIO `name`, como chegariam num upload."""
    return (CSV_FICTICIO_DIR / name).read_bytes()
