# Handoff — TASK-010 — implementação (importação CSV da tabela de carga, PoC)

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-010.md`;
> `handoffs/current.md` não foi editado. Tarefas paralelas desta leva: TASK-011 (persistência),
> TASK-012 (README) e TASK-013 (frontend). Nenhum arquivo delas foi tocado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:15 (relógio local da máquina) |
| **Tarefa** | `tasks/in-progress/TASK-010-importacao-csv-tabela-carga.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-010-importacao-csv-tabela-carga` @ `e8059b0` (antes do commit deste handoff), a partir de `ae2ec66` |
| **Duração aproximada** | ~50 min |

---

## 1. Objetivo desta etapa

Criar a PoC de importação de tabela de carga em CSV (doc-fonte § 13; RF-006, RF-009, RNF-006): porta
na aplicação, adapter CSV na infraestrutura e caso de uso que devolve `LoadChart` em `DRAFT` ou o
relatório de inconsistências com status `INVALID`. Sem persistência e sem endpoint.

## 2. O que foi feito

- Verifiquei que o worktree veio em `f7570d7`, e não em `ae2ec66` como pedido. O commit `ae2ec66`
  existia localmente, então criei a branch explicitamente a partir dele
  (`git checkout -b task/TASK-010-importacao-csv-tabela-carga ae2ec66`). Durante a tarefa,
  `development` avançou para `0960943` (merge da TASK-012, que contém `ae2ec66`); a diferença
  `ae2ec66..development` só toca `README.md` e arquivos da TASK-012, sem sobreposição com esta branch.
- Criei a porta `LoadChartParser` (Protocol) em `backend/app/application/ports/load_chart_parser.py`,
  com os tipos do relatório: `ImportIssue` (código, mensagem, linha, coluna), `ImportIssueCode`
  (`StrEnum` com 17 motivos), `ParsedLoadChartPoint` (ponto do domínio + linha de origem) e
  `LoadChartParseResult` (pontos válidos + inconsistências).
- Criei o caso de uso `ValidateLoadChartImport` em
  `backend/app/application/use_cases/validate_load_chart_import.py`. Ele usa o parser e acrescenta as
  validações que não dependem do formato: id, versão e `configuration_id` informados
  (`MISSING_METADATA`), pontos conflitantes (`CONFLICTING_POINTS`, todas as linhas do grupo) e
  nenhum ponto válido (`NO_POINTS`). Devolve `ValidLoadChartImport` (com a `LoadChart` em `DRAFT`) ou
  `InvalidLoadChartImport` (status `INVALID`, metadados e relatório ordenado pela linha, sem
  `LoadChart`). Nunca `VALIDATED` nem `ACTIVE`.
- Criei o adapter `CsvLoadChartParser` em
  `backend/app/infrastructure/importers/csv_load_chart_parser.py`, só com a biblioteca padrão (`csv`,
  `io`, `re`, `math`). Ele valida encoding, cabeçalho (colunas obrigatórias, sufixo de unidade,
  unidade reconhecida, coluna repetida ou desconhecida, separador errado), número de campos por linha
  e cada valor (vazio, não numérico, `NaN`/infinito, negativo), sem levantar exceção no primeiro erro.
  A regra de "não negativo" vem dos value objects `Length` e `Mass` do domínio.
- Escrevi 91 testes novos: `backend/tests/application/test_validate_load_chart_import.py` (caso de
  uso com parser falso), `backend/tests/infrastructure/test_csv_load_chart_parser.py` (parser) e
  `backend/tests/infrastructure/test_csv_load_chart_import.py` (caso de uso + parser real + CSVs).
- Criei três CSVs FICTÍCIOS em `backend/tests/fixtures/load_chart_csv/`, com `ficticio` no nome e um
  `README.md` ao lado dizendo FICTÍCIO (o formato não aceita linha de comentário), e o helper
  `backend/tests/fixtures/load_chart_csv_ficticio.py`. O CSV válido tem os mesmos 6 pontos FICTÍCIOS de
  `backend/tests/fixtures/load_chart_ficticio.py` (TASK-008).
- Acrescentei à linha P-006 de `docs/known-gaps.md`: "formato provisório adotado na TASK-010 (ver
  handoffs/TASK-010.md)", sem apagar o texto.
- Criei `tasks/in-progress/TASK-010-importacao-csv-tabela-carga.md` (CA-1..CA-11, com o formato
  provisório explícito).

### Formato canônico interno PROVISÓRIO de CSV

**PROVISÓRIO:** P-006 e PEND-008 continuam abertos. O formato abaixo vale só para esta PoC e pode mudar
quando a tabela oficial da empresa chegar.

Definido pela pessoa responsável (2026-09-26):

- CSV em UTF-8, separador vírgula, decimal ponto;
- cabeçalho obrigatório com as colunas `boom_length_m,working_radius_m,max_capacity_kg`;
- a unidade vem do sufixo do nome da coluna; coluna com sufixo desconhecido ou sem sufixo, e coluna
  ausente, são inconsistência.

Detalhes técnicos escolhidos pelo agente dentro desse formato (§ 5; confirmar na pendência 1):

- BOM de UTF-8 no início aceito e ignorado;
- só as unidades internas são reconhecidas (`m` para `boom_length`/`working_radius`, `kg` para
  `max_capacity`): não há conversão;
- cabeçalho = primeira linha não vazia; colunas em qualquer ordem; espaços em volta dos nomes
  ignorados; maiúsculas e minúsculas contam;
- coluna repetida ou desconhecida (ex.: `counterweight_kg`) é inconsistência, e não é ignorada;
- se alguma coluna obrigatória não pode ser usada, só o cabeçalho é reportado (as linhas não são lidas);
- linhas sem nenhum valor (vazias, só espaços ou só vírgulas) são ignoradas; linha com número de
  campos diferente do cabeçalho é inconsistência;
- número: dígitos ASCII, sinal opcional e parte decimal opcional após o ponto (`12`, `12.5`, `-3.0`);
  sem expoente (`1e3`), sem separador de milhar (`1,500`, `1_000`), sem vírgula decimal;
- linha = linha física do arquivo (o cabeçalho costuma ser a linha 1).

## 3. Arquivos modificados

`git diff --stat ae2ec66...HEAD` antes do commit deste handoff (este arquivo entra no commit final):

```text
 backend/app/application/ports/load_chart_parser.py | 109 ++++++
 .../use_cases/validate_load_chart_import.py        | 157 ++++++++
 .../importers/csv_load_chart_parser.py             | 309 ++++++++++++++++
 backend/tests/application/__init__.py              |   0
 .../application/test_validate_load_chart_import.py | 239 +++++++++++++
 backend/tests/fixtures/load_chart_csv/README.md    |  19 +
 .../load_chart_ficticio_cabecalho_invalido.csv     |   2 +
 .../load_chart_ficticio_inconsistencias.csv        |  10 +
 .../load_chart_csv/load_chart_ficticio_valido.csv  |   7 +
 backend/tests/fixtures/load_chart_csv_ficticio.py  |  16 +
 backend/tests/infrastructure/__init__.py           |   0
 .../infrastructure/test_csv_load_chart_import.py   |  94 +++++
 .../infrastructure/test_csv_load_chart_parser.py   | 396 +++++++++++++++++++++
 docs/known-gaps.md                                 |   2 +-
 .../TASK-010-importacao-csv-tabela-carga.md        | 179 ++++++++++
 15 files changed, 1538 insertions(+), 1 deletion(-)
