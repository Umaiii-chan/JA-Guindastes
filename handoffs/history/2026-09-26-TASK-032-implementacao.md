# Handoff — TASK-032 — implementação (avaliação do backend na cena)

> **Tarefas em paralelo (leva B):** este handoff fica em `handoffs/TASK-032.md` e
> `handoffs/current.md` **não** foi editado. TASK-029/030/031 só tocam `backend/`; esta só `frontend/`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 17:40 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-032-avaliacao-na-cena.md` |
| **Etapa concluída** | implementação (com testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-032-avaliacao-na-cena` @ `4339cff` (antes do commit deste handoff), a partir de `e5a8945` |
| **Duração aproximada** | ~1 h |

---

## 1. Objetivo desta etapa

Levar a avaliação do backend (REST da TASK-024 e WebSocket da TASK-025) para a tela: a cada
mudança dos sliders, da configuração ou da carga, enviar o estado e mostrar o resultado oficial com
a marca "PROVISÓRIO — consulta conservadora (ADR-015)" e o estado da conexão.

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-032-avaliacao-na-cena e5a8945` e conferi com
  `git log -1` (`e5a8945 chore(tasks): mover TASK-020 a 028 para completed e abrir a leva B`).
- **Domínio** `frontend/src/domain/evaluation/evaluation.ts`: `EvaluationInput`, `EvaluationResult`
  (`EVALUATED` | `NOT_EVALUABLE`), `EvaluationCapacity`, `EvaluationReason`, `ConnectionStatus`
  (`idle | connecting | connected | reconnecting | closed`, doc-fonte § 17.2), `EvaluationError`.
- **Infraestrutura** (doc-fonte § 17.1):
  - `infrastructure/api/evaluationContract.ts`: tipos que espelham `EvaluationRequest`/`EvaluationResponse`
    de `backend/app/presentation/api/evaluation_schemas.py`;
  - `infrastructure/api/evaluationRestClient.ts`: `POST /api/v1/evaluations` com `fetch` injetável;
    200 → resultado; 422 → `INVALID_REQUEST` (com o 1º `detail` do FastAPI); outro HTTP →
    `HTTP_ERROR`; rede → `NETWORK_ERROR`; fora do contrato → `INVALID_RESPONSE`;
  - `infrastructure/websocket/evaluationMessages.ts`: tipos que espelham
    `backend/app/presentation/websocket/evaluation_messages.py`, `toStateChangedMessage` e
    `parseServerMessage` (nunca lança: mensagem fora do contrato vira `INVALID_SERVER_MESSAGE`);
  - `infrastructure/websocket/evaluationSocket.ts`: `EvaluationSocket` (WebSocket injetável) com
    reconexão simples (intervalo fixo, sem limite de tentativas) e `evaluationWebSocketUrl`
    (mesma origem, `ws:`/`wss:`);
  - `infrastructure/shared/readJson.ts`: leitura defensiva do JSON do backend.
- **Aplicação** `frontend/src/application/evaluation/`: `EvaluationSession` (debounce, `sequence`
  crescente, descarte de respostas antigas, escolha do transporte, reenvio ao reconectar),
  `debounce.ts` (debounce com espera máxima) e `ports.ts`.
- **Apresentação**: `presentation/panels/EvaluationInputPanel.tsx` (configuration_id em texto e
  peso da carga) e `presentation/panels/BackendEvaluationPanel.tsx` (marca provisória, conexão,
  "atualizando…", avaliado / não avaliável com os motivos, capacidade, utilização, raio do backend,
  raio consultado, ponto tabelado usado, estratégia, tabela e versão, erro em `role="alert"`). Sem
  nível de alerta. Nenhum componente importa `three` (lint passou).
- **Composição**: `app/useEvaluationSession.ts` (WebSocket e `fetch` reais, `useSyncExternalStore`),
  `app/evaluationInput.ts` (monta o envio a partir do estado aplicado na cena e dos campos), e
  `App.tsx` ligando tudo; o painel de geometria do frontend continua, com o rótulo
  "pré-visualização — frontend". Estilos em `App.css`.
- **Proxy** em `frontend/vite.config.ts`: `/api` → `http://localhost:8000`, `ws: true`.
- **Testes** (58 novos, Vitest, `fetch`/`WebSocket` falsos, timers falsos; dados FICTÍCIOS):
  `tests/infrastructure/api/evaluationRestClient.test.ts`,
  `tests/infrastructure/websocket/evaluationMessages.test.ts`,
  `tests/infrastructure/websocket/evaluationSocket.test.ts`,
  `tests/application/evaluation/debounce.test.ts`,
  `tests/application/evaluation/EvaluationSession.test.ts`,
  `tests/presentation/panels/BackendEvaluationPanel.test.ts` (render estático com
  `react-dom/server`, já dependência), `tests/app/evaluationInput.test.ts`; helpers em
  `tests/helpers/fakeWebSocket.ts` e `tests/fixtures/evaluationResponses.ts`.
