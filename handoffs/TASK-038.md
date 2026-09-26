# Handoff — TASK-038 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-038-autenticacao-backend.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree isolada, disparado pelo orquestrador da leva D |
| **Branch** | `task/TASK-038-autenticacao-backend` @ commit deste handoff (base `0229d49`) |
| **Duração aproximada** | 2 h 30 (inclui o ajuste pedido pela pessoa responsável, § 11) |

---

## 1. Objetivo desta etapa

Login no backend conforme o ADR-016: usuários `ADMIN`/`OPERATOR`, sessão opaca em cookie `HttpOnly`,
CSRF por cabeçalho, autorização em todas as rotas e no WebSocket, gestão de usuários pela API e o
comando `python -m app.create_admin`. Sem banco, nada muda (ADR-016 § 5).

## 2. O que foi feito

- **Domínio:** `User` (id, username, display_name, role, active, created_at), `UserRole`,
  `normalize_username` (3–64 `[a-z0-9._-]`, minúsculas), `normalize_display_name` (obrigatório, sem
  espaços nas pontas), `validate_password` (10–128); erros `InvalidUserError` com o campo.
- **Aplicação:** portas `UserRepository`, `SessionRepository`, `PasswordHasher`,
  `LoginAttemptLimiter`; casos de uso `Login` (token `secrets.token_urlsafe(32)`, só o SHA-256
  gravado, 8 h absolutas, erro genérico, verificação contra hash descartável quando o usuário não
  existe, limite de tentativas, limpeza de sessões expiradas), `Logout` (idempotente),
  `GetCurrentUser`, `ManageUsers` (listar, criar, atualizar; proteção de "não se desativar/rebaixar";
  desativar revoga as sessões). O "último admin" é garantido pelo repositório (§ 11).
- **Infraestrutura:** modelos `app_user`/`user_session` e a migration nova `7c2e9a4d1b36` (a da
  TASK-022 não mudou); `SqlAlchemyUserRepository`, `SqlAlchemyUserSessionRepository` (sessão atual
  numa consulta com join); `Argon2PasswordHasher` (Argon2id, padrão do `argon2-cffi`);
  `InMemoryLoginAttemptLimiter` (5 falhas/15 min por username, thread-safe, por processo).
- **Apresentação:** `authorization.py` (cookie, `CsrfHeaderMiddleware`, `AuthGuards`, `ApiError`,
  checagem de origem do WebSocket), `auth.py` (`/api/v1/auth/session|login|logout`), `users.py`
  (`/api/v1/users`, `PATCH /api/v1/users/{id}`), `auth_schemas.py` (camelCase). `create_app(auth=...)`
  liga tudo; os routers de catálogo e de persistência de tabelas ganharam `write_dependencies`
  (ADMIN) e o WebSocket ganhou `connection_guard`. O 422 das rotas `/auth` e `/users` não repete a
  entrada (`input`), para nunca devolver a senha.
- **Composição:** `app/auth_composition.py` (`build_auth`, `SESSION_COOKIE_SECURE`), ligado em
  `create_database_app`; `app/create_admin.py` (senha por `ADMIN_PASSWORD` ou `getpass` duas vezes;
  idempotente, confere a existência antes de pedir a senha; exit 0/1/2 como o `demo_seed`).
- **Testes:** unitários de domínio, aplicação, adapters de segurança e API (dublês em memória em
  `tests/fixtures/auth_ficticia.py` e `auth_api_ficticia.py`); matriz de autorização de todas as rotas
  existentes e do WebSocket (`tests/presentation/test_route_authorization.py`); integração
  (`integration`) de repositórios, migration offline, composição com login, fluxo de autenticação e
  `create_admin` no PostgreSQL. Testes existentes que passaram a precisar de sessão ganharam login
  (`tests/fixtures/auth_postgres_ficticia.py`).
- **CI/Docker/docs:** job `e2e` cria o admin `e2e-admin` com `ADMIN_PASSWORD` só de CI e exporta
  `E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD`; `.env` do job com `SESSION_COOKIE_SECURE=false`;
  `docker-compose.yml` repassa `SESSION_COOKIE_SECURE` ao backend; `.env.example`, `docs/demo.md`
  (§ 3.1 Login, `curl` com cookie e cabeçalho, problemas comuns) e `docs/security.md` (§§ 1–4).

