# Guia de desenvolvimento

> **Status deste documento:** consolidado em `development` @ `d58edf6` (2026-09-26, TASK-037). Os
> comandos do **backend** (TASK-004, ADR-012), do **frontend** (TASK-007), do **banco local e do
> Alembic** (TASK-011, TASK-022) e do **Docker Compose** (TASK-027) são reais. Os comandos listados
> aqui são os **únicos** que os agentes devem executar. Se um comando não está aqui, ou está
> "A VALIDAR", o agente pergunta antes de rodar.
> Mantenha este documento sincronizado com o CI (`.github/workflows/ci.yml`): os dois devem rodar
> os mesmos comandos.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037) |
| Stack | Python 3.14 + FastAPI, uv (backend; `python-multipart` para upload, `openpyxl` para XLSX) / Node 24 + TypeScript + React + Three.js, npm + Vite (frontend) / PostgreSQL 18 no Docker Compose, SQLAlchemy 2 + psycopg 3 + Alembic (persistência) / Docker Compose com postgres, backend e frontend (nginx) — ADR-007, ADR-012, ADR-014 (proposto) |

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar / verificar |
|------------|--------|---------------------------|
| Git | 2.x | `git --version` |
| Bash (Git Bash no Windows) | — | necessário para `scripts/check-structure.sh` |
| uv (gerencia o Python e as dependências do backend) | 0.12+ | `uv --version`; instala o Python 3.14 sozinho a partir de `backend/.python-version` |
| Node.js + npm (frontend) | Node 24 LTS, npm 11 | `node --version`, `npm --version` |
| Docker + Docker Compose (PostgreSQL local e testes de integração; ou a stack completa) | Docker 29, Compose v2 ou mais novo (instalados na máquina de desenvolvimento: Docker 29.8.0, Compose v5.5.1) | `docker --version`, `docker compose version`; no Windows, o Docker Desktop precisa estar rodando (ver § 9) |

---

## 2. Instalação

Duas formas. Roteiro de demonstração com dados FICTÍCIOS: `docs/demo.md` (criado pela TASK-035).

### 2.1 Stack completa no Docker

```bash
git clone https://github.com/Umaiii-chan/JA-Guindastes.git
cd JA-Guindastes
cp .env.example .env
# edite .env (nunca commitar): POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (ver § 6)

docker compose up -d --build                           # postgres + backend + frontend
docker compose ps                                      # esperar os três "healthy"
docker compose run --rm backend alembic upgrade head   # migrations
# frontend: http://127.0.0.1:8080/    API/OpenAPI: http://127.0.0.1:8000/docs
```

Em `d58edf6`, o `docker-compose.yml` não passa `FILE_STORAGE_DIR` ao backend nem monta volume para
o arquivo-fonte: as rotas de importação com gravação e ativação não aparecem no container (TASK-031
§ 8 item 7; ajuste do Docker na TASK-035).

### 2.2 Backend e frontend direto na máquina

```bash
# instalar dependências
cd backend && uv sync --locked && cd ..
cd frontend && npm ci && cd ..

# configurar ambiente
cp .env.example .env
# edite .env com valores locais (nunca commitar): POSTGRES_*, DATABASE_URL e FILE_STORAGE_DIR (ver § 6)

# subir só o banco e aplicar as migrations (precisa do Docker rodando)
docker compose up -d postgres
cd backend && set -a && source ../.env && set +a && uv run alembic upgrade head && cd ..

# rodar (dois terminais)
cd backend && set -a && source ../.env && set +a && uv run uvicorn app.main:app --reload   # porta 8000
cd frontend && npm run dev                                                               # proxy /api → localhost:8000
```

---

## 3. Comandos do dia a dia

**Estes comandos são a referência oficial.** O CI e os agentes usam exatamente estes.

