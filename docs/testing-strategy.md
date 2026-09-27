# Estratégia de testes

> **Status deste documento:** preenchido na TASK-037 (2026-09-26) com o que existe com a leva C
> (TASK-033..036) integrada e atualizado na TASK-045 com a leva D (TASK-038..043). Define o que é "testado" neste projeto. Um agente que disser "testei" sem seguir o que
> está aqui está alucinando.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-045) |
| Framework de testes | backend: pytest; frontend: Vitest (ADR-012), com jsdom e Testing Library nos testes de componente (TASK-039); ponta a ponta: Playwright com Chromium (TASK-036) |
| Comando principal | backend: `uv run pytest` (em `backend/`); frontend: `npm test` (em `frontend/`); E2E: `npm run e2e` (em `frontend/`) — iguais aos de [`development-guide.md`](development-guide.md) § 3 |

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
| Unitário (backend) | domínio (tabela de carga, geometria, consulta conservadora, carga, usuário), casos de uso com fakes das portas (inclusive login, logout, sessão atual e gestão de usuários), parsers CSV/XLSX, storage local, hash Argon2id e limite de tentativas, mapeamento dos repositórios, config do banco, comando `create_admin` sem banco | `backend/tests/domain/`, `application/`, `infrastructure/` | pytest | `uv run pytest` | sim (job `backend`) |
| API e WebSocket (backend) | routers com `TestClient` e fakes: códigos HTTP, schemas, limites de upload, 422 com números não finitos, mensagens do WebSocket (`TestClient.websocket_connect`), raiz de composição; login, logout e usuários (401, 403, 409, 422 sem repetir a senha); **matriz de autorização** de todas as rotas e do WebSocket (sem sessão, Operador, Admin, CSRF, 4401/4403) | `backend/tests/presentation/` (`test_auth.py`, `test_users.py`, `test_route_authorization.py`), `backend/tests/test_composition.py` | pytest + `fastapi.testclient` | `uv run pytest tests/presentation` | sim |
| Integração com banco (backend) | migrations (sobem, descem, sobem e `compare_metadata`), repositórios (inclusive usuários e sessões), importação e ativação, catálogo pelas rotas, composição com banco e login (REST e WS), fluxo de autenticação, `create_admin`, e a corrida de dois admins rebaixando um ao outro (sobra um admin ativo) | arquivos com marcador `integration` (ex.: `backend/tests/infrastructure/database/`, `infrastructure/repositories/*_integration.py`, `presentation/test_catalog_integration.py`, `test_composition_integration.py`, `test_auth_integration.py`, `test_create_admin_integration.py`) | pytest + PostgreSQL real | `uv run pytest -m integration` | sim, com PostgreSQL 18 de serviço e `REQUIRE_INTEGRATION_DB=1` (falham em vez de pular) |
| Unitário (frontend) | geometria de pré-visualização, `CraneController`, cena sem renderer (ambiente, anel de raio, carga, paleta, predefinições e transição de câmera, limites da câmera), loader GLB e mapeamento cinemático sobre o GLB de exemplo FICTÍCIO e sobre o modelo do caminhão (hierarquia, calibração com a ficha de demo, P/T/G e gancho em 5 estados, cilindro, SHA-256 do GLB), clientes REST (inclusive `apiFetch`, sessão e usuários), mensagens e reconexão do WebSocket (`fetch`/`WebSocket` falsos, timers falsos), `EvaluationSession`, debounce, passos do simulador, situação da avaliação, permissões por perfil, matriz e versões de tabela, árvore do catálogo | `frontend/tests/` (espelha `src/`) | Vitest (ambiente `node`) | `npm test` | sim (job `quality`) |
| Componente React (frontend) | interação real em jsdom com Testing Library (TASK-039): componentes do design system (foco preso em Dialog/Drawer, Esc, setas em Tabs, medidor), casca e rotas com `fetch` falso, login, guardas e sessão expirada (`authFlow.test.tsx`), páginas Usuários, Catálogo e Tabelas (inclusive somente leitura), painéis do simulador. Cada arquivo `.test.tsx` declara `// @vitest-environment jsdom`; o backend de login falso é `tests/helpers/fakeAuthBackend.ts` (contas FICTÍCIAS). Alguns testes antigos seguem com render estático (`react-dom/server`) | `frontend/tests/presentation/`, `frontend/tests/app/` | Vitest + jsdom + Testing Library | `npm test` | sim |
| Paridade de geometria | os mesmos casos calculados à mão no backend e no frontend (ADR-013 C-7) | backend `tests/domain/test_geometry_service.py`; frontend `tests/fixtures/geometryParityCases.ts` (transcrição) | pytest e Vitest | os dois acima | sim |
| Contrato | OpenAPI gerado pelo FastAPI (rotas e schemas presentes) | `backend/tests/test_openapi.py`, `presentation/test_openapi_*.py` | pytest | `uv run pytest` | sim |
| Fumaça da stack Docker | build das imagens, `docker compose up --wait`, migrations no container, `/openapi.json`, `index.html` e proxy `/api/` pelo nginx (um `POST` com o cabeçalho CSRF e sem sessão tem de dar 401 do backend) | `.github/workflows/ci.yml` (job `docker`) | Docker Compose + curl | — (só no CI) | sim |
| Ponta a ponta (E2E) — sem backend | com o catálogo FICTÍCIO respondido no navegador (`catalogMock.ts`) e a aplicação no modo sem autenticação: o Início carrega com a casca, atalhos, resumo e avisos; o trilho navega pelas páginas e a rota desconhecida mostra "não encontrada"; a cena 3D aparece num `canvas` que ocupa o simulador (WebGL no SwiftShader, sem GPU); os passos liberam em sequência; inclinação e cabo mudam raio e alturas da pré-visualização; sem configuração, o resultado pede a configuração. Importação pela página Tabelas com as rotas respondidas no navegador (arrastar e soltar, matriz, importar, linha do tempo, Dialog de ativação) | `frontend/e2e/tests/scene.spec.ts`, `frontend/e2e/tests/loadChartImport.spec.ts` (bloco "no navegador") | Playwright (Chromium, 1 worker) | `npm run e2e` (sobe `vite preview`) | sim (job `e2e`) |
| Ponta a ponta (E2E) — com backend | entrando antes como o admin de E2E: o catálogo carrega do backend e, sem configuração escolhida, a avaliação não é enviada; com os dados semeados, os passos do simulador (configuração + carga válida) levam a "Avaliado" ou "Não avaliável", **nunca** por falta de ficha ou tabela ativa; importação pela página Tabelas contra a stack (validação, relatório de erros com linha e coluna, gravação e ativação do CSV FICTÍCIO v1) | `frontend/e2e/tests/evaluation.spec.ts`, `frontend/e2e/tests/loadChartImport.spec.ts` (bloco "com backend") | Playwright | `E2E_BASE_URL=... E2E_BACKEND=1 E2E_ADMIN_USERNAME=... E2E_ADMIN_PASSWORD=... npm run e2e` (+ `E2E_SEED_*` para o fluxo semeado) | sim: o job `e2e` sobe a stack Docker, migra, roda o seed da demo (`python -m app.demo_seed`) e passa `E2E_SEED_*` com os ids fixos `demo-ficticio-*`; sem essas variáveis, os testes são pulados |
| Ponta a ponta (E2E) — login e perfis (TASK-040) | com backend e banco: rota guardada leva ao login e volta ao destino; senha errada; "Sair" encerra a sessão; o admin cria um Operador pela página Usuários e o Operador não vê nem abre `/usuarios` (403 na API). Sempre: modo sem autenticação (sessão respondida no navegador) leva `/login` ao Início com o aviso | `frontend/e2e/tests/auth.spec.ts` (+ fixture de login em `auth.ts`, usado pelos demais specs) | Playwright | `E2E_BASE_URL=... E2E_BACKEND=1 E2E_ADMIN_USERNAME=... E2E_ADMIN_PASSWORD=... npm run e2e` | sim: o job `e2e` cria o admin `e2e-admin` e exporta `E2E_ADMIN_*`; sem backend ou sem essas variáveis, os testes de login são pulados |
| Seed da demonstração | idempotência, tabela `SUPERSEDED` não reativada, ficha existente não sobrescrita, ficha FICTÍCIA espelhando o guindaste provisório do frontend, valores esperados do roteiro de [`demo.md`](demo.md), mensagens de erro da linha de comando | `backend/tests/test_demo_seed.py` (sem banco), `backend/tests/test_demo_seed_integration.py` (marcador `integration`) | pytest | `uv run pytest` | sim (job `backend`) |
| Manual | cena 3D no navegador, interação com os painéis (cliques e digitação), stack Docker local, roteiro de [`demo.md`](demo.md) | descrito em cada tarefa (§ 7) | pessoa ou agente com navegador | — | não |

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