- **Mutação manual** (alterei o código, rodei, restaurei com `git checkout`):
  - sem o descarte por `sequence` em `EvaluationSession.apply` → `4 failed | 16 passed`;
  - sem a reconexão no `onclose` do `EvaluationSocket` → `4 failed | 213 passed | 1 skipped`.
- **Conferência manual** com backend (`uv run uvicorn app.main:app --port 8000`) e `vite` locais,
  ambos encerrados no fim: `curl -X POST http://localhost:5173/api/v1/evaluations ...` pelo proxy →
  `{"status":"NOT_EVALUABLE",...,"reasons":[{"code":"CRANE_GEOMETRY_NOT_FOUND",...},...]}`; no
  navegador, ao preencher `CFG-FICTICIA` e `1500`, o painel mostrou "Não avaliável" com os dois
  motivos, "Recebida por REST" e "reconectando… (avaliação por REST enquanto isso)". O log do
  uvicorn mostrou `"WebSocket /api/v1/ws/evaluation" 403` a cada ~2 s: o proxy WebSocket chega ao
  backend, mas a rota ainda não está registrada em `create_app` (é da TASK-029). Digitar "1500"
  gerou **uma** chamada REST (debounce).

## 3. Arquivos modificados

`git diff --stat e5a8945...HEAD` antes do commit deste handoff:

```text
 frontend/src/app/App.css                           | 124 ++++++++
 frontend/src/app/App.tsx                           |  51 ++-
 frontend/src/app/evaluationInput.ts                |  38 +++
 frontend/src/app/useEvaluationSession.ts           |  39 +++
 .../application/evaluation/EvaluationSession.ts    | 222 +++++++++++++
 frontend/src/application/evaluation/debounce.ts    |  53 ++++
 frontend/src/application/evaluation/ports.ts       |  37 +++
 frontend/src/domain/evaluation/evaluation.ts       |  84 +++++
 .../src/infrastructure/api/evaluationContract.ts   |  75 +++++
 .../src/infrastructure/api/evaluationRestClient.ts | 168 ++++++++++
 frontend/src/infrastructure/shared/readJson.ts     |  62 ++++
 .../infrastructure/websocket/evaluationMessages.ts | 212 +++++++++++++
 .../infrastructure/websocket/evaluationSocket.ts   | 153 +++++++++
 .../presentation/panels/BackendEvaluationPanel.tsx | 173 +++++++++++
 .../presentation/panels/EvaluationInputPanel.tsx   |  54 ++++
 frontend/tests/app/evaluationInput.test.ts         |  41 +++
 .../evaluation/EvaluationSession.test.ts           | 345 +++++++++++++++++++++
 .../tests/application/evaluation/debounce.test.ts  |  64 ++++
 frontend/tests/fixtures/evaluationResponses.ts     | 114 +++++++
 frontend/tests/helpers/fakeWebSocket.ts            |  76 +++++
 .../api/evaluationRestClient.test.ts               | 145 +++++++++
 .../websocket/evaluationMessages.test.ts           |  99 ++++++
 .../websocket/evaluationSocket.test.ts             | 151 +++++++++
 .../panels/BackendEvaluationPanel.test.ts          |  92 ++++++
 frontend/vite.config.ts                            |   8 +
 tasks/in-progress/TASK-032-avaliacao-na-cena.md    | 137 ++++++++
 26 files changed, 2814 insertions(+), 3 deletions(-)
```

Mais este handoff. Fora do escopo: nenhum. Nada em `backend/`, `docs/`, `README.md` nem
`handoffs/current.md`. Nenhuma dependência nova (`package.json`/`package-lock.json` intactos).

## 4. Comandos executados e resultados

Em `frontend/`, com o código final (`4339cff`), exceto o `check-structure.sh` (raiz).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ passou | instalou sem erro |
| `npm run lint` | ✅ passou | `eslint .` sem saída |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b` sem saída |
| `npm test` | ✅ passou | `Test Files 18 passed (18)` · `Tests 217 passed \| 1 skipped (218)` (58 novos) |
| `npm run build` | ✅ passou | `✓ built in 455ms`; aviso de chunk > 500 kB (Three.js, já existia) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)`; `✓ 5 commit(s) desta branch sem co-autoria de IA` |

