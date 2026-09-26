# TASK-010 — Importar tabela de carga em CSV com relatório de inconsistências (PoC)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-010..013, tarefas em paralelo) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-010-importacao-csv-tabela-carga` (a partir de `ae2ec66`, commit-base da leva TASK-010..013) |
| **PR** | — |
| **Requisitos** | RF-006, RF-008 (parcial), RF-009, RNF-002, RNF-006, RNF-008 |
| **Regras de negócio** | RN-001, RN-005, RN-006 |
| **Estimativa** | M |

---

## 1. Objetivo

O backend passa a ler uma tabela de carga em CSV, num formato canônico interno **provisório**, e a
devolver os pontos válidos junto com um relatório de inconsistências (linha, coluna e motivo). Um caso
de uso monta a `LoadChart` do domínio em `DRAFT` quando não há inconsistência, ou devolve o relatório
com status `INVALID`. Sem persistência e sem endpoint.

## 2. Contexto

Pedido da pessoa em 2026-09-26 (leva de tarefas em paralelo TASK-010..013). Por haver tarefas em
paralelo, o handoff desta tarefa fica em `handoffs/TASK-010.md` e `handoffs/current.md` não é editado.

Base: doc-fonte §§ 13 (fluxo e validações mínimas da importação) e 20; ADR-004 (Clean Architecture),
ADR-009 (tabelas importadas e normalizadas), ADR-012 (toolchain e dados FICTÍCIOS em testes); núcleo de
domínio da TASK-008 (`Length`, `Mass`, `LoadChartPoint`, `LoadChart`, `LoadChartStatus`).

**O formato real das tabelas da empresa não é conhecido (PEND-008), e o formato canônico interno
de importação continua em aberto (known-gaps P-006).** O formato abaixo foi definido pela pessoa
responsável para esta PoC e é **provisório**: pode mudar quando a tabela oficial chegar.

### Formato canônico interno PROVISÓRIO (CSV)

- Arquivo em UTF-8 (BOM opcional), separador vírgula, decimal ponto.
- Primeira linha não vazia = cabeçalho, obrigatório, com as colunas
  `boom_length_m,working_radius_m,max_capacity_kg`.
- A unidade vem do sufixo do nome da coluna. Só as unidades internas são reconhecidas (`m` para
  `boom_length` e `working_radius`, `kg` para `max_capacity`; RN-006). Não há conversão de unidade.
- Coluna com sufixo de unidade desconhecido, sem sufixo, ausente, repetida ou desconhecida é
  inconsistência.
- Cada linha seguinte é um ponto da tabela.

Detalhes técnicos escolhidos pelo agente dentro desse formato (ordem das colunas, linhas em branco,
sintaxe do número etc.) estão em `handoffs/TASK-010.md` § 5 e na docstring de
`backend/app/infrastructure/importers/csv_load_chart_parser.py`.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um CSV FICTÍCIO no formato provisório, sem erros, quando o parser o lê, então
  devolve todos os pontos (em m e kg, com o número da linha de origem) e nenhuma inconsistência.
- [ ] **CA-2** — Dado um CSV com vários problemas em linhas diferentes, quando o parser o lê, então
  não levanta exceção: devolve os pontos válidos e **todas** as inconsistências, cada uma com número
  da linha, coluna (quando se aplica) e motivo legível por máquina e por pessoa (RNF-006).
- [ ] **CA-3** — Dado um cabeçalho com coluna obrigatória ausente, coluna sem sufixo de unidade, com
  unidade não reconhecida (ex.: `boom_length_ft`), repetida ou desconhecida, quando o parser o lê,
  então cada caso vira uma inconsistência do cabeçalho (RF-009, RN-006).
- [ ] **CA-4** — Dado um valor vazio, não numérico, `NaN`/infinito ou negativo numa coluna
  obrigatória, ou uma linha com número de campos diferente do cabeçalho, quando o parser o lê, então
  a linha vira inconsistência e não gera ponto (doc-fonte § 13.1).
- [ ] **CA-5** — Dado um arquivo vazio, sem pontos (só cabeçalho), com encoding que não é UTF-8, CSV
  malformado ou separador `;`, quando importado, então o resultado é `INVALID` com a inconsistência
  correspondente.
- [ ] **CA-6** — Dados pontos com o mesmo `boom_length` e `working_radius` e capacidades diferentes,
  quando o caso de uso valida a importação, então todas as linhas envolvidas são reportadas como
  conflitantes e o resultado é `INVALID` (doc-fonte § 13.1).
