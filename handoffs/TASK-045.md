# Handoff — TASK-045 — implementação

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-045.md` e não edita
> `handoffs/current.md` (índice geral, atualizado pela sessão principal).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-045-documentacao-leva-d.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Implementador (mesma sessão; revisão independente não feita) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), subagente num worktree isolado, disparado pelo orquestrador |
| **Branch** | `task/TASK-045-documentacao-leva-d`, a partir de `2e7313b` |
| **Duração aproximada** | 1 h 30 min |

---

## 1. Objetivo desta etapa

Atualizar README e `docs/` para o estado de `development` com a leva D (TASK-038..043, PR #39)
integrada, sem tocar a lista de rotas da API em `docs/architecture.md` (TASK-044 em paralelo).

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-045-documentacao-leva-d 2e7313b`; `git log -1` →
  `2e7313b chore(tasks): fixar o contrato snake_case das rotas da TASK-044`.
- Li `AGENTS.md`, `handoffs/current.md`, os handoffs TASK-038..043, os ADR-016 e ADR-017, a tarefa
  TASK-044 e os documentos a atualizar. Conferi no código: `backend/app/create_admin.py`,
  `app/auth_composition.py`, a migration `7c2e9a4d1b36`, os módulos de `application/`,
  `infrastructure/security/`, `presentation/api/`, `.env.example`, `docker-compose.yml`, o job `e2e`
  e o teste de fumaça do CI, `frontend/package.json`, `vite.config.ts`, `tests/setup.ts`,
  `src/app/AppRoutes.tsx`, `src/app/auth/*`, `src/app/routes/*`, `SimulatorRoute.tsx`, a árvore de
  `frontend/src` e `frontend/tests`, os specs E2E, `scripts/convert-crane-model.mjs` e a origem das
  capturas (`git log` de `docs/assets/screenshots/`).
- `README.md`: estado com a leva D; stack (React Router, `lucide-react`, Argon2id); estrutura com
  `public/models/`, `scripts/`, `assets/source/` e capturas; `SESSION_COOKIE_SECURE=false` e
  `create_admin` nos dois caminhos; seção "Primeiro admin e login"; modo sem banco sem login; tabela
  de rotas com `/auth/*` e `/users*` e a regra de sessão, perfil e CSRF; seção "Capturas" (com o aviso
  de que as do Início e do simulador ainda mostram a cena anterior à TASK-041).
- `docs/architecture.md`: status; linhas novas no backend (domínio do usuário, aplicação de
  autenticação, infraestrutura de usuários e segurança, apresentação da autenticação, composição do
  login e `create_admin`); composição com e sem banco; frontend reescrito (domínio, aplicação,
  infraestrutura com `apiFetch`, design system, casca e páginas, composição, cena 3D com modelo GLB);
  tabela das rotas do **frontend** (React Router); build com o GLB e o script; § 3 com as regras das
  páginas; § 4 com o fluxo de autenticação (diagrama) e as rotas de login e usuários **nessa seção**;
  § 5 com `app_user` e `user_session`; § 6 e § 7 com autenticação, GLB servido e o job `e2e`; § 8 com
  ADR-016 e ADR-017; § 9 atualizado. **A linha "Apresentação — REST" da § 2 e o parágrafo de
  importação da § 4 não foram tocados.**
- `docs/development-guide.md`: status, stack, instalação com `SESSION_COOKIE_SECURE` e
  `create_admin`, comandos do primeiro admin (Docker e sem Docker), da conversão do modelo e dos
  testes jsdom, duas revisões do Alembic, estrutura de pastas da leva D, variáveis
  `SESSION_COOKIE_SECURE` e `ADMIN_PASSWORD`, oito linhas novas em "Solução de problemas".
- `docs/testing-strategy.md`: framework, tipos de teste (autenticação no backend, matriz de
  autorização, integração do login, cena e modelo no frontend, componentes em jsdom com Testing
  Library, E2E sem e com backend, importação pela página Tabelas), convenções (`.test.tsx` com
  `// @vitest-environment jsdom`, fixtures `auth_*`, login no E2E), dados de teste e lacunas.
