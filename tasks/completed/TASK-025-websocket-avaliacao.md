# TASK-025 — Expor a avaliação em tempo real por WebSocket

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-025-websocket-avaliacao` (a partir de `a5b1ab0`, commit-base da leva A) |
| **PR** | [#26](https://github.com/Umaiii-chan/JA-Guindastes/pull/26), mergeado em 2026-09-26 |
| **Requisitos** | RF-015..RF-018, RF-020, RNF-003 |
| **Regras de negócio** | RN-004, RN-005, RN-007, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

O backend passa a ter um endpoint WebSocket que recebe o estado operacional a cada interação
(`simulation.state.changed`, com `sequence`) e responde com o resultado do `EvaluateOperation`
(`simulation.evaluated`, com o mesmo `sequence`): geometria, capacidade com o ponto usado e a marca
provisória conservadora, utilização e id/versão da tabela, ou "não avaliável" com os motivos. Uma
mensagem inválida recebe um erro estruturado, sem derrubar a conexão.

## 2. Contexto

- ADR-010: WebSocket para o ciclo interativo. Mensagens e `sequence` na doc-fonte § 15.4; sequência
  na doc-fonte § 16.1 (diagrama 06).
- O caso de uso `EvaluateOperation` (TASK-015) e a `ConservativeTabulatedLookup` (TASK-020, ADR-015)
  já existem. Não há simulação persistida: a configuração vem em cada mensagem
  (`handoffs/TASK-025.md` § 5).
- Sem níveis de alerta (PEND-004): a resposta não tem `status`.
- Leva A (TASK-021): esta tarefa só cria arquivos novos em `backend/app/presentation/websocket/` e
  `backend/tests/presentation/websocket/`. O registro do router na aplicação fica para a leva B
  (`backend/app/presentation/api/main.py` e `backend/app/main.py` são da TASK-024).
- Dados de teste FICTÍCIOS rotulados (ADR-012).

## 3. Critérios de aceite

- [ ] **CA-1** — Dada uma app FastAPI com o router da factory `create_evaluation_websocket_router`,
  quando o cliente envia `simulation.state.changed` válido com `sequence` N, então recebe
  `simulation.evaluated` com `sequence` N.
- [ ] **CA-2** — Dado um raio calculado entre dois raios tabelados (dados FICTÍCIOS), então o
  resultado é `EVALUATED` com geometria, `maximum_capacity_kg` do vizinho de menor capacidade,
  `strategy: CONSERVATIVE_PROVISIONAL`, raio consultado, ponto usado, utilização e id/versão da
  tabela; sem `status` nem nível de alerta (PEND-004).
- [ ] **CA-3** — Dado um estado fora da tabela, fora das faixas da ficha técnica, de configuração
  desconhecida ou com capacidade 0 kg, então o resultado é `NOT_EVALUABLE` com os motivos, sem
  `utilization_percent`, com a geometria quando ela pôde ser calculada.
- [ ] **CA-4** — Dadas várias mensagens na mesma conexão, então cada uma recebe a resposta com o
  próprio `sequence`, na ordem de envio.
- [ ] **CA-5** — Dada uma mensagem malformada (não JSON, não objeto, `NaN`, frame binário), de tipo
  desconhecido, sem `sequence` ou com `sequence` não inteiro, ou com valores inválidos (negativos,
  não finitos, número em texto, campo ausente ou desconhecido), então o servidor responde
  `simulation.error` com um código legível por máquina e o `sequence` quando ele é inteiro, e a
  conexão continua avaliando as próximas mensagens (RN-008).
- [ ] **CA-6** — Dada uma mensagem acima do limite de tamanho provisório (8 KiB em UTF-8,
  "A VALIDAR (P-008)"), então o servidor responde `MESSAGE_TOO_LARGE` sem ler a mensagem, e a
  mensagem exatamente no limite é avaliada.
- [ ] **CA-7** — Dada uma falha inesperada na avaliação, então o servidor responde `INTERNAL_ERROR`
  com o `sequence`, sem detalhes internos, registra a exceção no log e mantém a conexão.
- [ ] **CA-8** — Nenhum teste existente quebra; ruff, formatação, mypy, lint-imports e
  `check-structure.sh` passam.
- [ ] **CA-9** — As mudanças de documentação necessárias estão listadas no § 10 do handoff (a
  edição de `docs/` fica fora desta tarefa na leva A).

## 4. Escopo

### Dentro do escopo

- `backend/app/presentation/websocket/evaluation.py` (factory, handler, limite) e
  `evaluation_messages.py` (schemas das mensagens).
- Testes em `backend/tests/presentation/websocket/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Registrar o router na aplicação (`app.main`, `app.presentation.api.main`): leva B.
- Simulação persistida e a rota `/api/v1/ws/simulations/{simulation_id}` da doc-fonte.
- Níveis de alerta (PEND-004), autenticação e validação de `Origin` (P-009), limite de taxa.
- Dependências novas, `pyproject.toml`, `docs/`, `README.md`, `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/presentation/websocket/evaluation.py` | criar | sim |
| `backend/app/presentation/websocket/evaluation_messages.py` | criar | sim |
| `backend/tests/presentation/websocket/__init__.py` | criar | sim |
| `backend/tests/presentation/websocket/test_evaluation_websocket.py` | criar | sim |