| Ação | Comando | Observações |
|------|---------|-------------|
| Rodar o backend em desenvolvimento | `uv run uvicorn app.main:app --reload` | em `backend/`; OpenAPI em `/docs`. `app.main:app` é a raiz de composição (API completa). Sem `DATABASE_URL`: modo "persistência não configurada" (avaliação `NOT_EVALUABLE`, sem rotas de catálogo nem de tabelas gravadas). Com `DATABASE_URL`: precisa do banco em `head`. Rotas de importação com gravação: também `FILE_STORAGE_DIR`. **Não use** `app.presentation.api.main:app` (sobe sem as rotas que dependem de adapters) |
| Conferir a saúde da API | `curl http://localhost:8000/api/v1/health` | `{"status": "UP", "database": "NOT_CONFIGURED" \| "UP" \| "DOWN"}`; responde 200 mesmo com o banco `DOWN` |
| Rodar testes (backend) | `uv run pytest` | em `backend/`; ver [`testing-strategy.md`](testing-strategy.md) e doc-fonte § 20 |
| Rodar um teste específico (backend) | `uv run pytest tests/<arquivo>.py::<teste>` | em `backend/` |
| Lint (backend) | `uv run ruff check .` | em `backend/` |
| Formatação — verificar (backend) | `uv run ruff format --check .` | em `backend/` |
| Formatação — corrigir (backend) | `uv run ruff format .` | em `backend/` |
| Verificação de tipos (backend) | `uv run mypy app` | em `backend/`; modo strict (RNF-008) |
| Regras de camadas (backend) | `uv run lint-imports` | em `backend/`; contratos em `backend/pyproject.toml` (ADR-004, RNF-002) |
| Testes do WebSocket (backend) | `uv run pytest tests/presentation/websocket` | em `backend/`; `TestClient.websocket_connect`, sem servidor real |
| Rodar o frontend em desenvolvimento | `npm run dev` | em `frontend/` (Vite, porta 5173); `/api` e o WebSocket vão para `http://localhost:8000` (proxy em `vite.config.ts`); sem backend na 8000 o painel mostra erro de rede e "reconectando…" |
| Rodar testes (frontend) | `npm test` | em `frontend/`; Vitest, testes em `frontend/tests/` |
| Rodar um teste específico (frontend) | `npx vitest run tests/<caminho>.test.ts` | em `frontend/` |
| Regenerar o GLB de exemplo FICTÍCIO | `UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts` | em `frontend/`, no Bash (PowerShell: `$env:UPDATE_EXAMPLE_GLB='1'; npx vitest run ...`); só quando o guindaste provisório mudar; sem a variável, o teste confere que `assets/example-models/guindaste-provisorio.ficticio.glb` está em dia |
| Lint (frontend) | `npm run lint` | em `frontend/`; ESLint, inclui a regra "Three.js só em `src/three/`" (ADR-005) |
| Formatação — verificar (frontend) | `npm run format:check` | em `frontend/`; Prettier |
| Formatação — corrigir (frontend) | `npm run format` | em `frontend/` |
| Verificação de tipos (frontend) | `npm run typecheck` | em `frontend/`; `tsc -b` com `strict` |
| Build (frontend) | `npm run build` | em `frontend/`; saída em `frontend/dist/` |
| Subir a stack completa (postgres + backend + frontend) | `docker compose up -d --build` | na raiz; lê o `.env` da raiz; constrói `ja-guindastes-backend:local` e `ja-guindastes-frontend:local`; pronta quando `docker compose ps` mostrar os três `healthy`; frontend em `http://127.0.0.1:8080/`, API em `http://127.0.0.1:8000/docs` (portas só em `127.0.0.1`) |
| Subir só o banco local (PostgreSQL 18) | `docker compose up -d postgres` | na raiz; para rodar backend e frontend direto na máquina; porta `127.0.0.1:${POSTGRES_PORT:-5432}`. (`docker compose up -d` sem nome sobe a stack inteira) |
| Migrations na stack Docker | `docker compose run --rm backend alembic upgrade head` | na raiz, com o `postgres` no ar; não é automático na subida (TASK-027 § 8 item 5) |
| Ver o estado dos serviços | `docker compose ps` | na raiz |
| Ver os logs de um serviço | `docker compose logs -f <serviço>` | na raiz; `postgres`, `backend` ou `frontend` |
| Parar a stack (mantém os dados) | `docker compose down` | na raiz; **não** use `down -v`: o `-v` apaga o volume `ja-guindastes_postgres-data` com os dados |
| Exportar as variáveis do `.env` no shell | `set -a && source ../.env && set +a` | em `backend/`, no Bash/Git Bash; o backend, o Alembic e o pytest **não** leem o `.env` sozinhos (§ 6) |
| Migrations (aplicar) | `uv run alembic upgrade head` | em `backend/`, com `DATABASE_URL` exportada e o banco no ar (o CI roda contra um PostgreSQL de serviço, TASK-018); uma revisão: `1f4cfaff16e8` (catálogo e tabelas de carga, TASK-022) |
| Migrations (criar) | `uv run alembic revision --autogenerate -m "<descrição>"` | em `backend/`, com o banco no ar; compara o banco com `Base.metadata` (os modelos precisam estar importados em `backend/alembic/env.py`); o arquivo sai em `backend/alembic/versions/` já passado pelo `ruff format` e `ruff check --fix`; **revise-o** antes de commitar |
| Migrations (gerar o SQL sem conectar) | `uv run alembic upgrade head --sql` | em `backend/`; só precisa de `DATABASE_URL` definida |
| Testes de integração com banco | `uv run pytest -m integration` | em `backend/`, com o banco no ar **em `head`** e `DATABASE_URL` exportada; sem banco, são pulados; com `REQUIRE_INTEGRATION_DB=1` (como no CI), falham em vez de pular. O teste da migration só desce (`downgrade base`) com as tabelas vazias |
| Auditoria de dependências | A VALIDAR | ferramenta não definida; ver [`security.md`](security.md) § 5 |
| Validar estrutura do repo | `bash scripts/check-structure.sh` | universal, já funciona |