```

Fora do escopo: nenhum. `backend/pyproject.toml` e `backend/uv.lock` não mudaram (`git diff --stat
ae2ec66 -- pyproject.toml uv.lock` vazio): nenhuma dependência nova.

## 4. Comandos executados e resultados

Todos em `backend/`, exceto o `check-structure.sh` (raiz do repositório). Rodados depois do último
commit de código (`e8059b0`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Resolved 41 packages in 1ms` / `Checked 38 packages in 2ms` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `49 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 33 source files` |
| `uv run lint-imports` | ✅ (exit 0) | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `174 passed in 0.49s` (83 anteriores + 91 novos) |
| `uv run pytest tests/application tests/infrastructure` | ✅ | `91 passed in 0.09s` |
| `uv run mypy tests` (informativo, não é gate) | ✅ | `Success: no issues found in 15 source files` |
| `bash scripts/check-structure.sh` | ✅ | `OK: 0 erros, 0 aviso(s)` |

```text
3. Tarefas
  ✓ 1 tarefa(s) em in-progress
  ✓ nenhum ID de tarefa duplicado
...
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-010-importacao-csv-tabela-carga
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 4 commit(s) desta branch sem co-autoria de IA

OK: 0 erros, 0 aviso(s)
```

O `check-structure.sh` passou porque `handoffs/current.md` já menciona a TASK-010 (índice da leva).
No Windows, a saída do `lint-imports` no terminal mostra acentos trocados (`apresenta��o`) por causa
do encoding do console; com `PYTHONIOENCODING=utf-8` sai correta. Não afeta o resultado.