- Nome do arquivo de teste: backend `test_<modulo>.py`; frontend `<modulo>.test.ts`, ou
  `<modulo>.test.tsx` com `// @vitest-environment jsdom` na primeira linha quando renderiza e
  interage com React (o padrão do Vitest é `node`; `tests/setup.ts` desmonta o que a Testing Library montou depois de cada teste).
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
  importam usam a composição com banco, sem conectar até a primeira requisição. Por isso os testes
  que precisam da composição sem banco usam `compose_app({})` (TASK-038).
- Login nos testes do backend: dublês em memória em `backend/tests/fixtures/auth_ficticia.py` e
  `auth_api_ficticia.py`; com PostgreSQL, `auth_postgres_ficticia.py` cria usuários FICTÍCIOS e faz o
  login dos testes que passaram a exigir sessão. Os testes conferem que senha e token não aparecem em
  log, resposta nem mensagem de erro.
- Login no E2E: o fixture `page` de `frontend/e2e/tests/auth.ts` entra como o admin de E2E pela API
  (`page.request`, que divide os cookies com o navegador) quando `E2E_BACKEND=1` e há
  `E2E_ADMIN_*`; sem elas, os testes com backend são pulados. Só os specs do próprio login usam o
  formulário. O spec de senha errada usa um usuário inexistente, para não gastar o limite de
  tentativas do admin.