Os comandos que precisam do banco ou do Docker no ar (`docker compose ...`, `alembic upgrade head`
conectado, `pytest -m integration` com banco) rodam no CI (jobs `backend` e `docker`), mas **não
foram verificados na máquina de desenvolvimento**, onde o Docker não sobe por falta de virtualização
([`known-gaps.md`](known-gaps.md) L-005; § 9). Localmente rodaram o modo sem conexão
(`alembic upgrade head --sql`), os testes sem banco e a API sem `DATABASE_URL`.

Comando único que roda tudo antes de abrir PR:

```bash
bash scripts/check-structure.sh && (cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run lint-imports && uv run pytest)
(cd frontend && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build)
```

---

## 4. Estrutura de pastas do código

Estrutura **real** em `d58edf6` (doc-fonte § 9, adaptada à raiz deste repositório).

```text
frontend/
├── Dockerfile, nginx.conf.template, .dockerignore   ← imagem (build do Vite + nginx sem root, porta 8080)
├── vite.config.ts       ← proxy /api (com WebSocket) para localhost:8000; config do Vitest
├── src/
│   ├── app/             ← App.tsx, composição da sessão de avaliação (useEvaluationSession, evaluationInput)
│   ├── domain/          ← geometry/ (pré-visualização do ADR-013), evaluation/ (tipos)
│   ├── application/     ← evaluation/ (EvaluationSession, debounce, portas)
│   ├── infrastructure/  ← api/ (REST), websocket/, shared/
│   ├── presentation/    ← components/ (viewport, error boundary), panels/
│   └── three/           ← scene/, camera/, controls/, loaders/ (GLB/glTF), crane/ (CraneController, guindaste provisório, mapeamento cinemático)
└── tests/               ← espelha src/ (app, application, domain, infrastructure, presentation, three) + fixtures/, helpers/
backend/
├── Dockerfile, .dockerignore                        ← imagem (Python 3.14, sem o uv, usuário 10001, porta 8000)
├── alembic.ini, alembic/ ← migrations (env.py, script.py.mako, versions/)
├── app/
│   ├── main.py          ← raiz de composição (app.main:app), fora das camadas
│   ├── load_chart_persistence_composition.py  ← composição da importação com gravação (parte da raiz)
│   ├── domain/          ← entities/, value_objects/, services/, exceptions/
│   ├── application/     ← ports/, use_cases/
│   ├── infrastructure/  ← database/ (config, engine, Base, models/), repositories/, storage/, importers/
│   └── presentation/    ← api/ (routers e schemas), websocket/
└── tests/               ← domain/, application/, infrastructure/ (database/, repositories/), presentation/ (websocket/), fixtures/ (FICTÍCIOS), test_composition*.py, test_openapi.py
assets/example-models/   ← GLB de exemplo FICTÍCIO (guindaste-provisorio.ficticio.glb) e README com os requisitos de um GLB real
docker-compose.yml       ← stack local: postgres, backend e frontend (TASK-011, TASK-027)
docs/                    ← documentação do projeto (este diretório); doc-fonte em docs/produto/
```

