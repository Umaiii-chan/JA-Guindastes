# Handoff — TASK-027 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 17:00 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-027-docker-stack-completa.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Implementador (mesma sessão; revisão independente pendente) |
| **Ferramenta/agente** | agente Claude Code (Opus 5.5), em segundo plano num worktree isolado (leva A) |
| **Branch** | `task/TASK-027-docker-stack-completa` @ commit do handoff (base `a5b1ab0`) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Conteinerizar backend e frontend, acrescentá-los ao `docker-compose.yml` (doc-fonte § 22.1) e criar
um job de CI que valida o compose, constrói as imagens e sobe a stack.

## 2. O que foi feito

- Criei `backend/Dockerfile` (multi-stage): `python:3.14-slim-trixie` + uv `0.12.18` copiado de
  `ghcr.io/astral-sh/uv:0.12.18`; `uv sync --locked --no-dev --no-install-project` num `.venv`
  (`UV_PYTHON_DOWNLOADS=never`, usa o Python da imagem); imagem final sem o uv, usuário `app`
  (UID/GID 10001, `USER 10001:10001`), `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000`,
  `HEALTHCHECK` em `/openapi.json`. Copia `app/`, `alembic/` e `alembic.ini`; os testes ficam fora.
- Criei `frontend/Dockerfile` (multi-stage): `node:24-trixie-slim` com `npm ci` + `npm run build`;
  imagem final `nginxinc/nginx-unprivileged:1.30-alpine` (sem root, porta **8080**) servindo `dist/`.
- Criei `frontend/nginx.conf.template`: SPA (`try_files ... /index.html`), cache longo em `/assets/`,
  `index.html` com `no-cache`, `server_tokens off`, `X-Content-Type-Options nosniff`, proxy de `/api/`
  para `${API_UPSTREAM}` (padrão `http://backend:8000`, substituído pelo entrypoint da imagem nginx)
  com cabeçalhos de upgrade para WebSocket, e `client_max_body_size 10m`.
- Criei `backend/.dockerignore` e `frontend/.dockerignore`.
- Alterei `docker-compose.yml`: mantive o `postgres` como estava e acrescentei `backend` e `frontend`,
  com `depends_on` + `condition: service_healthy` (frontend → backend → postgres), healthchecks, imagens
  `ja-guindastes-backend:local` e `ja-guindastes-frontend:local`, portas em `127.0.0.1`
  (`BACKEND_PORT` padrão 8000, `FRONTEND_PORT` padrão 8080). O `DATABASE_URL` do container é montado
  com os `POSTGRES_*` e o host `postgres`, ou vem de `BACKEND_DATABASE_URL` se definida.
- Acrescentei a `.env.example` só as variáveis novas: `BACKEND_PORT`, `FRONTEND_PORT`,
  `BACKEND_DATABASE_URL` (todas opcionais, sem valor).
- Acrescentei o job `docker` ("Imagens Docker (build e teste de fumaça)") ao `.github/workflows/ci.yml`,
  depois do `quality`, com `needs: structure`. Jobs existentes intactos (o `deploy` continua com
  `needs: [structure, backend, quality]`).
- Criei `tasks/in-progress/TASK-027-docker-stack-completa.md` e este handoff.

**Como subir a stack** (na raiz, com o Docker rodando):

```bash
cp .env.example .env          # preencher POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
docker compose up -d --build  # constrói e sobe postgres, backend e frontend
docker compose ps             # pronto quando os três estiverem "healthy"
docker compose run --rm backend alembic upgrade head   # migrations, sob demanda
# frontend: http://127.0.0.1:8080/   API/OpenAPI: http://127.0.0.1:8000/docs
docker compose down           # para tudo e mantém o volume (não use -v)
```

## 3. Arquivos modificados

```text
$ git diff --stat a5b1ab0...HEAD   (antes do commit da tarefa e do handoff)
 .env.example                 | 10 ++++++++
 .github/workflows/ci.yml     | 47 +++++++++++++++++++++++++++++++++++++
 backend/.dockerignore        | 11 +++++++++
 backend/Dockerfile           | 56 ++++++++++++++++++++++++++++++++++++++++++++
 docker-compose.yml           | 55 +++++++++++++++++++++++++++++++++++++++----
 frontend/.dockerignore       |  9 +++++++
 frontend/Dockerfile          | 35 +++++++++++++++++++++++++++
 frontend/nginx.conf.template | 50 +++++++++++++++++++++++++++++++++++++++
 8 files changed, 269 insertions(+), 4 deletions(-)
```

Mais `tasks/in-progress/TASK-027-docker-stack-completa.md` e `handoffs/TASK-027.md`.