## 6. Riscos e dependências

- Depende de: TASK-015 e TASK-020 (já em `development`).
- Risco: o schema da resposta divergir do endpoint REST de avaliação (TASK-024, em paralelo) →
  mitigação: pendência no handoff para alinhar na leva B.
- Risco: o limite de 8 KiB é conferido depois que o servidor ASGI recebeu a mensagem → mitigação:
  configurar `--ws-max-size` do uvicorn na composição (pendência).

## 7. Teste manual (se houver)

Não há: o router ainda não está registrado na aplicação (leva B). Tudo é coberto por testes com
`TestClient.websocket_connect`.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Schemas de entrada, saída e erro | `evaluation_messages.py` | mypy, testes | [x] |
| 2 | Factory do router, laço de recepção, validação e limite | `evaluation.py` | testes | [x] |
| 3 | Testes com app montada no teste e fakes FICTÍCIOS | `tests/presentation/websocket/` | `uv run pytest` | [x] |
| 4 | Gates, handoff e esta tarefa | `handoffs/TASK-025.md` | gates | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só arquivos novos, sem registro na app).
- Regras de negócio aplicáveis: RN-004, RN-005, RN-007, RN-008; PEND-004 (sem alerta).
- Decisões necessárias: rota e origem da configuração (handoff § 5 e § 8).

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Todos em `backend/tests/presentation/websocket/test_evaluation_websocket.py` (51 testes, verdes).

| Cenário | Critério | Tipo | Status |
|---------|----------|------|--------|
| raio entre pontos → `EVALUATED` com o mesmo `sequence`, capacidade conservadora, ponto usado, utilização, tabela | CA-1, CA-2 | integração (TestClient) | verde |
| resposta sem `status` nem nível de alerta | CA-2 | integração | verde |
| `ExactPointLookup` → campos da marca `null` | CA-2 | integração | verde |
| 3 mensagens seguidas respondidas em ordem; `sequence` ecoado sem exigir ordem | CA-4 | integração | verde |
| lança sem coluna, lança acima do máximo, configuração desconhecida, capacidade 0 kg → `NOT_EVALUABLE` | CA-3 | integração | verde |
| texto não JSON, truncado, lista, número, string, vazio, `NaN`, aninhamento profundo, frame binário → `MALFORMED_MESSAGE` | CA-5 | integração | verde |
| tipo desconhecido → `UNKNOWN_MESSAGE_TYPE` com `sequence` | CA-5 | integração | verde |
| `sequence` ausente, texto, float, booleano, `null` → `INVALID_MESSAGE` sem `sequence` | CA-5 | integração | verde |
| valores inválidos no `payload`, `1e400`, campos ausentes/desconhecidos, `payload` ausente | CA-5 | integração | verde |
| limite: no limite avalia, +1 byte recusa; conta bytes UTF-8; limite padrão 8 KiB; factory recusa limite inválido | CA-6 | integração/unitário | verde |
| falha interna → `INTERNAL_ERROR`, log, conexão mantida | CA-7 | integração | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

Pendente.

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