- `docs/security.md` (sem reescrever as §§ 1–4 da TASK-038): linha "Frontend" na § 2, lista de
  limitações da autenticação, linha do login e GLB servido/licença na § 4, dependências da leva D na § 5.
- `docs/known-gaps.md`: L-003 movida para "Resolvidos"; L-002 atualizada; L-001, L-006 e L-007
  ajustadas; L-011 (rotas que faltaram na TASK-042, **em andamento (TASK-044)**) e L-012 (limites da
  cena e do modelo) novas; dívidas D-011 (limite de tentativas em memória), D-012 (`PATCH` de usuário
  com atualização perdida), D-013 (60 fps não medidos), D-014 (critério de "atenção", PEND-004) e
  D-015 (cores duplicadas em `palette.ts` e `tokens.css`); P-009 respondida em parte; P-018 e P-019
  novas; § 4.1, § 5 e § 6 atualizadas; P-005 (parte "carga = capacidade") em "Resolvidos".
- `docs/requirements/functional.md` e `non-functional.md`: nota da leva D e coluna "Tarefas" com
  TASK-039, 041, 042 e 043 (RF) e TASK-038, 041 e 043 (RNF), sem mudar texto nem status.
- `docs/project-overview.md`: perfis de acesso (§ 3), stack (§ 6) e modelo 3D ilustrativo (§ 7).

## 3. Arquivos modificados

```text
$ git diff --stat 2e7313b HEAD   (antes deste handoff)
 README.md                                         |  96 ++++++++++---
 docs/architecture.md                              | 159 +++++++++++++++++-----
 docs/development-guide.md                         |  81 +++++++----
 docs/known-gaps.md                                |  48 +++++--
 docs/project-overview.md                          |  13 +-
 docs/requirements/functional.md                   |  35 +++--
 docs/requirements/non-functional.md               |  15 +-
 docs/security.md                                  |  30 +++-
 docs/testing-strategy.md                          |  48 ++++---
 tasks/in-progress/TASK-045-documentacao-leva-d.md | 112 +++++++++++++++
 10 files changed, 491 insertions(+), 146 deletions(-)
```

Mais este handoff. Nenhum arquivo de código, CI, Docker, ADR, `handoffs/current.md`,
`docs/business-rules.md` ou `docs/demo.md` foi alterado.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `bash scripts/check-structure.sh` (raiz, antes de começar) | ✅ | `OK: 0 erros, 1 aviso(s)` (aviso: branch sem tarefa em `in-progress/`) |
| `bash scripts/check-structure.sh` (depois de cada documento) | ✅ | `✓ nenhum link interno quebrado` |
| `bash scripts/check-structure.sh` (final, com este handoff, antes do commit dele) | ✅ | `OK: 0 erros, 1 aviso(s)`; ver § 4.1 |

As edições foram feitas com um script Python de substituição exata (em `scratchpad/`, fora do
repositório), rodado por `uv run --no-sync python` em `backend/` porque o `python` do Windows é o
alias da Store. Isso criou `backend/.venv` (ignorado pelo Git).

### 4.1 check-structure (final)

```text
3. Tarefas
  ! há 2 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
  ✓ nenhum ID de tarefa duplicado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-045-documentacao-leva-d
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 11 commit(s) desta branch sem co-autoria de IA
OK: 0 erros, 1 aviso(s)
```

O aviso é o esperado: TASK-044 e TASK-045 em paralelo. Os arquivos em comum são só
`docs/architecture.md`, com a lista de rotas deixada para a TASK-044.

## 5. Decisões tomadas