## 5. Decisões tomadas

- **WebSocket preferencial, REST quando ele não está aberto.** ADR-010 põe o ciclo interativo no
  WebSocket; mas a API composta ainda não registra a rota (TASK-029), e sem fallback a tela ficaria
  sem valor do backend. Com o WebSocket fechado/reconectando, cada envio vai por
  `POST /api/v1/evaluations`; ao cair com resposta pendente, o último estado vai por REST; ao
  reconectar, é reenviado pelo WebSocket. Decisão técnica de frontend, **a confirmar** (§ 8, 1).
- **`sequence` único por sessão, nos dois transportes**, crescente e sem voltar ao reconectar.
  Resposta com `sequence` ≤ a última aplicada, ou maior que o último enviado, é descartada. Uma
  resposta intermediária mais nova que a mostrada é aplicada (o painel segue "atualizando…").
- **Erro limpa o resultado**: um resultado antigo não pode parecer ser do estado atual. Erro sem
  `sequence` (`simulation.error` com `null`) ou mensagem fora do contrato é mostrado direto.
- **Debounce com espera máxima: 150 ms / 400 ms; reconexão a cada 2 s** — **PROVISÓRIOS**, valores
  técnicos sem requisito (RNF-003 sem meta). Constantes `DEFAULT_DEBOUNCE` e
  `DEFAULT_RECONNECT_DELAY_MS`.
- **Resultado único para a tela** a partir dos dois contratos, que diferem no backend: REST usa
  `status`, motivos `{code, category}` e `queried_working_radius_m`; WebSocket usa
  `payload.result`, motivos só código e `queried_radius_m`. `category` fica `null` no WebSocket.
- **Validação só de forma no navegador** (`app/evaluationInput.ts`): configuração não vazia e carga
  finita ≥ 0, como o backend exige; faixas do guindaste ficam com o backend (RN-008). Sem entrada
  válida, a sessão limpa o resultado e descarta respostas em voo; o painel diz o que falta.
- **Campos iniciam vazios** (sem `configuration_id` nem carga inventados).
- **Marca provisória sempre visível no painel**, não só quando `strategy` é
  `CONSERVATIVE_PROVISIONAL`: a composição do backend usa só a consulta conservadora (ADR-015) até
  PEND-001/003. A linha "Estratégia" mostra o que veio (ou "não informada pelo backend").
- **Motivos mostrados como códigos** (texto legível pendente: doc-fonte § 26, pergunta 9).
- **Utilização exibida com 2 casas** e capacidade sem casas (formatação pt-BR); o backend não
  arredonda (PEND-002) — § 8, 3.
- **Camadas**: `presentation` recebe dados por props e não importa `infrastructure`; a composição
  (transportes reais) fica em `app/`; `infrastructure` depende das portas de `application`.
- Sem ADR novo: segue ADR-005, ADR-010 e ADR-015.

## 6. Regras de negócio aplicadas

- RN-007 — "não avaliável" com os motivos no painel (`BackendEvaluationPanel.test.ts`,
  `EvaluationSession.test.ts` › "mostra não avaliável com os motivos").
- RN-008 — valor mostrado é o do backend; painel de geometria do frontend segue como
  pré-visualização; faixas não validadas no navegador.
- ADR-015 — marca "PROVISÓRIO — consulta conservadora (ADR-015)", raio consultado e ponto usado.
- PEND-004 — sem níveis de alerta (teste "não mostra nível de alerta", com 150 %).
- `docs/business-rules.md` não foi alterado.

## 7. O que NÃO foi feito e por quê

- **Documentação** (`docs/`, `README.md`, `handoffs/current.md`): fora dos arquivos permitidos
  nesta leva; lista em § 10.
- **Lista de configurações** (seleção por cadastro): depende da TASK-030.
- **Geometria do backend aplicada na cena 3D**: fora do escopo; a cena segue com a PoC FICTÍCIA,
  cujos limites dos sliders não são os da ficha técnica do backend.
- **Teste do WebSocket real ponta a ponta**: a rota não está registrada na API composta (TASK-029);
  só confirmei que o proxy chega ao backend (403 do uvicorn).