A pasta `docker/` prevista na doc-fonte não foi usada: cada Dockerfile fica junto do seu serviço
(TASK-027). As pastas `three/animation/`, `three/collision/` e `presentation/pages/` da doc-fonte
não existem.

Regras de dependência entre pastas estão em [`architecture.md`](architecture.md) § 3.

---

## 5. Convenções de código

| Tema | Convenção |
|------|-----------|
| Estilo | seguir o linter configurado (ruff no backend, ESLint no frontend); não desligar regras sem ADR |
| Nomes de arquivos | backend: `snake_case.py` (PEP 8); frontend: componentes React em `PascalCase.tsx`, demais módulos em `camelCase.ts` |
| Nomes de classes/funções | entidades de domínio com os nomes em inglês da doc-fonte § 10.2 (`Crane`, `LoadChart`, `CraneConfiguration`...); casos de uso como na § 11.1 (`CreateCrane`, `CalculateCapacity`...) |
| Campos com unidade | sufixo da unidade no nome, como nos contratos da doc-fonte §§ 14–15 (`boom_length_m`, `boom_angle_deg`, `load_weight_kg`) |
| Tratamento de erros | consulta fora do domínio da tabela é erro/resultado de domínio explícito, nunca extrapolação silenciosa (RN-007; doc-fonte § 14.4) |
| Logs | não substituem os dados persistidos necessários para reproduzir um resultado (doc-fonte § 21) |
| Comentários | explicam **por quê**, não **o quê** |
| Idioma | código em inglês; docs e commits em português; comentários no código: A VALIDAR |

---

## 6. Variáveis de ambiente

Documentadas em [`.env.example`](../.env.example) na raiz. Regras:
- toda variável nova entra em `.env.example` **na mesma tarefa** em que passa a ser lida;
- valores reais nunca vão para o repositório;
- em CI, variáveis vêm do próprio workflow;
- em desenvolvimento, homologação e produção, os valores vêm dos *secrets* do GitHub Environment de
  mesmo nome da branch (`development`, `homologation`, `production`) — o mesmo nome de variável nos
  três, com valores diferentes. Ver [`guides/git-github.md`](guides/git-github.md) § 8.3.

Variáveis em uso (TASK-011, 018, 027, 031):

| Variável | Quem lê | Obrigatória? | Observação |
|----------|---------|--------------|------------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `docker-compose.yml` (serviço `postgres`; e a `DATABASE_URL` padrão do `backend`) | sim, para `docker compose up` | só valem na primeira subida, quando o volume é criado |
| `POSTGRES_PORT` | `docker-compose.yml` | não (padrão `5432`) | porta do host, publicada só em `127.0.0.1` |
| `DATABASE_URL` | backend (`app/infrastructure/database/config.py`, `app/main.py`), Alembic (`backend/alembic/env.py`), testes de integração | sim, para o Alembic e para a API com persistência; sem ela a API sobe em modo "persistência não configurada" | formato `postgresql+psycopg://<usuario>:<senha>@localhost:<porta>/<banco>`, com os mesmos valores de `POSTGRES_*`; outro esquema (`postgresql://`, `sqlite://`...) é recusado com erro claro, e a API não sobe; `?connect_timeout=5` no fim faz falhar mais rápido sem banco |
| `FILE_STORAGE_DIR` | backend (`app/infrastructure/storage/local_file_storage.py`, via `app/load_chart_persistence_composition.py`) | não; sem ela (ou sem `DATABASE_URL`) a API sobe sem `POST /load-charts/import`, `GET /load-charts/{id}` e `POST /load-charts/{id}/activate` | diretório do arquivo-fonte das tabelas importadas, nomeado pelo SHA-256, nunca sobrescrito; criado na primeira gravação; use um caminho **fora** do repositório (não há entrada no `.gitignore`); ainda não é passado ao container do Compose |
| `BACKEND_PORT`, `FRONTEND_PORT` | `docker-compose.yml` | não (padrões `8000` e `8080`) | portas do host para a API e o frontend dos containers, só em `127.0.0.1` |
| `BACKEND_DATABASE_URL` | `docker-compose.yml` | não | `DATABASE_URL` usada dentro do container do backend; vazia = montada com `POSTGRES_*` e o host `postgres`; preencha só se a senha tiver caracteres especiais de URL (já codificada) |
| `API_UPSTREAM` | nginx do frontend (`frontend/nginx.conf.template`) | fixa no `docker-compose.yml` (`http://backend:8000`) | destino do proxy de `/api/`; não vai no `.env` |
| `REQUIRE_INTEGRATION_DB` | testes de integração do backend | não; `1` no CI | com `1`, teste de integração sem banco falha em vez de pular |
| `UPDATE_EXAMPLE_GLB` | `frontend/tests/three/loaders/exampleModel.test.ts` | não | com `1`, regenera o GLB de exemplo (§ 3) |