- [ ] **CA-7** — Dada uma importação sem inconsistências, quando o caso de uso `ValidateLoadChartImport`
  executa com id, versão e `configuration_id`, então devolve uma `LoadChart` com status `DRAFT`, esses
  metadados (RN-001, RN-005) e os pontos lidos; nunca `ACTIVE` (doc-fonte § 13.2).
- [ ] **CA-8** — Dada uma importação com qualquer inconsistência (ou id, versão ou `configuration_id`
  em branco), quando o caso de uso executa, então devolve status `INVALID` e o relatório, sem
  `LoadChart`.
- [ ] **CA-9** — `app.application` não importa `app.infrastructure`, FastAPI nem SQLAlchemy
  (`uv run lint-imports`), e nenhuma dependência nova entra em `backend/pyproject.toml`.
- [ ] **CA-10** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`; nenhum teste
  existente quebra.
- [ ] **CA-11** — Os CSVs de teste são FICTÍCIOS e rotulados como tal no nome do arquivo e num README
  ao lado (ADR-012); a linha P-006 de `docs/known-gaps.md` aponta o formato provisório adotado;
  `handoffs/TASK-010.md` registra comandos, saídas reais e pendências.

## 4. Escopo

### Dentro do escopo

- Porta `LoadChartParser` (Protocol) e os tipos do relatório em `backend/app/application/ports/`.
- Caso de uso `ValidateLoadChartImport` em `backend/app/application/use_cases/`.
- Adapter `CsvLoadChartParser` (só biblioteca padrão: `csv`) em `backend/app/infrastructure/importers/`.
- Testes em `backend/tests/application/` e `backend/tests/infrastructure/`; CSVs FICTÍCIOS em
  `backend/tests/fixtures/load_chart_csv/`.
- Acréscimo na linha P-006 de `docs/known-gaps.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Importação XLSX (exigiria dependência nova; fica para outra tarefa).
- Persistência da tabela e dos pontos, preservação do arquivo-fonte e seus metadados (RF-008, doc-fonte
  § 19.2), vínculo com configuração existente (§ 13.1): dependem da persistência (TASK-011 em diante).
- Endpoint REST de importação (doc-fonte § 15.2), limites de upload (P-008) e autenticação (P-009).
- Transições `DRAFT → VALIDATED → ACTIVE` e ativação da tabela.
- Conversão de unidades (doc-fonte § 26, pergunta 10) e qualquer formato de tabela real (PEND-008).
- Alterar `docs/business-rules.md`, ADRs, `handoffs/current.md` e os arquivos das tarefas paralelas
  (TASK-011: `backend/app/infrastructure/database`, `backend/pyproject.toml`, Docker; TASK-012:
  `README.md`; TASK-013: `frontend/`).
- Se algo daqui parecer necessário, registrar em "Pendências" do handoff e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/application/ports/load_chart_parser.py` | criar | sim |
| `backend/app/application/use_cases/validate_load_chart_import.py` | criar | sim |
| `backend/app/infrastructure/importers/csv_load_chart_parser.py` | criar | sim |
| `backend/tests/application/`, `backend/tests/infrastructure/` | criar | sim |
| `backend/tests/fixtures/load_chart_csv/` | criar | sim |
| `docs/known-gaps.md` | alterar (linha P-006) | sim |
| `handoffs/TASK-010.md`, este arquivo | criar | sim |

## 6. Riscos e dependências

- Depende de: núcleo de domínio da TASK-008 (já em `development`).
- Risco: o formato provisório ser tomado como definitivo → "PROVISÓRIO" na tarefa, no handoff, na
  docstring do parser e em P-006.
- Risco: dados FICTÍCIOS confundidos com capacidade real → rótulo no nome dos arquivos, README ao lado e
  nomes dos testes (ADR-012).
- Risco: conflito de merge em `docs/known-gaps.md` com tarefas paralelas → mudança restrita à linha P-006.

## 7. Teste manual (se houver)

Não há: todo o comportamento é verificado pelos testes automatizados.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/` | `check-structure.sh` | [ ] |
| 2 | Porta, tipos do relatório e caso de uso, com testes (parser falso) | `app/application/`, `tests/application/` | CA-6..CA-9 | [ ] |
| 3 | Parser CSV, CSVs FICTÍCIOS e testes (inclusive com o caso de uso) | `app/infrastructure/importers/`, `tests/infrastructure/`, `tests/fixtures/load_chart_csv/` | CA-1..CA-5 | [ ] |
| 4 | known-gaps (P-006) e handoff | `docs/known-gaps.md`, `handoffs/TASK-010.md` | CA-10, CA-11 | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (pacotes `application` e `importers` estavam vazios).
- Regras de negócio aplicáveis: RN-001, RN-005, RN-006.
- Decisões necessárias: registradas em `handoffs/TASK-010.md` § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| — | — | — | — | — |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