- Push e PR: não feitos (instrução da leva).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Confirma o fallback para REST quando o WebSocket não está aberto (§ 5)? A alternativa é só WebSocket, sem valor do backend enquanto ele estiver fora. | não | | |
| 2 | Valores de debounce (150/400 ms) e de reconexão (2 s, sem limite, sem backoff) servem até RNF-003 ter meta? | não | | |
| 3 | Exibir utilização com 2 casas decimais e capacidade sem casas é aceitável enquanto PEND-002 (arredondamento) não é respondida? | não | | |
| 4 | Os contratos REST e WebSocket diferem em nomes (`status`/`result`, `queried_working_radius_m`/`queried_radius_m`, motivos com/sem categoria). Alinhar no backend (pendência 4 da TASK-025)? O frontend trata os dois. | não | | |
| 5 | Os limites dos sliders são os FICTÍCIOS da PoC; o backend valida com a ficha técnica. Quando houver cadastros (TASK-030), os limites da cena devem vir da ficha técnica da configuração? | não | | |

## 9. ⚠️ Segurança

- Nada a relatar. Sem segredos; chamadas na mesma origem; nada é gravado no navegador.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois a pessoa responsável.

**O que fazer, concretamente:**
1. Revisar `git diff e5a8945...task/TASK-032-avaliacao-na-cena` com
   `docs/templates/code-review-template.md`, começando por
   `frontend/src/application/evaluation/EvaluationSession.ts` (regras de `sequence` e transporte).
2. Depois do merge da TASK-029 (WebSocket em `create_app`), repetir o teste manual (§ 11) e
   conferir "conectada (WebSocket)" e "Recebida por WebSocket".
3. Mudanças de documentação **necessárias** que não fiz:
   - `docs/architecture.md`: frontend ganhou `domain/evaluation`, `application/evaluation`,
     `infrastructure/api`, `infrastructure/websocket`; a tela consome `POST /api/v1/evaluations` e
     `/api/v1/ws/evaluation` (WebSocket preferencial, REST de reserva); proxy `/api` no Vite.
   - `docs/development-guide.md`: para ver a avaliação em dev, subir o backend na porta 8000
     (`uv run uvicorn app.main:app`) e o frontend com `npm run dev` (proxy `/api` com WebSocket).
   - `docs/known-gaps.md`: debounce/reconexão com valores provisórios; configuração digitada em
     texto; sliders com limites FICTÍCIOS diferentes da ficha técnica do backend.
   - `docs/requirements/functional.md` / `non-functional.md`: RF-015..RF-020 e RNF-003 com a
     avaliação ligada na tela, se a coluna de status acompanhar a implementação.
   - `README.md`: mencionar que a tela mostra a avaliação do backend (provisória, ADR-015).
   - `handoffs/current.md`: registrar a TASK-032 e o § 8 acima.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-032-avaliacao-na-cena.md` §§ 3 e 9
4. `frontend/src/application/evaluation/EvaluationSession.ts`
5. `frontend/src/infrastructure/websocket/evaluationSocket.ts`

**Cuidado com:**
- `App.tsx` usa `eslint-disable-next-line react-hooks/exhaustive-deps` no efeito que chama
  `session.update`, para depender dos campos do estado, não do objeto recriado a cada render.
- Em `StrictMode` o efeito da sessão roda `start → stop → start`; a sessão aceita reiniciar.
- Sem backend na porta 8000, o painel mostra `NETWORK_ERROR`/`HTTP_ERROR` e a conexão fica
  "reconectando…" — esperado.

## 11. Como revisar este trabalho

**Teste manual:**
1. `backend/`: `uv sync --locked` e `uv run uvicorn app.main:app --port 8000`.
2. `frontend/`: `npm ci` e `npm run dev`; abrir `http://localhost:5173`.
3. Preencher "Configuração" (ex.: `CFG-FICTICIA`) e "Peso da carga" (ex.: `1500`); mexer nos sliders.
   **Esperado hoje (antes da TASK-029):** marca "PROVISÓRIO — consulta conservadora (ADR-015)",
   "Não avaliável" com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`, "Recebida por
   REST" e conexão "reconectando…". **Depois da TASK-029 com dados no banco:** "conectada
   (WebSocket)", capacidade, utilização e ponto tabelado usado.
4. Apagar a configuração: o painel pede a configuração e não envia nada.
5. Parar o backend: o painel mostra o erro de rede (`NETWORK_ERROR`).

- Tenho menos certeza sobre o fallback REST (§ 8, 1) e sobre a marca provisória sempre visível.
- O teste do painel é por HTML estático (sem jsdom/testing-library, para não adicionar
  dependência); interação com os campos não tem teste automatizado.