## 5. Decisões tomadas

- **Parser recebe `bytes`**, como chegaria num upload, e decodifica UTF-8 (BOM opcional). Encoding
  inválido vira inconsistência com o número da linha do byte inválido, e não exceção.
- **Divisão de responsabilidades:** o parser cuida do formato (encoding, cabeçalho, unidades, números,
  número de campos); o caso de uso cuida do que envolve mais de uma linha ou os metadados
  (conflitos, tabela sem pontos, id/versão/configuração). Assim um adapter XLSX futuro herda essas
  validações sem duplicá-las.
- **Resultado como união** `ValidLoadChartImport | InvalidLoadChartImport`, e o inválido **não tem
  `LoadChart`**: quem recebe `INVALID` não tem pontos para usar por engano. Mesmo raciocínio do
  `CapacityResult` da TASK-008. Os dois expõem `.status` (`DRAFT` ou `INVALID`).
- **Metadados em branco viram inconsistência** (`MISSING_METADATA`) em vez de exceção, porque a
  doc-fonte § 13.1 lista "versão/origem informadas" entre as validações da importação.
- **`NO_POINTS` sempre que não há nenhum ponto válido**, inclusive junto com `EMPTY_FILE` ou com um
  cabeçalho inválido: regra simples e determinística.
- **Conflito reporta todas as linhas do grupo** (inclusive as que repetem uma das capacidades), porque
  não há como saber qual é a correta. Repetidos iguais continuam aceitos, como na `LoadChart`.
- **"Não negativo" vem do domínio:** o parser cria `Length`/`Mass` e traduz `InvalidQuantityError`
  de valor negativo para `NEGATIVE_VALUE`. Não há segunda regra na infraestrutura.
- **Número com regex ASCII estrita** em vez de `float()` puro: `float()` aceitaria `nan`, `inf`,
  `1e3`, `1_000` e até dígitos não ASCII (`١٢`), o que deixaria o formato ambíguo.
- **Coluna desconhecida é inconsistência:** ignorar em silêncio uma coluna como `counterweight_kg`
  poderia misturar configurações sem ninguém perceber (premissa de segurança, doc-fonte § 2.3).
- **Dica de separador:** cabeçalho de uma coluna só contendo `;` ou tabulação vira
  `UNSUPPORTED_DELIMITER` (o Excel em português costuma salvar CSV com `;`).
- Códigos de inconsistência em inglês (`StrEnum`, estáveis para máquina); mensagens em português.
  Docstrings e comentários em português, como na TASK-008.
- Nenhum ADR: porta e adapter seguem o ADR-004, o ADR-009 e a estrutura da doc-fonte § 18.1. O
  formato é provisório e está registrado aqui e em P-006.

