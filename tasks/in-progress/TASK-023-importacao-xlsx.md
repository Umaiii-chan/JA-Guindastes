# TASK-023 — Importar tabela de carga em XLSX no formato provisório

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva A, pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-023-importacao-xlsx` (a partir de `a5b1ab0`, commit-base da leva A / TASK-021) |
| **PR** | — |
| **Requisitos** | RF-006, RF-009, RNF-006 |
| **Regras de negócio** | RN-006 |
| **Estimativa** | M |

---

## 1. Objetivo

Ler uma tabela de carga enviada em XLSX com o mesmo formato canônico provisório e o mesmo relatório
de inconsistências do CSV (TASK-010), e ter um seletor que escolha o parser CSV ou XLSX pelo arquivo.

## 2. Contexto

ADR-009 prevê importar CSV/XLSX e normalizar. A TASK-010 criou a porta `LoadChartParser` e o adapter
CSV; o formato canônico interno segue provisório (known-gaps P-006, PEND-008). XLSX exige dependência
nova (`openpyxl`); esta é a única tarefa da leva A autorizada a mudar dependências. A ligação na API
fica para a composição (TASK-024/025).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um XLSX FICTÍCIO com o cabeçalho `boom_length_m,working_radius_m,max_capacity_kg` na primeira planilha, quando `XlsxLoadChartParser().parse` roda, então devolve os pontos em unidades internas com a linha da planilha e nenhuma inconsistência.
- [ ] **CA-2** — Dada uma célula vazia, com texto não numérico, com fórmula sem valor calculado, com data, booleano ou erro de fórmula, quando o parser roda, então o relatório traz a inconsistência com linha, coluna e código (`EMPTY_VALUE`, `INVALID_NUMBER`, `NON_FINITE_NUMBER`, `NEGATIVE_VALUE`), sem gerar ponto para a linha.
- [ ] **CA-3** — Dado um cabeçalho inválido, então os códigos são os mesmos do CSV (`MISSING_COLUMN`, `UNKNOWN_COLUMN`, `MISSING_UNIT`, `UNRECOGNIZED_UNIT`, `DUPLICATE_COLUMN`).
- [ ] **CA-4** — Dado um arquivo que não é XLSX válido (vazio, texto, zip inválido, truncado, planilha corrompida), então o resultado é `MALFORMED_FILE`, sem exceção.
- [ ] **CA-5** — Dada uma pasta de trabalho com várias planilhas, só a primeira worksheet é lida (decisão provisória).
- [ ] **CA-6** — A mesma tabela em CSV e em XLSX gera os mesmos pontos (e a mesma `LoadChart` em `DRAFT` pelo caso de uso).
- [ ] **CA-7** — `select_load_chart_parser(filename, content_type)` devolve o parser CSV ou XLSX pela extensão e, sem extensão reconhecida, pelo tipo de conteúdo; `None` para formato não suportado.
- [ ] **CA-8** — `openpyxl` adicionado com `uv add`, licença e suporte a Python 3.14 registrados no handoff; todos os gates passam.

## 4. Escopo

### Dentro do escopo

- `backend/pyproject.toml`, `backend/uv.lock`; arquivos novos em `backend/app/infrastructure/importers/`
  e em `backend/tests/infrastructure/`; esta tarefa; `handoffs/TASK-023.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Ligar o seletor na API (`presentation/`, `app/main.py`: TASK-024/025).
- Mudar a porta, os códigos de inconsistência ou o parser CSV (`application/`, TASK-022/028).
- Documentação em `docs/`, `README.md`, `handoffs/current.md` (listada no handoff § 10).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/pyproject.toml`, `backend/uv.lock` | alterar | sim |
| `backend/app/infrastructure/importers/xlsx_load_chart_parser.py` | criar | sim |
| `backend/app/infrastructure/importers/load_chart_parser_selector.py` | criar | sim |
| `backend/tests/infrastructure/test_xlsx_load_chart_parser.py` | criar | sim |
| `backend/tests/infrastructure/test_load_chart_parser_selector.py` | criar | sim |

## 6. Riscos e dependências

- Depende da TASK-021 (commit-base da leva A).
- Risco: segurança de upload XLSX (zip bomb, XML) com P-008 aberta → ver handoff § 9.

## 7. Teste manual (se houver)

Não se aplica: as planilhas são geradas em memória nos testes.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Adicionar `openpyxl` (e `types-openpyxl` no grupo dev, para o mypy strict) | `pyproject.toml`, `uv.lock` | `uv sync --locked` | [x] |
| 2 | Parser XLSX reusando as regras de cabeçalho e número do CSV | `xlsx_load_chart_parser.py` | mypy, testes | [x] |
| 3 | Seletor por extensão/tipo de conteúdo | `load_chart_parser_selector.py` | testes | [x] |
| 4 | Testes com planilhas FICTÍCIAS em memória e paridade CSV × XLSX | `tests/infrastructure/` | `uv run pytest` | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| planilha válida, texto numérico, cabeçalho fora de ordem e após linhas vazias | CA-1 | unitário | `tests/infrastructure/test_xlsx_load_chart_parser.py` | verde |
| célula vazia, texto, fórmula sem valor, data, booleano, erro, negativo, valor fora do cabeçalho | CA-2 | unitário | idem | verde |
| cabeçalho inválido e coluna repetida | CA-3 | unitário | idem | verde |
| arquivos corrompidos | CA-4 | unitário | idem | verde |
| várias planilhas | CA-5 | unitário | idem | verde |
| paridade CSV × XLSX (válida, com inconsistências, pelo caso de uso) | CA-6 | integração sem banco | idem | verde |
| seletor | CA-7 | unitário | `tests/infrastructure/test_load_chart_parser_selector.py` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

Pendente.

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
