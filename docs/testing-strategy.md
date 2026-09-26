# Estratégia de testes

> **Status deste documento:** preenchido na TASK-037 (2026-09-26) com o que existe em `development`
> @ `d58edf6`. Define o que é "testado" neste projeto. Um agente que disser "testei" sem seguir o que
> está aqui está alucinando.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037) |
| Framework de testes | backend: pytest; frontend: Vitest (ADR-012) |
| Comando principal | backend: `uv run pytest` (em `backend/`); frontend: `npm test` (em `frontend/`) — iguais aos de [`development-guide.md`](development-guide.md) § 3 |

---

## 1. Princípios

1. **Todo critério de aceite vira pelo menos um teste automatizado.** Se não dá para automatizar,
   o teste manual é descrito na tarefa com passos exatos e resultado esperado.
2. **Testes primeiro quando possível.** O Engenheiro de testes escreve os testes (falhando) antes do
   Implementador. Isso reduz a chance de a IA "implementar o que ela entendeu" em vez do que foi pedido.
3. **Saída real ou nada.** O handoff traz a saída resumida do comando de teste. "Passou" sem saída
   é considerado NÃO EXECUTADO.
4. **Teste quebrado não se apaga.** Se um teste existente quebrou, ou o código está errado ou o
   teste está errado — e descobrir qual é parte da tarefa. Registrar no handoff.
5. **Sem dados reais.** Fixtures usam dados sintéticos rotulados **FICTÍCIO** (no nome do arquivo,
   nas constantes e nos nomes dos testes) até a tabela oficial chegar (ADR-012; P-007). Veja
   [`policies/security.md`](policies/security.md).

---

## 2. Tipos de teste neste projeto

| Tipo | O que cobre | Onde ficam | Ferramenta | Comando | Roda no CI? |
|------|-------------|------------|------------|---------|-------------|
| Unitário (backend) | domínio (tabela de carga, geometria, consulta conservadora, carga), casos de uso com fakes das portas, parsers CSV/XLSX, storage local, mapeamento dos repositórios, config do banco | `backend/tests/domain/`, `application/`, `infrastructure/` | pytest | `uv run pytest` | sim (job `backend`) |
| API e WebSocket (backend) | routers com `TestClient` e fakes: códigos HTTP, schemas, limites de upload, 422 com números não finitos, mensagens do WebSocket (`TestClient.websocket_connect`), raiz de composição | `backend/tests/presentation/`, `backend/tests/test_composition.py` | pytest + `fastapi.testclient` | `uv run pytest tests/presentation` | sim |
| Integração com banco (backend) | migration (sobe, desce, sobe e `compare_metadata`), repositórios, importação e ativação, catálogo pelas rotas, composição com banco (REST e WS) | arquivos com marcador `integration` (ex.: `backend/tests/infrastructure/database/`, `infrastructure/repositories/*_integration.py`, `presentation/test_catalog_integration.py`, `test_composition_integration.py`) | pytest + PostgreSQL real | `uv run pytest -m integration` | sim, com PostgreSQL 18 de serviço e `REQUIRE_INTEGRATION_DB=1` (falham em vez de pular) |
| Unitário (frontend) | geometria de pré-visualização, `CraneController`, cena sem renderer, loader GLB e mapeamento cinemático sobre o GLB de exemplo FICTÍCIO, cliente REST, mensagens e reconexão do WebSocket (`fetch`/`WebSocket` falsos, timers falsos), `EvaluationSession`, debounce | `frontend/tests/` (espelha `src/`) | Vitest (ambiente `node`) | `npm test` | sim (job `quality`) |
| Componente React (frontend) | só render estático com `react-dom/server` (ex.: `BackendEvaluationPanel`); sem jsdom nem Testing Library | `frontend/tests/presentation/` | Vitest | `npm test` | sim |
| Paridade de geometria | os mesmos casos calculados à mão no backend e no frontend (ADR-013 C-7) | backend `tests/domain/test_geometry_service.py`; frontend `tests/fixtures/geometryParityCases.ts` (transcrição) | pytest e Vitest | os dois acima | sim |
| Contrato | OpenAPI gerado pelo FastAPI (rotas e schemas presentes) | `backend/tests/test_openapi.py`, `presentation/test_openapi_*.py` | pytest | `uv run pytest` | sim |
| Fumaça da stack Docker | build das imagens, `docker compose up --wait`, migrations no container, `/openapi.json`, `index.html` e proxy `/api/` pelo nginx | `.github/workflows/ci.yml` (job `docker`) | Docker Compose + curl | — (só no CI) | sim |
| Ponta a ponta (e2e) | fluxo completo pela interface | não existe em `d58edf6` (TASK-036 em andamento) | — | — | não |
| Manual | cena 3D no navegador, painel ligado ao backend, stack Docker local | descrito em cada tarefa (§ 7) | pessoa ou agente com navegador | — | não |

Os tipos TypeScript do frontend que espelham os contratos REST e WebSocket
(`frontend/src/infrastructure/api/evaluationContract.ts`, `infrastructure/websocket/evaluationMessages.ts`)
**não** são conferidos automaticamente contra os schemas do backend.

---

## 3. Cobertura

