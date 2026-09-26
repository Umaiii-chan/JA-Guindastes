# Handoff — TASK-023 — implementação (importação XLSX da tabela de carga)

> **Tarefas em paralelo (leva A, TASK-021):** este handoff fica em `handoffs/TASK-023.md`;
> `handoffs/current.md`, `README.md` e `docs/*.md` não foram editados (mudanças de documentação
> necessárias no § 10). Nenhum arquivo das TASK-022, 024..028 foi tocado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-023-importacao-xlsx.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (agente único, AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-023-importacao-xlsx` @ `4aca5f4` (antes do commit deste handoff), a partir de `a5b1ab0` |
| **Duração aproximada** | ~60 min (com uma interrupção por limite de uso) |

---

## 1. Objetivo desta etapa

Adapter XLSX da porta `LoadChartParser` com o mesmo formato provisório e os mesmos códigos do CSV,
seletor CSV/XLSX para a composição usar depois, e testes com planilhas FICTÍCIAS em memória.

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-023-importacao-xlsx a5b1ab0`; `git log -1` confirmou
  `a5b1ab0 chore(protocolo): permitir até 15 tarefas em paralelo e abrir a leva A (TASK-021)`.
- Adicionei `openpyxl` (`uv add openpyxl` → `openpyxl>=3.1.5`, trouxe `et-xmlfile 2.0.0`) e
  `types-openpyxl` no grupo dev (`uv add --dev types-openpyxl`), porque o openpyxl não tem `py.typed`
  e o `mypy app` é strict.
- Criei `backend/app/infrastructure/importers/xlsx_load_chart_parser.py` (`XlsxLoadChartParser`):
  abre com `load_workbook(read_only=True, data_only=True, keep_vba=False, keep_links=False)`, lê só a
  primeira worksheet e **reusa as funções `_read_header` e `_read_cell` do parser CSV** (cabeçalho e
  número em texto), para os dois formatos não divergirem. Célula numérica é usada como está; vazia →
  `EMPTY_VALUE`; fórmula sem valor calculado → `EMPTY_VALUE` com mensagem própria (uma segunda leitura
  sem `data_only`, só quando há célula vazia, identifica a fórmula, sem avaliá-la); data/hora,
  booleano, erro de fórmula e texto não numérico → `INVALID_NUMBER`; valor fora das colunas do
  cabeçalho → `WRONG_FIELD_COUNT`; arquivo inválido ou falha no meio da leitura → `MALFORMED_FILE`,
  sem exceção. As mensagens trazem a referência da célula (ex.: `C5`).
- Criei `backend/app/infrastructure/importers/load_chart_parser_selector.py`
  (`select_load_chart_parser(filename, content_type) -> LoadChartParser | None`). **Não** está ligado
  na API.
- Escrevi 49 testes novos em `backend/tests/infrastructure/test_xlsx_load_chart_parser.py` e
  `backend/tests/infrastructure/test_load_chart_parser_selector.py`, com planilhas geradas em memória
  pelo openpyxl (nenhum binário commitado), incluindo a paridade CSV × XLSX.
- Criei `tasks/in-progress/TASK-023-importacao-xlsx.md` (CA-1..CA-8).

### Dependências (AGENTS.md § 9)

| Pacote | Versão resolvida | Grupo | Licença (verificada no METADATA instalado) | Python 3.14 | Motivo / fonte |
|--------|------------------|-------|--------------------------------------------|-------------|----------------|
| `openpyxl` | 3.1.5 | produção | MIT | wheel `py2.py3-none-any` puro Python, `Requires-Python >=3.8`; os classifiers só vão até 3.11, mas o pacote instalou e todos os testes rodaram em CPython 3.14.7 | leitura de XLSX (ADR-009); PyPI |
| `et-xmlfile` | 2.0.0 | produção (transitiva do openpyxl) | MIT | puro Python, `>=3.8` | idem |
| `types-openpyxl` | 3.1.5.20260827 | dev | Apache-2.0 | `>=3.10` | stubs do typeshed para o `mypy` strict; PyPI |

## 3. Arquivos modificados

`git diff --stat a5b1ab0...HEAD` antes do commit deste handoff:

```text
 .../importers/load_chart_parser_selector.py        |  44 +++
 .../importers/xlsx_load_chart_parser.py            | 386 +++++++++++++++++++++
 backend/pyproject.toml                             |   2 +
 .../test_load_chart_parser_selector.py             |  48 +++
 .../infrastructure/test_xlsx_load_chart_parser.py  | 380 ++++++++++++++++++++
 backend/uv.lock                                    |  34 ++
 tasks/in-progress/TASK-023-importacao-xlsx.md      | 104 ++++++
 7 files changed, 998 insertions(+)
```

Fora do escopo: nenhum.

## 4. Comandos executados e resultados

Em `backend/`, exceto o `check-structure.sh` (raiz). Rodados depois do commit dos testes (`31bb8d0`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Resolved 52 packages in 2ms` / `Checked 49 packages in 5ms` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `88 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 52 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `469 passed, 2 skipped in 4.54s` (os 2 pulados são de integração com banco) |
| `uv run mypy <os 2 testes novos>` (informativo) | ✅ | `Success: no issues found in 2 source files` |
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros, 2 aviso(s)` |

Um dos avisos do `check-structure.sh` era "branch não corresponde a nenhuma tarefa em
tasks/in-progress/", rodado antes de criar o arquivo da tarefa (commit `4aca5f4`), que o resolve.

## 5. Decisões tomadas

- **Nenhum código de inconsistência novo.** A porta (`application/`) está fora do escopo desta leva,
  e todos os casos couberam nos códigos existentes: fórmula sem valor → `EMPTY_VALUE` (a célula não
  traz valor), data/booleano/erro → `INVALID_NUMBER`, valor fora do cabeçalho → `WRONG_FIELD_COUNT`,
  arquivo inválido → `MALFORMED_FILE`, primeira planilha vazia → `EMPTY_FILE`. `INVALID_ENCODING` e
  `UNSUPPORTED_DELIMITER` não se aplicam ao XLSX (o segundo só aparece se o cabeçalho inteiro estiver
  numa célula com `;` ou tabulação, com a mensagem do CSV).
- **Reuso de funções privadas do CSV** (`_read_header`, `_read_cell`) em vez de duplicar: garante
  paridade. Movê-las para um módulo comum exige alterar `csv_load_chart_parser.py`, fora dos meus
  arquivos (pendência 6).
- **Só a primeira worksheet conta** (PROVISÓRIO, pedido da pessoa): primeira na ordem do arquivo,
  mesmo oculta; planilhas de gráfico não contam; as demais são ignoradas sem aviso.
- **Fórmula COM valor calculado é aceita pelo valor gravado** pelo Excel (`data_only=True`); não há
  como distingui-la de um número digitado sem nova leitura, e rejeitá-la seria regra nova (pendência 2).
- **Texto numérico é aceito** com a mesma regra do CSV (`"12.5"`); "texto não numérico" é o que é
  inconsistência.
- **Tabela começa na coluna A**, como o CSV começa no primeiro campo: célula de cabeçalho vazia antes da
  última preenchida é `UNKNOWN_COLUMN` ("coluna sem nome"); vazias depois da última são ignoradas.
- **Linha curta** (células finais vazias) gera `EMPTY_VALUE`, não `WRONG_FIELD_COUNT`: na planilha não
  existe "campo a menos". É a única diferença de relatório em relação ao CSV, coberta no teste de
  paridade.
- **`MALFORMED_FILE` via `except Exception`**: o openpyxl levanta tipos variados (`BadZipFile`,
  `KeyError`, `InvalidFileException`, `ParseError`...) para arquivo inválido, e o contrato da porta
  proíbe exceção por conteúdo. Uma falha no meio da leitura mantém o que já foi lido, como no CSV.
- **Seletor:** extensão primeiro (`.csv`, `.xlsx`, sem diferenciar maiúsculas), porque navegadores no
  Windows mandam `application/vnd.ms-excel` para `.csv`; sem extensão reconhecida, o tipo de conteúdo
  (`text/csv` ou o tipo oficial do XLSX); senão `None`. `.xls`, `.xlsm` e `application/vnd.ms-excel`
  não são reconhecidos. O que fazer com `None` é da composição (pendência 3).
- `# type: ignore[misc]` em `sheet.iter_rows(min_row=1)`: o stub declara `iter_rows` só para
  `Worksheet`; o `min_row=1` explícito mantém a numeração das linhas independente da dimensão gravada.
- Nenhum ADR: adapter previsto no ADR-009/ADR-004; formato provisório em P-006.

## 6. Regras de negócio aplicadas

- RN-006 — pontos em m e kg; só unidades internas no cabeçalho (reuso do CSV;
  `test_ficticio_points_are_domain_quantities_in_internal_units`,
  `test_ficticio_invalid_header_reports_only_the_header_with_the_csv_codes`).
- Doc-fonte § 13.1 — campos obrigatórios, valores numéricos válidos, unidades reconhecidas,
  capacidades não negativas; conflitos e metadados continuam no caso de uso
  (`test_ficticio_valid_xlsx_becomes_the_same_draft_chart_as_the_csv`).
- Regras não documentadas encontradas: § 8.

## 7. O que NÃO foi feito e por quê

- Ligar o seletor/parser XLSX na API e no `app/main.py`: TASK-024/025 (fora do escopo).
- Documentação (`docs/`, `README.md`, `handoffs/current.md`): proibido nesta leva; lista no § 10.
- Teste de fórmula COM valor calculado: o openpyxl não grava valor calculado; exigiria montar o XML à mão.
- Limites de XLSX (tamanho descompactado, número de linhas, `defusedxml`): P-008 aberta (§ 9).
- Revisão independente: NÃO EXECUTADA (próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Confirmar "só a primeira planilha" (mesmo oculta; demais ignoradas sem aviso) ou escolher outra regra (planilha por nome, recusar pasta com várias planilhas) | não | | |
| 2 | Fórmula com valor calculado deve ser aceita (hoje é, pelo valor gravado) ou recusada? | não | | |
| 3 | Seletor devolveu `None` (formato não suportado): a API responde 415 ou continua lendo como CSV, como hoje? Aceitar `.xlsm`/`.xls`? | não (sim, para a TASK-024/025) | | |
| 4 | P-008 para XLSX: limite de tamanho descompactado (zip bomb), número máximo de linhas e adicionar `defusedxml` (o openpyxl usa se estiver instalado)? | não (sim, antes de expor XLSX na API) | | |
| 5 | Texto numérico em célula (`"12.5"`) é aceito com a regra do CSV. Está bom assim? | não | | |
| 6 | Tarefa de refatoração: mover `_read_header`/`_read_cell` do CSV para um módulo comum de importação (hoje o XLSX importa funções privadas do módulo CSV) | não | | |

## 9. ⚠️ Segurança

- Sem segredos e sem dados reais; planilhas FICTÍCIAS geradas em memória.
- O parser não limita o tamanho descompactado nem o número de linhas: um XLSX pequeno (dentro do limite
  de 1 MiB da API) pode descompactar muito (zip bomb). O openpyxl não usa `defusedxml` porque ele não
  está instalado; o expat do CPython 3.14 tem proteção contra expansão de entidades, mas isso não foi
  testado aqui. Resolver antes de ligar o XLSX na API (pendência 4, P-008).
- Macros e vínculos externos não são carregados (`keep_vba=False`, `keep_links=False`); fórmulas nunca
  são avaliadas pelo openpyxl.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois a pessoa responsável (pendências e PR)

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-023-importacao-xlsx` com
   `docs/templates/code-review-template.md`; rodar os gates do § 4.
2. Pessoa: responder o § 8; push e PR ficam com a sessão principal (o agente não fez).
3. Mudanças de documentação necessárias (não feitas por regra da leva):
   - `docs/known-gaps.md` P-006: acrescentar "XLSX com o mesmo formato provisório, só a primeira
     planilha (TASK-023)"; P-008: citar os riscos de XLSX do § 9;
   - `docs/architecture.md` (seção de dependências/infraestrutura): `openpyxl` (MIT) para importação
     XLSX; `types-openpyxl` no grupo dev;
   - `docs/development-guide.md`: nada muda nos comandos;
   - `handoffs/current.md` § 1: importação XLSX provisória na infraestrutura, ainda sem endpoint;
   - `README.md`: se listar os formatos de importação, incluir XLSX quando a API o aceitar.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 5 e § 8)
3. `tasks/in-progress/TASK-023-importacao-xlsx.md` § 3
4. `backend/app/infrastructure/importers/xlsx_load_chart_parser.py` (docstring do módulo = formato)
5. `backend/app/infrastructure/importers/load_chart_parser_selector.py`
6. `handoffs/history/2026-09-26-TASK-010-implementacao.md` § 2 (formato CSV)

**Cuidado com:**
- O openpyxl emite `UserWarning` para alguns recursos de planilha não suportados; não afeta o resultado.
- A composição (TASK-024/025) deve passar ao seletor o `UploadFile.filename` e o `content_type`.

## 11. Como revisar este trabalho

- Comece por `_read_quantity` (tipos de célula → códigos) e `_explain_formulas_without_value` (segunda
  leitura só para a mensagem de fórmula).
- Tenho menos certeza sobre: o `except Exception` amplo (necessário pelo contrato, mas esconde bugs do
  próprio parser como `MALFORMED_FILE`); e o import de funções privadas do CSV.
- Os testes cobrem célula a célula, cabeçalho, várias planilhas, arquivos corrompidos, paridade e o
  seletor; não cobrem fórmula com valor calculado nem arquivos grandes.
