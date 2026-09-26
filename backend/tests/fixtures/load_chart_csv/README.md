# CSVs de tabela de carga — FICTÍCIOS

> **FICTÍCIO** — todos os arquivos desta pasta têm dados inventados só para testar o mecanismo de
> importação. Não representam capacidade real, não vêm de tabela de fabricante nem da doc-fonte e
> não podem ser usados fora dos testes, em demonstração ou como referência (ADR-012; known-gaps P-007).

O formato canônico interno de CSV (TASK-010) é **provisório** (known-gaps P-006, PEND-008) e não
aceita linha de comentário: a primeira linha não vazia tem de ser o cabeçalho. Por isso o rótulo
FICTÍCIO está no nome de cada arquivo (`load_chart_ficticio_*.csv`) e neste README, e não dentro dos
arquivos.

| Arquivo | Conteúdo | Usado em |
|---------|----------|----------|
| `load_chart_ficticio_valido.csv` | os mesmos 6 pontos FICTÍCIOS de `tests/fixtures/load_chart_ficticio.py`, sem inconsistência | `tests/infrastructure/` (inclusive `repositories/`), `tests/application/`, `tests/presentation/` |
| `load_chart_ficticio_inconsistencias.csv` | cabeçalho válido; linhas com valor vazio, texto, negativo, `NaN`, campo faltando, vírgula decimal e um ponto que conflita com outro | `tests/infrastructure/` (inclusive `repositories/`), `tests/application/`, `tests/presentation/` |
| `load_chart_ficticio_cabecalho_invalido.csv` | cabeçalho com unidade não reconhecida (`ft`), coluna sem unidade e coluna desconhecida | `tests/infrastructure/` |

Os números esperados de linha, coluna e motivo de cada inconsistência estão nos próprios testes.
Com `core.autocrlf=true` (Windows) o Git entrega estes arquivos com CRLF; o parser aceita LF e CRLF.