| Métrica | Mínimo | Como medir |
|---------|--------|------------|
| Cobertura de linhas (global) | A VALIDAR (não há ferramenta de cobertura configurada: nem `pytest-cov` nem `--coverage` no Vitest) | — |
| Cobertura em `backend/app/domain/` | A VALIDAR | — |
| Regras de negócio (`RN-*`) com teste | 100% | referência cruzada em `business-rules.md` (a coluna "Testes relacionados" é preenchida pela pessoa responsável; os handoffs indicam os testes) |

Cobertura é **piso**, não meta. Um teste que só aumenta cobertura sem verificar comportamento não é
aceito na revisão. Na falta de métrica, várias tarefas usaram **teste de mutação manual** (alterar o
código, ver os testes falharem, restaurar) e registraram o resultado no handoff (ex.: TASK-014, 015,
020, 025, 032).

---

## 4. Convenções

- Nome do arquivo de teste: backend `test_<modulo>.py`; frontend `<modulo>.test.ts`.
- Nome do teste descreve comportamento: backend em inglês (`test_<comportamento>`, com `ficticio`
  quando usa dado FICTÍCIO); frontend em português (`it('descarta resposta com sequence antiga ...')`).
- Estrutura interna: *Arrange → Act → Assert* (ou *Given → When → Then*).
- Um teste, uma asserção principal. Vários cenários → vários testes (ou parametrização).
- Testes que dependem de rede, horário ou aleatoriedade isolam essas dependências: `fetch` e
  `WebSocket` falsos (`frontend/tests/helpers/fakeWebSocket.ts`), timers falsos do Vitest, gerador de
  ids injetável nos casos de uso.
- Comparação de ponto flutuante com tolerância explícita (ex.: `TOLERANCE_M = 1e-9` na geometria;
  `expectClose` no frontend).
- Referenciar a regra de negócio no nome ou comentário quando houver: `# RN-004`.
- Testes de integração com banco:
  - usam `backend/tests/infrastructure/database/postgres_integration_support.py`: pulam sem
    `DATABASE_URL` ou sem banco, e falham com `REQUIRE_INTEGRATION_DB=1`;
  - testes de repositório rodam numa transação desfeita no fim (`join_transaction_mode="create_savepoint"`);
  - testes da composição (a app abre as próprias conexões) **commitam** dados com ids de sufixo
    único e apagam no `finally`; se a limpeza falhar, o teste da migration (que só desce com tabelas
    vazias) quebra.
- `app.main` monta a app na importação: com `DATABASE_URL` definida (como no CI), os testes que o
  importam usam a composição com banco, sem conectar até a primeira requisição.

---

## 5. Critérios mínimos para aprovação de uma tarefa

- [ ] todos os testes existentes continuam passando (`uv run pytest` e `npm test`);
- [ ] há teste novo para cada critério de aceite (ou teste manual descrito e executado);
- [ ] lint, formatação, tipos, camadas e build passam: o "comando único" de
      [`development-guide.md`](development-guide.md) § 3, igual aos jobs do CI;
- [ ] os jobs do CI (`structure`, `backend`, `quality`, `docker`) estão verdes no PR — testes de
      integração que não rodaram localmente precisam passar no CI;
- [ ] nenhum teste foi marcado como `skip`/`ignore` sem justificativa no handoff;
- [ ] saída do comando de teste está no handoff.

---

## 6. Dados de teste

| Tipo de dado | Fonte | Observação |
|--------------|-------|------------|
| Fixtures | `backend/tests/fixtures/` (tabelas, fichas técnicas, catálogo, CSVs em `load_chart_csv/`) e `frontend/tests/fixtures/` | sintéticos, rotulados FICTÍCIO, versionados; planilhas XLSX geradas em memória pelo openpyxl (nenhum binário) |
| Modelo 3D | `assets/example-models/guindaste-provisorio.ficticio.glb` | exportado do guindaste provisório; o teste confere que está em dia (regeneração em `development-guide.md` § 3) |
| Banco de teste | PostgreSQL 18: local via `docker compose up -d postgres`; no CI, serviço do job `backend` | migrations em `head` antes dos testes; transação desfeita ou limpeza no `finally` |
| Segredos de teste | variáveis do próprio workflow do CI (credenciais descartáveis do container, não são segredo) | nunca credencial real no repositório |

---

## 7. O que ainda não é testado

Também em [`known-gaps.md`](known-gaps.md) § 6.

- Testes ponta a ponta pela interface (TASK-036 em andamento em `d58edf6`).
- Componentes React com interação (exigiriam jsdom/Testing Library, dependências não autorizadas); a cena WebGL real (`mountCraneScene`) e o viewport são verificados só manualmente.
- Integração com banco na máquina de desenvolvimento: só no CI (L-005).
- WebSocket contra um servidor uvicorn real e pelo proxy do nginx (o job `docker` testa o proxy só com REST).
- Casos de paridade backend × frontend num arquivo único (hoje transcritos; known-gaps D-004).
- Conferência automática dos tipos do frontend contra os schemas REST/WebSocket do backend.
- Usabilidade da interface 3D e desempenho interativo (RNF-003 sem meta).
- Cálculos contra a tabela oficial (golden tests): não há tabela oficial (L-002).
- Cobertura de código não é medida (sem ferramenta configurada).
