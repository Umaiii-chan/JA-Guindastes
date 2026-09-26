# TASK-008 — Criar o núcleo de domínio da tabela de carga, sem regras pendentes

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code; tarefas em paralelo) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-008-nucleo-dominio-tabela-carga` (a partir de `development` @ `c0955b2`) |
| **PR** | — |
| **Requisitos** | RF-016, RF-017, RF-020, RNF-001, RNF-002, RNF-004, RNF-008, RNF-010 |
| **Regras de negócio** | RN-001, RN-004, RN-005, RN-006, RN-007 |
| **Estimativa** | M |

---

## 1. Objetivo

O backend passa a ter um núcleo de domínio puro (só a biblioteca padrão do Python) para a tabela de
carga: unidades internas, pontos e cabeçalho da tabela, uma porta de consulta de capacidade com uma
estratégia de ponto exato e o cálculo de utilização. Nada que dependa das pendências PEND-001..004.

## 2. Contexto

Pedido da pessoa em 2026-09-26, com adaptações de protocolo por haver tarefas em paralelo: o handoff
desta tarefa fica em `handoffs/TASK-008.md` e `handoffs/current.md` não é editado.

Base: doc-fonte §§ 10, 13, 14 e 20; ADR-004 (Clean Architecture), ADR-009 (tabelas estruturadas),
ADR-012 (toolchain e dados FICTÍCIOS em testes). O método de interpolação (PEND-001), o arredondamento
(PEND-002), o valor conservador (PEND-003) e os níveis de alerta (PEND-004) estão pendentes; por isso
a única estratégia concreta é a consulta de ponto exato.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um valor NaN, infinito ou que não seja número, quando crio um comprimento (m), um
  ângulo (graus) ou uma massa (kg), então recebo um erro de domínio; dado um valor negativo, o
  comprimento e a massa são rejeitados e o ângulo é aceito (RN-006, RNF-004).
- [ ] **CA-2** — Dado um ponto com capacidade negativa, quando crio o `LoadChartPoint`, então recebo um
  erro de domínio (capacidades não negativas, doc-fonte § 13.1).
- [ ] **CA-3** — Dados dois pontos com o mesmo `boom_length` e `working_radius` e capacidades
  diferentes, quando crio a `LoadChart`, então recebo um erro de domínio de pontos conflitantes;
  pontos repetidos com a mesma capacidade são aceitos (doc-fonte § 13.1).
- [ ] **CA-4** — A `LoadChart` guarda id, versão, `configuration_id` (RN-001), status e pontos; o status
  só admite `DRAFT`, `VALIDATED`, `ACTIVE`, `SUPERSEDED` e `INVALID` (doc-fonte § 13.2).
- [ ] **CA-5** — Dada a tabela FICTÍCIA e uma consulta com `boom_length` e `working_radius` iguais a um
  ponto da tabela, quando consulto com `ExactPointLookup`, então recebo a capacidade desse ponto.
- [ ] **CA-6** — Dada a tabela FICTÍCIA e uma consulta que não coincide exatamente com um ponto (entre
  pontos, fora da faixa, comprimento de lança inexistente), quando consulto com `ExactPointLookup`,
  então recebo um resultado explícito de "não suportado" com motivo, sem capacidade (RN-007).
- [ ] **CA-7** — Todo resultado da consulta, com ou sem capacidade, traz a versão (e o id) da tabela usada (RN-005).
- [ ] **CA-8** — Dadas uma carga e uma capacidade positiva, quando calculo a utilização, então recebo
  carga/capacidade × 100 sem arredondamento; com capacidade zero, recebo um erro de domínio.
- [ ] **CA-9** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, sem dependência nova.
- [ ] **CA-10** — `handoffs/TASK-008.md` registra comandos, saídas reais e as pendências encontradas.

## 4. Escopo

### Dentro do escopo

- Value objects `Length`, `Angle`, `Mass`, `CapacityQuery` e o resultado da consulta em
  `backend/app/domain/value_objects/`.
- Entidades `LoadChartPoint` e `LoadChart` (com `LoadChartStatus`) em `backend/app/domain/entities/`.
- Porta `LoadChartInterpolator` (Protocol), estratégia `ExactPointLookup` e cálculo de utilização em
  `backend/app/domain/services/`.
- Exceções de domínio em `backend/app/domain/exceptions/`.
- Testes em `backend/tests/domain/` com dados FICTÍCIOS em `backend/tests/fixtures/`.
- Linha em `docs/known-gaps.md` sobre a consulta só por ponto exato.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Interpolação, arredondamento, valor conservador ou extrapolação (PEND-001..003, RN-007).
- Níveis de status/alerta e `SafetyValidator` (PEND-004, P-005).
- Transições de estado da `LoadChart` e seleção da tabela `ACTIVE` (`LoadChartResolver`).
- Conversão de unidades vindas de tabelas (PEND-008, doc-fonte § 26 pergunta 10).
- Endpoints, casos de uso, persistência, importadores.
- Alterar `docs/business-rules.md`, ADRs, `.github/workflows/*`, `handoffs/current.md` e outras tarefas.
- Se algo daqui parecer necessário, registrar em "Pendências" do handoff e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/domain/{value_objects,entities,services,exceptions}/*.py` | criar | sim |
| `backend/tests/domain/`, `backend/tests/fixtures/` | criar | sim |
| `docs/known-gaps.md` | alterar (uma linha) | sim |
| `handoffs/TASK-008.md`, este arquivo | criar | sim |

## 6. Riscos e dependências

- Depende de: nada bloqueante; as pendências PEND-001..004 limitam o que pode ser implementado.
- Risco: dados FICTÍCIOS confundidos com capacidade real → rótulo FICTÍCIO no nome do arquivo, no
  cabeçalho, nos identificadores da tabela e nos nomes dos testes (ADR-012).
- Risco: conflito de merge com as tarefas em paralelo em `docs/known-gaps.md` → mudança de uma linha.

## 7. Teste manual (se houver)

Não há: todo o comportamento é verificado pelos testes automatizados de domínio.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/` | `check-structure.sh` | [x] |
| 2 | Exceções e value objects de unidade | `app/domain/exceptions/`, `app/domain/value_objects/` | CA-1, gates | [x] |
| 3 | Entidades `LoadChartPoint` e `LoadChart` | `app/domain/entities/` | CA-2..CA-4 | [x] |
| 4 | Porta, `ExactPointLookup` e utilização | `app/domain/services/`, `app/domain/value_objects/` | CA-5..CA-8 | [x] |
| 5 | known-gaps e handoff | `docs/known-gaps.md`, `handoffs/TASK-008.md` | CA-9, CA-10 | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (pacotes de domínio estavam vazios).
- Regras de negócio aplicáveis: RN-001, RN-004, RN-005, RN-006, RN-007.
- Decisões necessárias: registradas em `handoffs/TASK-008.md` § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| unidades rejeitam NaN/infinito/não número; negativos por tipo | CA-1 | unitário | `backend/tests/domain/test_quantities.py` | verde |
| capacidade negativa rejeitada | CA-2 | unitário | `backend/tests/domain/test_load_chart.py` | verde |
| pontos conflitantes rejeitados, repetidos iguais aceitos | CA-3 | unitário | `backend/tests/domain/test_load_chart.py` | verde |
| campos e estados da `LoadChart` | CA-4 | unitário | `backend/tests/domain/test_load_chart.py` | verde |
| ponto exato da tabela FICTÍCIA | CA-5 | unitário | `backend/tests/domain/test_exact_point_lookup.py` | verde |
| consulta fora de ponto exato → não suportado | CA-6 | unitário | `backend/tests/domain/test_exact_point_lookup.py` | verde |
| versão da tabela no resultado | CA-7 | unitário | `backend/tests/domain/test_exact_point_lookup.py` | verde |
| utilização e capacidade zero | CA-8 | unitário | `backend/tests/domain/test_utilization.py` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