O Docker Compose lê o `.env` da raiz sozinho. O backend, o Alembic e o pytest **não**: exporte as
variáveis no shell antes (`set -a && source ../.env && set +a`, em `backend/`) ou defina-as no
próprio comando (`DATABASE_URL=... uv run alembic upgrade head`). No `.env`, deixe o comentário na
linha de cima da variável: o Compose lê `NOME=   # comentário` como se o comentário fosse o valor.

---

## 7. Fluxo de branches e commits

Resumo (detalhes em [`guides/git-github.md`](guides/git-github.md)):
- Três branches longas, uma por ambiente: `development` (default), `homologation` e `production`.
  Nenhuma recebe commit direto — só PR.
- Uma branch por tarefa: `task/<TASK-ID>-<slug>`, criada a partir de `development` e mesclada de
  volta em `development` por **squash**.
- Promoção entre ambientes por PR de merge em cascata, sempre com **merge commit** (nunca squash).
- Commits no formato Conventional Commits, sempre com o ID da tarefa na mensagem (entre parênteses
  no final, ou na descrição quando a tarefa é o próprio assunto).
- **Nenhum commit leva rodapé de co-autoria de IA** (`Co-authored-by:` e equivalentes). Verificado
  por `scripts/check-structure.sh`.
- Antes de abrir PR: rodar o comando único da seção 3.

---

## 8. Arquivos protegidos

Agentes **não alteram** estes arquivos sem autorização explícita registrada no handoff:

| Arquivo/pasta | Motivo | Quem pode alterar |
|---------------|--------|-------------------|
| `docs/business-rules.md` | regras de negócio vêm da pessoa responsável | pessoa responsável |
| `docs/decisions/ADR-*` com status Aceito | histórico de decisões | ninguém (criar novo ADR) |
| `handoffs/history/`, `tasks/completed/` | histórico | ninguém |
| `.github/workflows/*` | segurança do CI | pessoa responsável |
| `docs/produto/documentacao-tecnica-v0.1.md` e `docs/produto/diagrams/` | cópia congelada da doc-fonte v0.1; uma versão nova entra como arquivo novo | ninguém (nova versão = novo arquivo) |

---