Fora do escopo: nenhum. (`.github/workflows/ci.yml` é protegido; alteração autorizada pela pessoa para
esta tarefa — só um job novo.)

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `docker compose --env-file <env de teste com POSTGRES_*> config` | ✅ | stack resolvida: `DATABASE_URL: postgresql+psycopg://u:p@postgres:5432/d`; portas `host_ip: 127.0.0.1` 8000/8080/5432; `depends_on` com `service_healthy` |
| `docker compose --env-file <env com BACKEND_DATABASE_URL e FRONTEND_PORT=9090> config` | ✅ | `DATABASE_URL: postgresql+psycopg://u:a%40b@postgres:5432/d`; `published: "9090"`; `BACKEND_PORT` vazio → `8000` |
| `docker compose --env-file /dev/null config -q` | ✅ (falha esperada) | exit 1: `required variable POSTGRES_DB is missing a value: defina POSTGRES_DB no .env (ver .env.example)` |
| `uvx --from hadolint-py hadolint backend/Dockerfile frontend/Dockerfile` (Hadolint 2.15.1) | ✅ | 1ª rodada: `DL3066 info: Non-numeric user-id` → troquei para `USER 10001:10001`; 2ª rodada: exit 0, sem avisos |
| `uv run --no-project --with pyyaml python -c "yaml.safe_load(...)"` | ✅ | jobs `['structure', 'backend', 'quality', 'docker', 'deploy']`; 10 passos no `docker` |
| `bash scripts/check-structure.sh` | ✅ | ver § 4.1 (depois do handoff) |
| `docker build backend` / `docker build frontend` / `docker compose up` | ⚠️ **NÃO EXECUTADO localmente; validado no CI** | o motor do Docker não sobe nesta máquina (virtualização desativada, pendência 6 de `handoffs/current.md`) |
| Existência das imagens e tags (Docker Hub API / GHCR / `gh api`) | ✅ | `python:3.14-slim-trixie` 200, `node:24-trixie-slim` 200, `nginxinc/nginx-unprivileged:1.30-alpine` 200 (mesmo digest de `stable-alpine`), `ghcr.io/astral-sh/uv:0.12.18` 200, `actions/checkout` → `refs/tags/v4` |

### 4.1 check-structure

```text
$ bash scripts/check-structure.sh   (com a tarefa e este handoff no disco)
  ! há 3 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
OK: 0 erros, 1 aviso(s)
```

## 5. Decisões tomadas

- **URL da API por proxy reverso no nginx, não por build arg.** O bundle não guarda URL; o frontend
  chama `/api/...` relativo e o nginx encaminha `/api/` para `API_UPSTREAM` sem reescrever o caminho
  (as rotas do backend já começam em `/api/v1`, `LOAD_CHARTS_PREFIX`). Motivos: mesma origem (o
  backend não tem CORS configurado, e não posso mexer em `backend/app`); a mesma imagem serve qualquer
  ambiente (o destino é variável de runtime, não exige rebuild).
- **Migrations por comando documentado** (`docker compose run --rm backend alembic upgrade head`), não
  automáticas na subida: sem serviço one-shot (que complica `up --wait`) e sem script de entrypoint.
  Ainda não há revisões, então a API sobe sem migrations.
- **`DATABASE_URL` do container derivada dos `POSTGRES_*`** (host `postgres`), porque o
  `DATABASE_URL` do `.env` aponta para `localhost` (uso fora do container). `BACKEND_DATABASE_URL`
  cobre senhas com caracteres especiais (a interpolação do Compose não codifica em URL).
- **Healthcheck do backend em `/openapi.json`**, porque não há rota de saúde (pendência 1).
- **`client_max_body_size 10m`** no nginx: o padrão do nginx (1 MiB) responderia 413 antes do backend,
  cujo limite provisório também é 1 MiB (P-008) mais o overhead do multipart.
- **Teste de fumaça no job de CI** (além do build e do `compose config` pedidos): sobe a stack com
  `--wait`, roda o Alembic no container e confere `/openapi.json` (8000), `index.html` (8080) e o proxy
  (`POST /api/v1/load-charts/validate` sem arquivo → 422 do FastAPI). É a única evidência de que a stack
  funciona, já que nada roda localmente. Se a pessoa preferir só o build, basta remover os passos
  "Subir a stack", "Migrations", "Teste de fumaça", "Logs" e "Derrubar".
- **`docker compose config --quiet` no CI**, para não imprimir a configuração interpolada no log (hoje
  só há valores de CI, mas evita o hábito).
- **Tags de imagem por major/minor** (`python:3.14-slim-trixie`, `node:24-trixie-slim`,
  `nginx-unprivileged:1.30-alpine`, uv `0.12.18`), como o `postgres:18` da TASK-011; fixar por digest
  fica como pendência 3. Base Debian (glibc) no build do frontend, igual ao runner do CI (o lock tem os
  binários `linux-x64-gnu` do rolldown e do lightningcss).
- Ferramenta usada só para verificação, **não** adicionada ao projeto: `hadolint-py` (PyPI, wrapper do
  binário Hadolint 2.15.1), rodada com `uvx`.

## 6. Regras de negócio aplicadas

