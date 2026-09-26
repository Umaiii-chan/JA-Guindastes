# TASK-015 — Criar o caso de uso de avaliação operacional (geometria + tabela + utilização)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-015..017, tarefas em paralelo) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-015-caso-de-uso-avaliacao` (a partir de `d5eedab`, o commit que abriu a leva) |
| **PR** | — |
| **Requisitos** | RF-015, RF-016, RF-017, RF-018, RF-020, RNF-001, RNF-002, RNF-010 |
| **Regras de negócio** | RN-001, RN-004, RN-005, RN-006, RN-007, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

A camada de aplicação do backend passa a ter o caso de uso `EvaluateOperation`: dado uma
configuração, um estado operacional (L, θ, ψ, c) e o peso da carga, ele calcula a geometria do
ADR-013, consulta a tabela de carga ativa da configuração com o comprimento de lança e o raio
calculado, e calcula a utilização. O resultado diz se a operação foi "avaliada" ou é "não
avaliável", com os motivos, sem inventar níveis de alerta.

## 2. Contexto

- Doc-fonte § 14.1: o motor de cálculo é `GeometryService` → `LoadChartResolver` →
  `LoadChartInterpolator` → `SafetyValidator`. O domínio já tem a geometria (TASK-014), a porta
  `LoadChartInterpolator` com a estratégia `ExactPointLookup` e a utilização (TASK-008). Falta o caso
  de uso que liga as peças.
- Persistência (TASK-011) ainda está em andamento: a ficha técnica geométrica e a tabela ativa vêm
  por **portas** (`typing.Protocol`) na aplicação, testadas com fakes. Não há endpoint nem
  WebSocket nesta tarefa.
- PEND-004 (níveis de alerta) está aberta: não há `WARNING`/`CRITICAL` nem limiar. O resultado só
  distingue "avaliado" de "não avaliável" (RN-007, RF-020).
- ADR-013 C-5: estado fora das faixas e R < 0 são sinalizados, não corrigidos. Nesta tarefa, o caso
  de uso **não propaga** os erros de domínio da TASK-014: devolve "não avaliável" com as violações
  (decisão da pessoa responsável, 2026-09-26).
- ADR-013 C-6: a tolerância para comparar L com os comprimentos tabelados "fica para a tarefa do
  `LoadChartInterpolator`" e não tem valor definido. Por isso a busca continua **exata**
  (`ExactPointLookup`), e a pendência fica registrada no handoff.
- Tarefas em paralelo (TASK-006): TASK-011 (persistência), TASK-016 (frontend), TASK-017 (docs e
  docstrings). Esta tarefa só cria arquivos novos em `backend/app/application/`,
  `backend/tests/application/` e `backend/tests/fixtures/`; o handoff fica em
  `handoffs/TASK-015.md` e `handoffs/current.md` não é editado.
- Dados de teste FICTÍCIOS, rotulados como tal (ADR-012).

## 3. Critérios de aceite

- [ ] **CA-1** — Dadas as portas `CraneGeometryProvider` e `ActiveLoadChartProvider` (Protocol) em
  `backend/app/application/ports/`, quando um fake as implementa, então o caso de uso as usa com o
  `configuration_id` recebido.
- [ ] **CA-2** — Dado um estado dentro das faixas cujo raio calculado (ADR-013) e comprimento de
  lança coincidem com um ponto da tabela ativa FICTÍCIA, quando executo `EvaluateOperation`, então
  recebo "avaliado" com a geometria, a capacidade do ponto, a utilização `carga / capacidade × 100`
  e o id e a versão da tabela (RN-005).
- [ ] **CA-3** — Dado um estado cujo raio calculado ou comprimento de lança não é ponto da tabela,
  então recebo "não avaliável" com a geometria, `CapacityUnsupported(POINT_NOT_IN_CHART)`, o id e a
  versão da tabela, o motivo e nenhuma utilização (RN-007, RF-020).
- [ ] **CA-4** — Dado um estado fora das faixas da ficha técnica, ou com R < 0, então nenhuma
  exceção é propagada: recebo "não avaliável" com todas as violações (ou `OUTSIDE_GEOMETRIC_DOMAIN`),
  sem geometria, e a tabela não é consultada.
- [ ] **CA-5** — Dada uma configuração sem tabela ativa (ou sem ficha técnica geométrica), então
  recebo "não avaliável" com motivo próprio; a geometria, se calculável, continua no resultado
  (ADR-013 C-6).
- [ ] **CA-6** — A consulta à tabela usa a estratégia injetada, com o comprimento de lança do estado
  e o raio calculado, busca exata e sem tolerância inventada (ADR-013 C-6 não define valor).