## 9. Solução de problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| No Windows, `python` abre a Microsoft Store ou diz "Python não foi encontrado" | alias de execução do Windows para a Store | desativar o alias em Configurações > Aplicativos > Configurações avançadas > Aliases de execução, ou usar o Python do gerenciador definido na tarefa de toolchain |
| `git push` recusado com "refusing to allow a Personal Access Token to create or update workflow ... without `workflow` scope" | o token usado pelo git (no Windows, o do Git Credential Manager) não tem o escopo `workflow`, exigido para alterar `.github/workflows/` | `gh auth refresh -h github.com -s workflow` (concluir no navegador) e fazer o push com a credencial do gh: `gh auth setup-git` (permanente) ou `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push ...` (só naquele comando) |
| No Windows, `uv run lint-imports >/dev/null` sai com exit 1 (`UnicodeEncodeError: 'charmap' codec can't encode characters`), embora os contratos passem | o `rich`, usado pelo import-linter, escreve no dispositivo nulo com a codificação cp1252 e falha nos caracteres que ela não tem | rodar sem redirecionar para `/dev/null` ou com `PYTHONIOENCODING=utf-8 uv run lint-imports >/dev/null` |
| No Windows, mensagens em português aparecem com `�` no lugar dos acentos (ex.: erros do Alembic sobre `DATABASE_URL`) | o Python escreve na codificação cp1252 e o Git Bash exibe em UTF-8 | rodar com `PYTHONIOENCODING=utf-8` (ex.: `PYTHONIOENCODING=utf-8 uv run alembic upgrade head`) |
| `docker compose ...` falha com "failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine" | o Docker Desktop não está rodando | abrir o Docker Desktop ou rodar `docker desktop start` e esperar `docker info` responder |
| O Docker Desktop não termina de subir; `docker desktop logs` mostra "Virtual Machine Platform not enabled" / "No virtualization available" | o motor do Docker (WSL 2) precisa de virtualização, desligada no Windows ou no firmware (BIOS/UEFI) | quem administra a máquina ativa o recurso "Plataforma de Máquina Virtual" do Windows e a virtualização no firmware, reinicia e sobe o Docker de novo (agentes não mudam configurações do sistema) |
| `uv run alembic upgrade head` (ou a aplicação) fica parado mais de 2 minutos e termina com `connection timeout expired` | o banco não está no ar e o psycopg espera o tempo-limite padrão de conexão antes de desistir | subir o banco (`docker compose up -d postgres`) e conferir `docker compose ps`; para falhar mais rápido, acrescentar `?connect_timeout=5` ao fim do `DATABASE_URL` local |
| A API sobe, mas `/docs` não mostra as rotas de catálogo nem de tabelas gravadas, e a avaliação sempre volta `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND` e `ACTIVE_LOAD_CHART_NOT_FOUND`; o log avisa "DATABASE_URL não definida" | a API está em modo "persistência não configurada" (o `.env` não foi exportado no shell) | exportar as variáveis (`set -a && source ../.env && set +a`, em `backend/`) e reiniciar o uvicorn |
| Com `DATABASE_URL`, faltam `POST /api/v1/load-charts/import`, `GET /api/v1/load-charts/{id}` e `/activate` | `FILE_STORAGE_DIR` não definida (no Compose, ela ainda não é passada ao container) | definir `FILE_STORAGE_DIR` com um diretório fora do repositório e reiniciar o backend |
| A avaliação volta `NOT_EVALUABLE` mesmo com banco | a configuração não existe, não tem ficha técnica, não tem tabela `ACTIVE`, o estado viola uma faixa da ficha, ou o raio está fora da tabela | ler os motivos da resposta (`reasons[].code`); cadastrar a configuração com `geometry`, importar e ativar a tabela |
| A API sobe com `uvicorn app.presentation.api.main:app`, mas faltam a validação de tabela, a avaliação e o WebSocket | esse `app` é só a base do contrato OpenAPI | usar `uv run uvicorn app.main:app --reload` |
| `docker compose up` falha porque a porta 8000, 8080 ou 5432 já está em uso | outro processo (por exemplo, um uvicorn ou Vite local) usa a porta no host | parar o outro processo ou definir `BACKEND_PORT`, `FRONTEND_PORT` ou `POSTGRES_PORT` no `.env` |
| O teste de integração da migration falha no `downgrade base` | ficaram dados nas tabelas (por exemplo, um teste de integração da composição que grava e apaga falhou no `finally`) | limpar as tabelas do banco de teste e rodar de novo (TASK-029 § 10) |
| No `npm run dev`, o painel fica em "reconectando…" e mostra erro de rede | o backend não está rodando na porta 8000 | subir o backend (`uv run uvicorn app.main:app --reload`, em `backend/`) |

Agentes: ao resolver um problema de ambiente que tomou tempo, adicione uma linha aqui.