- Nenhuma (infraestrutura).

## 7. O que NÃO foi feito e por quê

- Build das imagens e subida da stack: **NÃO EXECUTADO localmente; validado no CI** (job `docker`),
  que só roda depois do push/PR.
- Rota de saúde no backend, proxy do Vite em modo dev e documentação: fora do escopo (§§ 8 e 10).
- Push de imagens e deploy: fora do escopo.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Criar uma rota de saúde (ex.: `GET /api/v1/health`) no backend para os healthchecks, em vez de `/openapi.json`? (tarefa de backend) | não | | |
| 2 | Configurar `server.proxy` de `/api` no `vite.config.ts` para o `npm run dev` usar os mesmos caminhos relativos que o nginx? (arquivo fora do escopo desta tarefa) | não | | |
| 3 | Fixar as imagens base por digest (`@sha256:...`) em vez de tag major/minor? | não | | |
| 4 | O WebSocket (TASK-025, ADR-010) vai ficar sob `/api/`? O nginx só faz upgrade de conexão em `/api/`; outro caminho exige um `location` novo em `frontend/nginx.conf.template` | não | | |
| 5 | Migrations automáticas na subida do backend (serviço one-shot ou entrypoint) em vez do comando sob demanda? | não | | |
| 6 | Manter o teste de fumaça no job `docker` do CI ou deixar só build + `compose config`? | não | | |

## 9. ⚠️ Segurança (se houver algo)

- Nada a relatar. Nenhum segredo commitado; o `.env` de CI é gerado no job com os mesmos valores
  não-secretos do job `backend` (`ci_only_not_a_secret`). Containers sem root; portas só em 127.0.0.1.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável

**O que fazer, concretamente:**
1. Fazer push e abrir o PR; conferir se o job "Imagens Docker (build e teste de fumaça)" passa.
   Se falhar, os logs da stack saem no passo "Logs da stack (em caso de falha)".
2. Revisar (§ 11) e responder o § 8.
3. Mudanças de documentação necessárias (não feitas aqui, por regra da leva A):
   - `docs/development-guide.md` § 1: Docker passa a servir também para a stack completa, não só o banco.
   - § 2 (Instalação): alternativa `docker compose up -d --build` para a stack inteira.
   - § 3: linhas para `docker compose up -d --build` (stack), `docker compose up -d postgres` (só o
     banco, para rodar backend/frontend na máquina — hoje `docker compose up -d` sobe tudo),
     `docker compose run --rm backend alembic upgrade head`, `docker compose logs -f <serviço>`;
     "Subir o banco local" precisa passar a dizer `docker compose up -d postgres`.
   - § 4: `docker-compose.yml` passa a ter os três serviços; `backend/Dockerfile`,
     `frontend/Dockerfile`, `frontend/nginx.conf.template`; a pasta `docker/` planejada não foi usada
     (cada Dockerfile fica junto do seu serviço).
   - § 6: variáveis `BACKEND_PORT`, `FRONTEND_PORT`, `BACKEND_DATABASE_URL` (lidas pelo
     `docker-compose.yml`) e `API_UPSTREAM` (fixa no compose; lida pelo nginx do frontend).
   - § 9: sintoma "porta 8000/8080 já em uso" → definir `BACKEND_PORT`/`FRONTEND_PORT` no `.env`.
   - `docs/architecture.md`: diagrama/descrição de deployment local (nginx na frente, `/api/` → backend).
   - `README.md`: seção de como rodar com Docker.
   - `handoffs/current.md` § 2: TASK-027 com este handoff.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-027-docker-stack-completa.md`
4. `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf.template`
5. job `docker` em `.github/workflows/ci.yml`

**Cuidado com:**
- `docker compose up -d` agora sobe a stack inteira (inclusive o build); para só o banco, use
  `docker compose up -d postgres`. As portas 8000 e 8080 do host conflitam com `uv run uvicorn` e
  com outro serviço local, se estiverem rodando ao mesmo tempo.
- O `DATABASE_URL` do `.env` (localhost) **não** é usado pelo container; ele usa `BACKEND_DATABASE_URL`
  ou a URL montada com `POSTGRES_*`.

## 11. Como revisar este trabalho

- Comece por `frontend/nginx.conf.template` e `frontend/Dockerfile`: o envsubst de templates da imagem
  `nginx-unprivileged` (gravando em `/etc/nginx/conf.d` como UID 101) é o ponto de que tenho menos
  certeza sem ter rodado; o teste de fumaça do CI cobre.
- `backend/Dockerfile`: conferir que o `.venv` copiado entre estágios funciona (mesma imagem base, mesmo
  caminho `/app/.venv`) e que `uvicorn[standard]` tem wheels cp314 para Linux (o `uv.lock` lista wheels
  `cp314-cp314-manylinux` de `uvloop`/`httptools`).
- O teste de fumaça espera 422 no proxy; se o endpoint mudar de caminho ou de contrato, o passo quebra.