## 6. Regras de negócio aplicadas

- RN-001 — `configuration_id` em branco torna a importação `INVALID`; a `LoadChart` em `DRAFT` guarda
  a configuração (`test_ficticio_import_with_blank_metadata_is_invalid`,
  `test_ficticio_import_without_issues_returns_draft_chart_with_metadata_and_points`).
- RN-005 — versão obrigatória e guardada na `LoadChart` (mesmos testes).
- RN-006 — pontos em m e kg; só unidades internas reconhecidas, sem conversão
  (`test_ficticio_points_are_domain_quantities_in_internal_units`,
  `test_ficticio_unrecognized_unit_is_reported_because_there_is_no_conversion`).
- Doc-fonte § 13.1 — campos obrigatórios, números válidos, unidades reconhecidas, capacidades não
  negativas, duplicatas conflitantes, versão/origem informadas, relatório antes da ativação.
- Doc-fonte § 13.2 — resultado só `DRAFT` ou `INVALID` (`test_ficticio_import_never_activates_the_chart`).
- "Testes relacionados" de `docs/business-rules.md` **não** foi preenchido (arquivo protegido;
  pendência 11).
- Regras **não documentadas** encontradas: § 8.

## 7. O que NÃO foi feito e por quê

- **XLSX:** exige dependência nova (biblioteca de leitura de planilha); a pessoa pediu para ficar para
  outra tarefa. A porta `LoadChartParser` já comporta um segundo adapter.
- **Persistência, preservação do arquivo-fonte e metadados (RF-008, RNF-005, doc-fonte § 19.2):**
  dependem da TASK-011 e de storage. RF-008 fica só parcial: o caso de uso não altera o conteúdo, mas
  não o guarda.
- **Vínculo com configuração existente (§ 13.1):** exige repositório de configurações; o caso de uso
  só exige que `configuration_id` não esteja em branco.
- **"Comprimentos/raios ordenáveis" (§ 13.1):** além de serem números válidos (e portanto
  ordenáveis), nada foi verificado; o significado está em aberto (pendência 3).
- **Endpoint REST (§ 15.2), limites de upload (P-008), autenticação (P-009):** fora do escopo.
- **Transições `DRAFT → VALIDATED → ACTIVE`:** não definidas; fora do escopo.
- **Conversão de unidade:** doc-fonte § 26, pergunta 10; PEND-008.
- Nova linha em `docs/known-gaps.md` para "importação só CSV, sem XLSX/persistência/endpoint": **não
  criei**, para limitar a mudança à linha P-006 pedida e evitar conflito com as tarefas paralelas
  (sugestão na pendência 9).