- [ ] **CA-7** — O resultado não tem nível de alerta nem limiar (PEND-004): utilização acima de
  100 % continua só "avaliado".
- [ ] **CA-8** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, sem dependência
  nova, e `bash scripts/check-structure.sh` não tem erro.
- [ ] **CA-9** — `handoffs/TASK-015.md` registra comandos, saídas reais, decisões, a limitação da
  busca exata com raio calculado e as pendências.

## 4. Escopo

### Dentro do escopo

- Portas `CraneGeometryProvider` e `ActiveLoadChartProvider` em `backend/app/application/ports/`.
- Caso de uso `EvaluateOperation` e tipos do resultado em `backend/app/application/use_cases/`.
- Testes com fakes das portas em `backend/tests/application/` e fixture FICTÍCIA nova em
  `backend/tests/fixtures/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Endpoint REST, WebSocket, schemas Pydantic e persistência (TASK-011).
- Níveis de alerta, limiares, `SafetyValidator` com status (PEND-004, P-005).
- Interpolação, arredondamento, valor conservador e tolerância na busca (PEND-001..003; ADR-013 C-6).
- Transições de status da tabela e "modo técnico de validação" (doc-fonte § 13.2).
- Alterar arquivos existentes (domínio, docs, `handoffs/current.md`) ou os arquivos das TASK-011,
  TASK-016 e TASK-017.
- Se algo daqui parecer necessário, registrar em "Pendências" e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/application/ports/crane_geometry_provider.py` | criar | sim |
| `backend/app/application/ports/active_load_chart_provider.py` | criar | sim |
| `backend/app/application/use_cases/evaluate_operation.py` | criar | sim |
| `backend/tests/application/test_evaluate_operation.py` | criar | sim |
| `backend/tests/fixtures/avaliacao_operacional_ficticia.py` | criar | sim |
| `handoffs/TASK-015.md`, este arquivo | criar | sim |

## 6. Riscos e dependências

- Depende de: TASK-008 (tabela, interpolador, utilização) e TASK-014 (geometria), já em `development`.
- Risco: o raio calculado quase nunca coincide exatamente com um raio tabelado (ponto flutuante e
  PEND-001) → limitação conhecida, registrada no handoff e coberta por teste.
- Risco: portas divergirem do que a TASK-011 vai implementar → portas mínimas, só `configuration_id`
  na entrada e `None` quando não há dado.
- Risco: conflito com tarefas em paralelo → só arquivos novos.

## 7. Teste manual (se houver)

Não há: todo o comportamento é verificado pelos testes automatizados com fakes.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/` | `check-structure.sh` | [x] |
| 2 | Portas, caso de uso e tipos do resultado | `app/application/ports/`, `app/application/use_cases/` | mypy, lint-imports | [x] |
| 3 | Fixture FICTÍCIA e testes com fakes | `tests/application/`, `tests/fixtures/` | CA-1..CA-7, pytest | [x] |
| 4 | Handoff | `handoffs/TASK-015.md` | CA-8, CA-9 | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só arquivos novos; nada existente os importa).
- Regras de negócio aplicáveis: RN-001 (tabela da configuração), RN-004 (capacidade só da tabela),
  RN-005 (id e versão da tabela no resultado), RN-006 (m, graus, kg), RN-007 (fora da tabela
  identificado), RN-008 (geometria calculada no backend a partir das entradas operacionais).
- Decisões necessárias: registradas em `handoffs/TASK-015.md` § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| providers recebem o `configuration_id` pedido | CA-1 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| estado sobre ponto da tabela → avaliado com capacidade, utilização, geometria do domínio, id e versão | CA-2 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| utilização = carga / capacidade × 100 (0 %, 75 %, 100 %, 125 %) | CA-2 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| raio calculado fora da tabela; L entre colunas; capacidade 0 kg → não avaliável com motivo, id e versão | CA-3 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| estado fora das faixas (uma e várias violações) e R < 0 → não avaliável, sem exceção e sem consulta | CA-4 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| sem tabela ativa (geometria mantida); sem ficha técnica; os dois motivos juntos na ordem das etapas | CA-5 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| consulta com L do estado e raio calculado; estratégia injetada; raio igual ao tabelado só na conta à mão não é achado | CA-6 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| carga acima da capacidade só "avaliada", sem `status` | CA-7 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |
| provedor devolve tabela de outra configuração ou não `ACTIVE` → erro de contrato | CA-1 | unitário | `backend/tests/application/test_evaluate_operation.py` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