- **Rotas de login e usuários fora da lista de rotas da arquitetura:** entraram na § 4 ("Fluxo de
  autenticação") e numa linha própria "Apresentação — autenticação" da § 2, e não na linha
  "Apresentação — REST", que a TASK-044 vai mudar. A TASK-044 pode, se quiser, citá-las na lista
  dela depois do merge.
- **Tabela de rotas do `README.md` atualizada** (auth e usuários). A TASK-044 só tem
  `docs/architecture.md` no escopo; as rotas novas dela (listagem e `PATCH` de cadastros) ainda não
  estão no README.
- **Rotas do frontend (React Router) na arquitetura:** são páginas, não a API; ficaram numa tabela
  própria depois dos componentes do frontend.
- **L-003 movida para "Resolvidos"** a pedido explícito do orquestrador (o cabeçalho do
  `known-gaps.md` diz que só a pessoa responsável remove itens). P-009 ficou aberta só no que sobrou
  (limite de taxa no WebSocket, CORS).
- **Rotas faltantes da TASK-042** registradas como L-011, "em andamento (TASK-044)", e citadas em
  L-006/L-007. O `/validate` com XLSX não está nos critérios da TASK-044 e ficou "sem tarefa".
- **Requisitos da leva D:** o campo "Requisitos" das TASK-038..043 cita o pedido em chat, não RFs. O
  mapeamento na coluna "Tarefas" é pelo que cada tarefa entregou, explicado na nota do topo. A
  TASK-038/040 não entrou em nenhum RF (autenticação é a doc-fonte § 8.4).
- **Capturas no README:** só as que existem; avisei que as do Início e do simulador são anteriores à
  TASK-041 (conferido no `git log`: último commit delas é o `12e0a61` da TASK-039).

## 6. Regras de negócio aplicadas

- Nenhuma regra nova. Citadas como estão: RN-003 (modelo não define cálculo), RN-008 (o backend
  decide), PEND-004 (sem critério de "atenção"), P-005 (100 % dentro do limite, decisão registrada
  pela TASK-039).

## 7. O que NÃO foi feito e por quê

- **Lista de rotas da API em `docs/architecture.md`:** fora do escopo (TASK-044).
- **`docs/demo.md`:** não estava na lista pedida. Ficou desatualizado em dois pontos da § 5: "se a
  tela de login já estiver disponível (TASK-040)" (já está) e "a cena 3D mostra o guindaste
  **provisório** (caixas e cilindros)" (hoje carrega o modelo do caminhão). Os passos seguintes
  também descrevem a tela antiga e não foram conferidos.
- **Capturas novas:** a tarefa é só texto. As do Início e do simulador com a cena nova continuam
  pendentes (TASK-039 § 10 item 4).
- **Gates de backend e frontend:** não rodados; nenhum código mudou.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Depois do merge da TASK-044: atualizar README (rotas novas), `known-gaps.md` (L-006, L-007 e L-011 para "Resolvidos"; tirar `knownChartsStorage` da § 2 da arquitetura), `testing-strategy.md` (spec de edição de cadastro) e requisitos (TASK-044 em RF-001/002/005/007)? | não | Sim: feito na segunda parte (§ 11) | 2026-09-26 |
| 2 | Atualizar `docs/demo.md` § 5 em diante para o login e as páginas da leva D (§ 7)? | não | Sim: feito na segunda parte (§ 11) | 2026-09-26 |
| 3 | P-018 (`409 OWN_ADMIN_ACCESS`) e P-019 (troca de senha revoga sessões?), vindas da TASK-038 | não | | |

## 9. ⚠️ Segurança

- nada a relatar. Nenhuma senha real: a senha de CI citada (`ci_only_admin_password_not_secret`) já
  estava no `ci.yml` e em `docs/security.md`, e é descartável.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável.

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-045-documentacao-leva-d` conferindo os fatos com o
   código (principalmente a § 2 e a § 4 de `docs/architecture.md` e o L-011 de `known-gaps.md`).
2. Mesclar antes ou depois da TASK-044. Se a TASK-044 mesclar antes, o conflito provável é só em
   `docs/architecture.md` (§ 2, linhas do frontend, se ela descrever o cliente REST ou o
   `knownChartsStorage`): manter as duas mudanças.
3. Depois da TASK-044, a atualização da pendência 1.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-045-documentacao-leva-d.md` § 3
4. `docs/architecture.md` §§ 2 e 4, `docs/known-gaps.md` §§ 1, 2 e 7

**Cuidado com:**
- Não mover L-011 para "Resolvidos" antes da TASK-044 estar em `development`. (Feito na segunda
  parte, § 11, sobre a integração `b44a46e` das duas tarefas, a pedido da sessão principal.)

## 11. Segunda parte: depois da TASK-044 (2026-09-26)

| Campo | Valor |
|-------|-------|
| **Pedido** | sessão principal, via orquestrador: fazer a pendência 1 e a 2, preencher a seção "Frontend" de `handoffs/TASK-044.md` e registrar a decisão sobre a ordem da linha do tempo |
| **Branch** | `task/TASK-045-pos-tarefa-044`, a partir de `b44a46e` (TASK-044 e TASK-045 integradas) |
| **Papel** | Implementador (só texto) |

- `README.md`: estado com a TASK-044; linhas de `PATCH` de cadastros e de
  `GET /configurations/{id}/load-charts` na tabela de rotas.
- `docs/architecture.md` e `docs/development-guide.md`: saiu o `knownChartsStorage` (o arquivo foi
  removido); entraram `listConfigurationCharts` e `update*` nos clientes, a tabela ativa e a edição
  nas páginas, e `catalogEdit.spec.ts` e `backendCatalog.ts` na estrutura. O status da arquitetura
  aponta para a lista de rotas da § 4.
- `docs/known-gaps.md`:
  - L-011 foi para "Resolvidos", com a TASK-044;
  - L-006 e L-007 **continuam** na § 1 com o que segue aberto (exclusão, unicidade de nomes,
    PEND-005; `INVALID`, relatório gravado, reativação). A parte resolvida pela TASK-044 foi para
    "Resolvidos" como "L-006 (parte)" e "L-007 (parte)", porque mover as linhas inteiras apagaria
    limitações que continuam;
  - o `/validate` com XLSX virou a L-013, sem tarefa;
  - a ordem da linha do tempo pela versão ficou registrada como **decisão tomada** pela pessoa
    responsável (P-020 em "Resolvidos"). Não haverá `created_at`;
  - § 5 e § 6 atualizadas.
- `docs/testing-strategy.md`: os specs com backend `catalogEdit.spec.ts` e `loadChartImport.spec.ts`
  (linha do tempo pela rota nova), `backendCatalog.ts` nos dados do E2E e a lacuna "criação de
  cadastro pela tela".
- `docs/requirements/functional.md`: TASK-044 em RF-001, 002, 005 e 007, com nota.
- `handoffs/TASK-044.md`: seção "Frontend" com as notas da sessão de frontend (clientes, Tabelas,
  Catálogo, E2E, decisões, gates informados e pendências) e a pendência 1 do backend respondida.
  Esses commits levam `(TASK-044)`.
- `docs/demo.md`: § 5 com o login pelo admin do `create_admin`, o simulador guiado (passos
  Guindaste, Carga e Posição, com os rótulos reais da tela) e o modelo do caminhão no lugar do
  guindaste provisório; os valores com a = −1,56 m já estavam lá e não mudaram. A mais, as §§ 6 e 7
  deixaram de dizer "se a tela já estiver disponível" e passaram a citar a página Tabelas.

**Comandos:** `bash scripts/check-structure.sh` → `OK: 0 erros, 1 aviso(s)` (aviso: 2 tarefas em
`in-progress/`), `✓ nenhum link interno quebrado`, `✓ 35 commit(s) desta branch sem co-autoria de IA`.
Os gates do frontend citados no handoff da TASK-044 são os informados pela sessão de frontend; não os
rodei de novo.