## 3. Arquivos modificados

```text
 56 files changed, 4483 insertions(+), 71 deletions(-)   (git diff --stat 0229d49, antes deste handoff)
```

Principais: `backend/app/{domain,application,infrastructure,presentation}/**` (ver § 2),
`backend/app/auth_composition.py`, `backend/app/create_admin.py`, `backend/app/main.py`,
`backend/alembic/versions/7c2e9a4d1b36_criar_usuarios_e_sessoes.py`, `backend/pyproject.toml`,
`backend/uv.lock`, `backend/tests/**`, `.github/workflows/ci.yml`, `docker-compose.yml`,
`.env.example`, `docs/demo.md`, `docs/security.md` (mais este handoff).

**Fora do escopo declarado, com motivo:**
- `docker-compose.yml`: repassar `SESSION_COOKIE_SECURE` ao container. Sem isso a stack em
  `http://127.0.0.1:8080` (demo e E2E) nunca receberia o cookie de volta (padrão `Secure`).
- Job `docker` do CI: o teste de fumaça fazia `POST /load-charts/validate` sem cabeçalho e esperava
  422; agora seria 403 (CSRF). Passou a mandar o cabeçalho e esperar **401** (prova que o proxy chega
  ao backend).

## 4. Comandos executados e resultados

Em `backend/`, no Windows (Git Bash), sem PostgreSQL nem Docker:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv add argon2-cffi` | ✅ | `argon2-cffi==25.1.0` (+ `argon2-cffi-bindings`, `cffi`, `pycparser`) |
| `uv sync --locked` | ✅ | `Checked 53 packages` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `189 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 107 source files` (também após o § 11) |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1019 passed, 52 skipped` (após o ajuste do § 11; os `integration` pulados: sem `DATABASE_URL`) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` (aviso já existente: 3 tarefas em `in-progress/`) |
| `python -m app.create_admin --username admin` sem `DATABASE_URL` | ✅ | `ERRO: defina DATABASE_URL...`, exit 2 |
| YAML de `ci.yml` e `docker-compose.yml` (`yaml.safe_load`) | ✅ | parse ok; passo do admin e `env` do job presentes |
| Testes `integration` novos e ajustados | ⚠️ NÃO EXECUTADO | sem PostgreSQL local; o job `backend` do CI roda com `REQUIRE_INTEGRATION_DB=1` |
| Jobs `docker` e `e2e` | ⚠️ NÃO EXECUTADO | sem Docker local |

## 5. Decisões tomadas

- **Corpo de erro:** `{"detail": "<mensagem>", "code": "<CÓDIGO>"}`. Mantém o `detail` em texto que
  a API já usa (e que o frontend já lê) e acrescenta o código do ADR-016 § 4 num campo próprio.
- **422 de validação** das regras de nome/senha: formato padrão do FastAPI,
  `{"detail":[{"loc":["body","<campo camelCase>"],"msg":...,"type":"value_error"}]}`, sem `input`.
- **Proteção do próprio admin** (se desativar ou se rebaixar): `409` com código
  **`OWN_ADMIN_ACCESS`**. O ADR-016 § 2 define a regra mas não o status; o § 4 só lista `LAST_ADMIN`
  para 409. Código adicional registrado aqui (ver § 8 item 1). 404 do PATCH usa `USER_NOT_FOUND`.
- **Origem do WebSocket:** compara o **nome do host** do `Origin` com o do `Host`, sem a porta. O
  nginx repassa `Host $host` (sem porta) e o Vite usa `changeOrigin: true` (troca a porta); comparar a
  porta fecharia a conexão nos dois. Sem `Origin` → 4403. O handshake é aceito e fechado em seguida
  com 4401/4403, porque fechar antes do aceite vira HTTP 403 sem código no navegador.
- **Ordem das checagens:** CSRF (middleware) antes de tudo; depois sessão (401); depois perfil (403);
  depois validação do corpo (422).
- **Sem banco:** só `GET /auth/session` é registrado (`authEnabled:false`); login, logout e
  `/users` não existem; CSRF não é exigido; rotas e WebSocket seguem abertos.
- **`/docs` e `/openapi.json`** continuam públicos: interpretei "toda outra rota" como as rotas da
  API em `/api/v1`, e o teste de fumaça do CI depende do `/openapi.json`.
- **Login com mais de 128 caracteres de senha ou 64 de username** falha como credencial inválida
  sem chegar ao banco/Argon2 (evita custo com entradas enormes); conta como falha no limite.
- **`displayName`:** obrigatório e aparado; sem limite de tamanho (o ADR não define).
- **Troca de senha não revoga sessões** (o ADR só manda revogar em logout e desativação).
- **Testes que usam a composição completa** (`test_load_charts_validate`) passaram a usar
  `compose_app({})`: `app.main:app` vira app com banco (e com login) no CI, onde `DATABASE_URL` existe.
- **Dependência nova:** `argon2-cffi` 25.1.0 (MIT, PyPI), exigida pelo ADR-016 § 3.

## 6. Regras de negócio aplicadas

- ADR-016 §§ 1–5 (perfis, contas, senhas e sessões, contrato, sem banco), implementado como está,
  com os complementos do § 5 acima. ADR-004 (camadas): `lint-imports` passa.
- ADR-012: nomes e senhas de teste FICTÍCIOS; a senha de CI é descartável e só existe no job.
- Regra **não documentada** inventada: nenhuma; interpretações listadas em § 5 e § 8.

## 7. O que NÃO foi feito e por quê

- Specs E2E e frontend: fora do escopo (TASK-040). **Os specs E2E existentes vão falhar** até a
  TASK-040 fazer login (risco previsto na tarefa).
- `README.md`, `docs/development-guide.md`, `docs/architecture.md`, `docs/known-gaps.md`, ADRs e
  `handoffs/current.md` não foram editados (fora do escopo; ver § 10).
- Limite de taxa de mensagens no WebSocket e revalidação da sessão durante a conexão: fora do ADR.
- Integração, Docker e E2E NÃO EXECUTADOS localmente (§ 4).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar o código `409 OWN_ADMIN_ACCESS` (admin tentando se desativar/rebaixar) como complemento do contrato do ADR-016 § 4? A TASK-040 deve tratá-lo junto com `LAST_ADMIN` | não | | |
| 2 | A comparação de origem do WebSocket ignora a porta (por causa do nginx e do Vite). Aceitável, ou prefere ajustar o nginx (`Host $http_host`) e o Vite (`changeOrigin: false`) e comparar host+porta? | não | Aceito como está: ignorar a porta (comentário em `origin_matches_host`) | 2026-09-26 |
| 3 | Checagem de "último admin" não é atômica (conta e depois grava). Registrar como dívida? | não | Não: tornar atômica e à prova de concorrência. Feito (§ 11) | 2026-09-26 |
| 4 | Limite de tentativas em memória, por processo (dívida já prevista no ADR-016) | não | | |
| 5 | Trocar a senha deveria revogar as outras sessões do usuário? Hoje não revoga (o ADR não pede) | não | | |

## 9. ⚠️ Segurança

- `SESSION_COOKIE_SECURE=false` só para HTTP local; documentado em `.env.example`, `docs/demo.md` e
  `docs/security.md`. No CI, só no `.env` efêmero do job `e2e`.
- Senha de CI `ci_only_admin_password_not_secret`: descartável, só no job `e2e`, no mesmo estilo de
  `POSTGRES_PASSWORD`. Nenhuma senha real em arquivo.
- Testes conferem que senha e token não aparecem em log, resposta ou mensagem de erro.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável.

**O que fazer, concretamente:**
1. Push/PR; conferir no CI os testes `integration` novos (repositórios, `compare_metadata` da
   migration, `test_auth_integration.py`, `test_create_admin_integration.py`) e os jobs `docker`
   (fumaça agora espera 401) e `e2e` (passo do admin; os specs falham até a TASK-040).
2. TASK-040 — como o frontend e o E2E fazem login:
   - `POST /api/v1/auth/login` com `{"username","password"}`, `credentials: 'same-origin'` e o
     cabeçalho `X-Requested-With: crane-simulator` (obrigatório em todo POST/PUT/PATCH/DELETE, senão
     `403 CSRF_HEADER_MISSING`); a resposta grava o cookie `crane_session` (HttpOnly, o JS não lê).
   - `GET /api/v1/auth/session` → `{authEnabled, user}`; `authEnabled:false` = modo sem banco.
   - Erros: `{"detail": str, "code": str}`; 401 `NOT_AUTHENTICATED` em qualquer rota → login.
   - E2E: usar `E2E_ADMIN_USERNAME` (`e2e-admin`) e `E2E_ADMIN_PASSWORD` do job `e2e`; a stack roda
     em HTTP com `SESSION_COOKIE_SECURE=false`. O WebSocket usa o mesmo cookie, na mesma origem.
3. Documentação para a integração da leva D (não editada aqui): `README.md` (comando do admin),
   `docs/development-guide.md` (`SESSION_COOKIE_SECURE`, `create_admin`), `docs/architecture.md`
   (módulos novos), `docs/known-gaps.md` (P-009/L-003 resolvidos; pendências do § 8),
   `handoffs/current.md`.

**Arquivos que o próximo agente deve ler primeiro:**
- `docs/decisions/ADR-016-autenticacao-e-perfis.md`
- `backend/app/presentation/api/authorization.py`, `auth.py`, `users.py`
- `backend/tests/presentation/test_route_authorization.py`

## 11. Ajuste após as respostas da pessoa responsável (2026-09-26)

Pedido pelo orquestrador, com as respostas do § 8 itens 2 e 3.

**"Último admin" atômico:**
- A garantia saiu do caso de uso e foi para o repositório: `UserRepository.update` confere e grava
  na mesma operação e levanta `LastAdminError`, que agora é erro de **domínio**
  (`app/domain/exceptions/user_errors.py`). `ManageUsers` só mantém a proteção do próprio admin.
  `count_active_admins` saiu da porta, porque ninguém mais o usa.
- `SqlAlchemyUserRepository.update`: quando o novo estado **não** é admin ativo, trava as linhas de
  todos os admins ativos (`SELECT id ... WHERE role='ADMIN' AND active ORDER BY id FOR UPDATE`), lê o
  alvo com `FOR UPDATE` e recusa se não sobra outro admin ativo, tudo numa transação.
  - Por que é à prova de concorrência: a segunda transação espera a trava. No `READ COMMITTED` do
    PostgreSQL, ao ganhar a trava ela reavalia o filtro na versão gravada pela primeira, deixa de
    ver o admin rebaixado e conta só o que sobrou.
  - Sem impasse: todas as transações que podem tirar um admin travam o mesmo conjunto, na mesma
    ordem (id), antes do alvo. As que não tiram admin travam só a linha do alvo.
  - Alternativas descartadas: `SERIALIZABLE` (exige repetir a transação em erro de serialização) e
    trava consultiva (`pg_advisory_xact_lock`), que funcionaria, mas é menos explícita que travar as
    próprias linhas.
- O repositório falso (`tests/fixtures/auth_ficticia.py`) segue o mesmo contrato.
- Testes novos:
  - unitários do repositório falso (recusa sem gravar; outras mudanças do último admin passam);
  - `PATCH` com uma corrida simulada (409 `LAST_ADMIN`);
  - integração `test_the_last_active_admin_cannot_lose_access`, numa transação desfeita;
  - integração `test_concurrent_demotion_of_the_last_two_admins_keeps_one` em
    `tests/test_auth_integration.py`: dois admins, cada um rebaixando o outro por requisições em
    threads diferentes. Uma barreira faz as duas passarem juntas pela guarda de perfil e entrarem
    juntas na gravação. O teste espera uma resposta 200 e uma 409 `LAST_ADMIN`, e um admin ativo no
    fim. Ele exige que o banco não tenha outros admins ativos: senão, pula (falha no CI).
- Limitação que continua: o `PATCH` monta o estado novo a partir de uma leitura feita antes da
  trava, então um campo que não foi enviado pode sobrescrever uma mudança simultânea desse campo
  (atualização perdida). A invariante do admin não é afetada.

**Origem do WebSocket:** decisão registrada no § 8 item 2 e na docstring de `origin_matches_host`.

**Comandos (após o ajuste, em `backend/`):** `ruff check` ✅ `All checks passed!`; `ruff format
--check` ✅ `189 files already formatted`; `mypy app` ✅ `no issues found in 107 source files`;
`lint-imports` ✅ `3 kept, 0 broken`; `pytest` ✅ `1019 passed, 52 skipped`. Os testes de integração
novos NÃO foram executados localmente (sem PostgreSQL) e rodam no CI.
