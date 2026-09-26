# TASK-020 — Implementar a consulta conservadora provisória na tabela de carga (ADR-015)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-020-consulta-conservadora-provisoria` (a partir de `6388903`, o commit do ADR-015) |
| **PR** | — |
| **Requisitos** | RF-016, RF-020, RNF-001, RNF-002, RNF-010 |
| **Regras de negócio** | RN-004, RN-005, RN-007 |
| **Estimativa** | M |

---

## 1. Objetivo

O domínio do backend passa a ter uma segunda estratégia de consulta à tabela de carga,
`ConservativeTabulatedLookup`, que dá capacidade para qualquer raio dentro da faixa tabelada de um
comprimento de lança existente na tabela, sempre com um valor da própria tabela e do lado seguro,
e marca o resultado como provisório conservador. O caso de uso de avaliação passa a chegar a
"avaliado" quando essa estratégia é injetada, sem mudar o caso de uso.

## 2. Contexto

- A estratégia foi **escolhida pela pessoa responsável em chat** (2026-09-26, opção "conservador
  provisório") e está registrada no
  [ADR-015](../../docs/decisions/ADR-015-consulta-conservadora-provisoria.md) (commit `6388903`),
  que é a especificação desta tarefa: ε = 1·10⁻⁶ m só para ruído de ponto flutuante; comprimento
  precisa coincidir (±ε); raio igual (±ε) usa o ponto; raio entre dois tabelados usa a **menor**
  capacidade dos dois vizinhos; abaixo do menor ou acima do maior raio, "fora do domínio"; o
  resultado informa o raio consultado, o ponto usado e a marca de estratégia provisória
  conservadora.
- A TASK-015 mostrou a limitação da `ExactPointLookup` com o raio calculado (ex.:
  `11.500000000000002` contra `11.5`): quase todo estado real saía "não avaliável"
  (`handoffs/history/2026-09-26-TASK-015-implementacao.md` § 7).
- PEND-001, PEND-002 e PEND-003 continuam abertas em `docs/business-rules.md`; o ADR-015 é
  provisório até a empresa responder.
- A porta `LoadChartInterpolator` (TASK-008) já permite trocar a estratégia; o `EvaluateOperation`
  (TASK-015) recebe a estratégia injetada.
- Tarefas em paralelo (TASK-006): TASK-016 (`frontend/`) e TASK-019 (`backend/app/presentation/`,
  `backend/tests/presentation/`, `backend/pyproject.toml`, `backend/uv.lock`). Esta tarefa só cria
  arquivos novos em `backend/app/domain/`, `backend/tests/domain/`, `backend/tests/application/` e
  `backend/tests/fixtures/`, mais a mudança mínima justificada no handoff (§ 5). O handoff fica em
  `handoffs/TASK-020.md`; `handoffs/current.md` não é editado.
- Dados de teste FICTÍCIOS, rotulados como tal (ADR-012).

## 3. Critérios de aceite

- [ ] **CA-1** — Dada uma tabela FICTÍCIA e uma consulta cujo comprimento e raio coincidem com um
  ponto, quando consulto com `ConservativeTabulatedLookup`, então recebo um `CapacityFound` com a
  capacidade do ponto, o raio consultado, o ponto usado (comprimento, raio, capacidade) e a marca
  de estratégia provisória conservadora.
- [ ] **CA-2** — Dado um raio ou comprimento com ruído de ponto flutuante até ε = 1·10⁻⁶ m (ex.:
  `11.500000000000002`), então o ponto tabelado (`11.5`) é usado; além de ε, o valor é outro.
- [ ] **CA-3** — Dado um raio entre dois raios tabelados do comprimento consultado, então a
  capacidade é a **menor** dos dois vizinhos, inclusive numa tabela atípica em que o vizinho maior
  tem capacidade maior.
- [ ] **CA-4** — Dado um raio abaixo do menor ou acima do maior raio tabelado (além de ε), então
  recebo `CapacityUnsupported` com motivo explícito (RN-007) e nenhuma capacidade.
- [ ] **CA-5** — Dado um comprimento de lança que não coincide (±ε) com nenhum comprimento
  tabelado, então recebo `CapacityUnsupported` com motivo explícito; sem interpolação nem
  arredondamento de comprimento (ADR-013 C-6).
- [ ] **CA-6** — Em todo resultado, suportado ou não, estão o id e a versão da tabela (RN-005); a
  capacidade devolvida é sempre a de um ponto da tabela (RN-004).
- [ ] **CA-7** — Dado o `EvaluateOperation` com a nova estratégia injetada e um estado FICTÍCIO cujo
  raio calculado cai entre pontos da tabela, então recebo "avaliado" com a capacidade do vizinho de
  menor capacidade, sem alterar o caso de uso; a `ExactPointLookup` e os testes existentes
  continuam passando.
- [ ] **CA-8** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, sem dependência
  nova, e `bash scripts/check-structure.sh` não tem erro.
- [ ] **CA-9** — `handoffs/TASK-020.md` registra comandos, saídas reais, decisões, a mudança mínima
  em arquivo existente (com o motivo) e as pendências.

## 4. Escopo

### Dentro do escopo

- Estratégia `ConservativeTabulatedLookup` em `backend/app/domain/services/`.
- Tipo de resultado novo, compatível com a porta, em `backend/app/domain/value_objects/`.
- Motivos novos de "não suportado" (comprimento não tabelado, raio abaixo do mínimo, raio acima do
  máximo).
- Testes de domínio em `backend/tests/domain/`, fixture FICTÍCIA nova em `backend/tests/fixtures/`
  e um teste de aplicação novo em `backend/tests/application/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Interpolação (linear ou outra), arredondamento e tolerância de engenharia (PEND-001..003).
- Trocar a estratégia padrão em algum ponto de composição (não há composição ainda: sem endpoint de
  avaliação).
- Alterar o `EvaluateOperation`, a `ExactPointLookup`, a `LoadChart` ou os testes existentes.
- Alterar `docs/`, `handoffs/current.md` ou os arquivos das TASK-016 e TASK-019.
- Se algo daqui parecer necessário, registrar em "Pendências" e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/domain/services/conservative_tabulated_lookup.py` | criar | sim |
| `backend/app/domain/value_objects/conservative_capacity_result.py` | criar | sim |
| `backend/app/domain/value_objects/capacity_result.py` | alterar (mínimo: 3 membros novos no enum; motivo no handoff) | sim |
| `backend/tests/domain/test_conservative_tabulated_lookup.py` | criar | sim |
| `backend/tests/fixtures/consulta_conservadora_ficticia.py` | criar | sim |
| `backend/tests/application/test_evaluate_operation_conservative_lookup.py` | criar | sim |
| `handoffs/TASK-020.md`, este arquivo | criar | sim |

## 6. Riscos e dependências

- Depende de: ADR-015 (aceito, provisório), TASK-008 (porta e tabela) e TASK-015 (caso de uso), já
  em `development`.
- Risco: o valor provisório ser tratado como definitivo → marca de estratégia no resultado; a UI
  ainda precisa mostrá-la (fora do escopo).
- Risco: conflito com tarefas em paralelo → só arquivos novos, mais três membros num enum que
  nenhuma delas toca.
- Risco (do ADR-015): o raio da tabela incluir deflexão da lança (ADR-013 G-1) → não resolvido aqui.

## 7. Teste manual (se houver)

Não há: todo o comportamento é verificado pelos testes automatizados.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/` | `check-structure.sh` | [x] |
| 2 | Motivos novos, tipo de resultado e estratégia | `app/domain/value_objects/`, `app/domain/services/` | mypy, lint-imports | [ ] |
| 3 | Fixture FICTÍCIA e testes de domínio | `tests/fixtures/`, `tests/domain/` | CA-1..CA-6, pytest | [ ] |
| 4 | Teste de aplicação com a estratégia injetada | `tests/application/` | CA-7, pytest | [ ] |
| 5 | Handoff | `handoffs/TASK-020.md` | CA-8, CA-9 | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: quem trata `CapacityUnsupportedReason` de forma
  exaustiva (verificado com `grep`: ninguém faz `match` exaustivo; só há comparações com
  `POINT_NOT_IN_CHART`).
- Regras de negócio aplicáveis: RN-004, RN-005, RN-007.
- Decisões necessárias: registradas em `handoffs/TASK-020.md` § 8.

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