- Revisão independente: NÃO EXECUTADA (próximo passo).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Confirmar ou ajustar os detalhes técnicos do formato provisório escolhidos pelo agente (§ 2, "Detalhes técnicos"): BOM aceito, colunas em qualquer ordem, espaços ignorados, nomes sensíveis a maiúsculas, linhas vazias e `,,` ignoradas, coluna desconhecida = inconsistência, número sem expoente nem separador de milhar | não | | |
| 2 | Aceitar outras unidades com conversão (ex.: `t`, `lb`, `ft`)? Hoje só `m` e `kg` são reconhecidas (doc-fonte § 26, pergunta 10; RN-006) | não (sim, se a tabela oficial vier em outra unidade) | | |
| 3 | O que significa "comprimentos/raios ordenáveis" (doc-fonte § 13.1)? Arquivo em ordem? Capacidade decrescente com o raio? Hoje só se exige número válido | não | | |
| 4 | Quando houver persistência: a tabela `INVALID` deve ser gravada com o relatório, ou só o relatório é devolvido e nada é gravado? (RNF-006: "não corromper dados válidos existentes"). Hoje o caso de uso não monta `LoadChart` quando é `INVALID` | não | | |
| 5 | Pontos repetidos com a mesma capacidade são aceitos (herda a pendência 5 da TASK-008). No conflito, todas as linhas do grupo são reportadas. Está bom assim? | não | | |
| 6 | Texto definitivo das mensagens do relatório (hoje em português, geradas pelo código) e se precisam de tradução | não | | |
| 7 | Limites para upload: tamanho máximo do arquivo, número máximo de linhas e de inconsistências no relatório (P-008). Hoje não há limite (só o limite padrão de tamanho de campo do módulo `csv`) | não (sim, antes do endpoint) | | |
| 8 | XLSX: qual biblioteca (dependência nova) e se o mesmo cabeçalho vale para planilha; tarefa separada | não | | |
| 9 | Registrar em `docs/known-gaps.md` § 1 uma limitação "importação só CSV, sem XLSX, persistência nem endpoint" (não criei para evitar conflito com as tarefas paralelas) | não | | |
| 10 | O worktree desta tarefa veio em `f7570d7`, não em `ae2ec66`; criei a branch a partir de `ae2ec66` como pedido. `development` já está em `0960943` (TASK-012), sem sobreposição com esta branch | não (informativo) | | |
| 11 | Preencher "Testes relacionados" de RN-001, RN-005 e RN-006 em `docs/business-rules.md` também com os testes do § 6 (arquivo protegido; agente não edita) | não | | |
| 12 | Idioma dos comentários/docstrings no código ("A VALIDAR" em `docs/development-guide.md` § 5): usei português, como na TASK-008 | não | | |

## 9. ⚠️ Segurança

- Nada a relatar: sem segredos e sem dados reais. Os CSVs são FICTÍCIOS e rotulados.
- Lembrete para o futuro endpoint: o parser lê o conteúdo inteiro em memória e não limita tamanho
  nem número de linhas (pendência 7, P-008).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta, AGENTS.md § 3); depois a pessoa responsável (pendências e PR)

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-010-importacao-csv-tabela-carga` com
   `docs/templates/code-review-template.md`, conferindo que o formato está marcado como provisório,
   que nada de PEND-001..008 foi decidido e que `app.application` não importa infraestrutura.
2. Rodar os gates em `backend/` (tabela do § 4) e confirmar as saídas.
3. Pessoa: responder o § 8. A sessão principal faz push e PR (o agente não fez).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 2, formato provisório; § 5, decisões)
3. `tasks/in-progress/TASK-010-importacao-csv-tabela-carga.md` § 3 (critérios de aceite)
4. `backend/app/application/ports/load_chart_parser.py` (contrato da porta e códigos)
5. `backend/app/application/use_cases/validate_load_chart_import.py` (DRAFT × INVALID)
6. `backend/app/infrastructure/importers/csv_load_chart_parser.py` (formato e validações)
7. `docs/produto/documentacao-tecnica-v0.1.md` § 13

**Cuidado com:**
- Os números dos CSVs em `backend/tests/fixtures/load_chart_csv/` são FICTÍCIOS; não usar fora dos testes.
- Com `core.autocrlf=true`, os CSVs saem do Git com CRLF no Windows e LF no CI; os testes não dependem
  disso (há teste explícito de LF × CRLF com bytes montados no próprio teste).

## 11. Como revisar este trabalho

- Comece pelo caso de uso: é onde se decide `DRAFT` × `INVALID` e onde ficam as regras entre linhas.
- Depois o parser: `_read_header` (cabeçalho e unidades) e `_read_cell` (números). A regra de negócio
  "não negativo" continua no domínio.
- Tenho menos certeza sobre: reportar `NO_POINTS` junto com `EMPTY_FILE` (redundante, mas
  determinístico); parar a leitura das linhas quando uma coluna obrigatória falta; e ignorar linhas
  `,,` em vez de reportá-las. As três são fáceis de mudar.
- Os testes cobrem o formato válido e suas variações, cada motivo de inconsistência, o relatório
  completo numa passada e o caminho caso de uso + parser real. Não cobrem desempenho com arquivos
  grandes (não há tabela real nem limite definido).
