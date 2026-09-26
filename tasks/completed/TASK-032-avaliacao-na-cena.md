# TASK-032 — Mostrar na cena a avaliação do backend (REST e WebSocket)

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva B, em chat) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-032-avaliacao-na-cena` (a partir de `e5a8945`) |
| **PR** | [#31](https://github.com/Umaiii-chan/JA-Guindastes/pull/31), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-015..RF-020, RNF-003, RNF-008 |
| **Regras de negócio** | RN-007, RN-008 (PEND-004 aberta) |
| **Estimativa** | M |

---

## 1. Objetivo

Ao mexer nos sliders do guindaste, no peso da carga ou na configuração, a tela envia o estado ao
backend e mostra o resultado oficial da avaliação (avaliado / não avaliável com os motivos,
capacidade, utilização, ponto tabelado usado), com a marca da consulta conservadora provisória
(ADR-015) e o estado da conexão.

## 2. Contexto

- O backend já tem `POST /api/v1/evaluations` (TASK-024) e o WebSocket `/api/v1/ws/evaluation`
  (TASK-025; registro em `create_app` é da TASK-029, em paralelo).
- Doc-fonte § 15.4 (`sequence` para ignorar respostas antigas), § 17.1 (módulos
  `infrastructure/api` e `infrastructure/websocket`), § 17.2 (`connectionStatus`,
  `evaluationResult`) e § 17.3 (React não manipula `Object3D`).
- ADR-005 (componentes React não importam `three`), ADR-010 (WebSocket para o ciclo interativo;
  debounce/throttle e `sequence` como mitigação), ADR-015 (marca provisória na UI).
- RN-008: o valor que vale é o do backend; o painel de geometria do frontend continua como
  pré-visualização. PEND-004: sem níveis de alerta.
- Tarefas paralelas da leva B (TASK-029/030/031) só tocam `backend/`; esta só toca `frontend/`.

## 3. Critérios de aceite

- [x] **CA-1** — Dado o cliente REST com `fetch` falso, quando ele avalia um estado, então envia
  `POST /api/v1/evaluations` com os campos do backend (`configuration_id`, `boom_length_m`, ...,
  `load_weight_kg`) e mapeia a resposta 200 (`EVALUATED` e `NOT_EVALUABLE`) para o resultado da
  tela; 422/500/falha de rede viram erro com mensagem.
- [x] **CA-2** — Dado o cliente WebSocket com `WebSocket` falso, quando o estado muda, então envia
  `simulation.state.changed` com `sequence` crescente e mapeia `simulation.evaluated` e
  `simulation.error`; mensagem de servidor inválida vira erro, sem derrubar a sessão.
- [x] **CA-3** — Dada uma resposta com `sequence` menor ou igual à última aplicada, quando ela
  chega, então é descartada (doc-fonte § 15.4).
- [x] **CA-4** — Dada a conexão caindo sem ter sido fechada pelo cliente, então o estado passa a
  `reconnecting`, uma nova conexão é aberta depois de um intervalo e, ao reabrir, o último estado é
  reenviado; `connectionStatus` segue `connecting` → `connected` → `reconnecting` → ... (§ 17.2).
- [x] **CA-5** — Dadas várias mudanças seguidas, quando elas chegam em menos que o intervalo de
  debounce, então só o último estado é enviado (com espera máxima durante mudanças contínuas).
- [x] **CA-6** — A tela tem campos de configuração (`configuration_id`, texto) e peso da carga, e um
  painel com: resultado (avaliado / não avaliável com os motivos), capacidade, utilização, ponto
  tabelado usado, estado da conexão, erro, e a marca "PROVISÓRIO — consulta conservadora
  (ADR-015)"; sem níveis de alerta (PEND-004).
- [x] **CA-7** — O painel de geometria do frontend continua, rotulado como pré-visualização; os
  componentes React não importam `three` (lint).
- [x] **CA-8** — `vite.config.ts` encaminha `/api` (inclusive WebSocket) para
  `http://localhost:8000` no servidor de desenvolvimento.
- [x] **CA-9** — Sem dependência nova; `npm ci`, `lint`, `format:check`, `typecheck`, `test`,
  `build` e `bash scripts/check-structure.sh` passam; nenhum teste existente quebra.

## 4. Escopo

### Dentro do escopo

- Tipos TypeScript espelhando os schemas do backend (REST e WebSocket) e o mapeamento para um
  resultado único da tela.
- Clientes REST e WebSocket em `frontend/src/infrastructure/`, sessão de avaliação (debounce,
  `sequence`, reconexão, escolha do transporte) em `frontend/src/application/`.
- Painéis React e composição em `App.tsx`; proxy no `vite.config.ts`.
- Testes Vitest com `fetch`/`WebSocket` falsos.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Qualquer arquivo em `backend/`, `docs/`, `README.md`, `handoffs/current.md`.
- Seleção de guindaste/configuração por lista (depende dos cadastros REST da TASK-030).
- Níveis de alerta, cores de risco ou textos legíveis para os motivos (PEND-004; doc-fonte § 26,
  pergunta 9).
- Aplicar na cena 3D a geometria do backend (a cena continua com a PoC FICTÍCIA).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/domain/evaluation/*` | criar | sim |
| `frontend/src/infrastructure/api/*`, `frontend/src/infrastructure/websocket/*` | criar | sim |
| `frontend/src/application/evaluation/*` | criar | sim |
| `frontend/src/presentation/panels/*Evaluation*` | criar | sim |
| `frontend/src/app/App.tsx`, `App.css`, `useEvaluationSession.ts` | alterar / criar | sim |
| `frontend/vite.config.ts` | alterar | sim |
| `frontend/tests/**` | criar | sim |

## 6. Riscos e dependências

- O WebSocket só existe na API composta depois da TASK-029; até lá a sessão cai no REST (§ 8).
- A composição atual do backend responde "não avaliável" para qualquer configuração (sem banco).

## 7. Teste manual (se houver)

Ver `handoffs/TASK-032.md` § 11.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Tipos do domínio e dos contratos; mapeamento | `domain/evaluation`, `infrastructure/*` | testes de mapeamento | [x] |
| 2 | Cliente REST e cliente WebSocket com reconexão | `infrastructure/*` | testes com falsos | [x] |
| 3 | Sessão: debounce, `sequence`, transporte | `application/evaluation` | testes com timers falsos | [x] |
| 4 | Painéis, hook e `App.tsx`; proxy do Vite | `presentation`, `app`, `vite.config.ts` | lint, build, teste de render | [x] |

**Decisões:** ver `handoffs/TASK-032.md` § 5.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| mapeia respostas REST e erros HTTP/rede | CA-1 | unitário | `tests/infrastructure/api/evaluationRestClient.test.ts` | verde |
| valida e mapeia mensagens do WebSocket | CA-2 | unitário | `tests/infrastructure/websocket/evaluationMessages.test.ts` | verde |
| reconexão e estado da conexão | CA-4 | unitário | `tests/infrastructure/websocket/evaluationSocket.test.ts` | verde |
| debounce com espera máxima | CA-5 | unitário | `tests/application/evaluation/debounce.test.ts` | verde |
| sequence antiga descartada, erro exibido, reenvio ao reconectar, REST sem WebSocket | CA-2..CA-5 | unitário | `tests/application/evaluation/EvaluationSession.test.ts` | verde |
| painel mostra resultado, motivos, marca provisória e erro | CA-6 | render estático | `tests/presentation/panels/BackendEvaluationPanel.test.ts` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** —

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