---

## 5. Critérios mínimos para aprovação de uma tarefa

- [ ] todos os testes existentes continuam passando (`uv run pytest` e `npm test`);
- [ ] há teste novo para cada critério de aceite (ou teste manual descrito e executado);
- [ ] lint, formatação, tipos, camadas e build passam: o "comando único" de
      [`development-guide.md`](development-guide.md) § 3, igual aos jobs do CI;
- [ ] os jobs do CI (`structure`, `backend`, `quality`, `docker`, `e2e`) estão verdes no PR — testes
      de integração e E2E contra a stack que não rodaram localmente precisam passar no CI (se o
      job `e2e` é obrigatório por branch protection está em aberto, TASK-036 § 8 item 3);
- [ ] mudança na tela: `npm run e2e` local (sem backend) passa, ou o job `e2e` passa no PR;
- [ ] nenhum teste foi marcado como `skip`/`ignore` sem justificativa no handoff;
- [ ] saída do comando de teste está no handoff.

---

## 6. Dados de teste

| Tipo de dado | Fonte | Observação |
|--------------|-------|------------|
| Fixtures | `backend/tests/fixtures/` (tabelas, fichas técnicas, catálogo, CSVs em `load_chart_csv/`) e `frontend/tests/fixtures/` | sintéticos, rotulados FICTÍCIO, versionados; planilhas XLSX geradas em memória pelo openpyxl (nenhum binário) |
| Modelo 3D | `assets/example-models/guindaste-provisorio.ficticio.glb` | exportado do guindaste provisório; o teste confere que está em dia (regeneração em `development-guide.md` § 3) |
| Banco de teste | PostgreSQL 18: local via `docker compose up -d postgres`; no CI, serviço do job `backend` | migrations em `head` antes dos testes; transação desfeita ou limpeza no `finally` |
| Dados do E2E | seed da demonstração (`backend/app/demo_seed.py`, CSVs em `backend/app/demo_data/`), rodado na stack Docker do job `e2e` | FICTÍCIOS; ids fixos `demo-ficticio-*`; a stack é derrubada com `--volumes` no fim |
| Contas de teste | backend: usuários FICTÍCIOS dos fixtures `auth_*`; frontend: contas FICTÍCIAS em memória (`fakeAuthBackend.ts`); E2E: admin `e2e-admin` criado no job `e2e`, e a senha do Operador criado no spec é gerada na hora | nenhuma senha real |
| Segredos de teste | variáveis do próprio workflow do CI (credenciais descartáveis do container e senha do admin de E2E `ci_only_admin_password_not_secret`, que não são segredo) | nunca credencial real no repositório |

---

## 7. O que ainda não é testado

Também em [`known-gaps.md`](known-gaps.md) § 6.

- E2E: não cobre cadastro do catálogo pela tela nem o WebSocket de forma explícita (o teste semeado aceita o resultado por qualquer transporte); os specs com backend (avaliação, login e perfis, importação pela tela) e o job `e2e` não foram executados localmente (Docker indisponível; TASK-036, 038, 040 e 042 § 7).
- A cena 3D não tem teste de imagem: anel, carga, cores, câmeras e o modelo do caminhão são conferidos por testes sem renderer e por capturas manuais (TASK-041, 043).
- Desempenho da cena: os 60 fps num notebook comum não foram medidos em hardware real (só SwiftShader; TASK-041 CA-6).
- Integração com banco na máquina de desenvolvimento: só no CI (L-005); inclui os testes de login, `create_admin` e a corrida do último admin (TASK-038).
- WebSocket contra um servidor uvicorn real e pelo proxy do nginx (o job `docker` testa o proxy só com REST).
- Casos de paridade backend × frontend num arquivo único (hoje transcritos; known-gaps D-004).
- Conferência automática dos tipos do frontend contra os schemas REST/WebSocket do backend.
- Usabilidade da interface 3D e desempenho interativo (RNF-003 sem meta).
- Cálculos contra a tabela oficial (golden tests): não há tabela oficial (L-002).
- Cobertura de código não é medida (sem ferramenta configurada).
