# Simulador Web 3D para Análise de Tabelas de Carga de Guindastes

Ferramenta web interativa para posicionar um guindaste e uma carga num cenário 3D, calcular os
parâmetros operacionais (raio de trabalho, altura, comprimento de lança) e obter a capacidade
admissível e os alertas **a partir da tabela de carga oficial** da configuração selecionada.

Projeto acadêmico do curso de Engenharia de Software (2º semestre de 2026), com a empresa parceira
**Guindastes Ribas Ltda.** Detalhes em [`docs/project-overview.md`](docs/project-overview.md).

> **Premissa de segurança:** é uma ferramenta de **planejamento e análise**, não de certificação de
> içamentos reais. O sistema não inventa capacidade fora do domínio conhecido da tabela (RN-004, RN-007).
> Todos os dados de exemplo do repositório são **FICTÍCIOS** (ADR-012): ainda não há tabela de carga
> oficial. O modelo 3D do guindaste sobre caminhão é **ilustrativo** (convertido de um modelo comercial
> do CGTrader) e não define capacidade nem geometria de cálculo (RN-003).

---

## Estado atual (2026-09-26, leva D integrada)

Concluídas as tarefas TASK-001..043. A leva D (TASK-038..043, PR #39) trouxe login com perfis, o
design system escuro com páginas e simulador guiado, a cena 3D enriquecida e o modelo GLB do guindaste
sobre caminhão. A TASK-044 acrescentou a listagem das tabelas de uma configuração, com a ativa, e a
edição de fabricante, guindaste e configuração, usadas pelas páginas Tabelas e Catálogo. Esta
documentação é a TASK-045.

| Parte | Situação |
|-------|----------|
| Documentação e decisões | contexto do produto, regras de negócio (RN-001..008), requisitos (RF/RNF), ADR-002..013 e ADR-016/017 aceitos, ADR-014 (ORM) proposto, ADR-015 (consulta conservadora) aceito como provisório |
| Backend | Clean Architecture: domínio (tabela de carga, geometria do ADR-013, carga, consulta conservadora provisória do ADR-015, usuário), casos de uso (avaliação, cadastro, importação com gravação, ativação, login, gestão de usuários), PostgreSQL com SQLAlchemy + Alembic, storage local do arquivo-fonte, importação CSV/XLSX, API REST e WebSocket. Com banco, o **login é obrigatório**, com perfis `ADMIN`/`OPERATOR` (ADR-016): sessão em cookie `HttpOnly`, cabeçalho anti-CSRF, WebSocket com a mesma sessão, gestão de usuários pelo admin e primeiro admin por `python -m app.create_admin` |
| Frontend | casca com trilho de navegação e barra superior, tema escuro próprio (ADR-017); páginas Login, Início, Simulador guiado (passos Guindaste → Carga → Posição sobre a cena, resultado do backend com medidor), Catálogo (com edição e tabela ativa), Tabelas (validação prévia, matriz, linha do tempo de versões e ativação) e Usuários (só admin); guardas de rota por perfil; cena Three.js com céu, grade, sombras, anel de raio, carga no gancho, cores de situação e quatro câmeras, desenhada sob demanda; modelo GLB do guindaste sobre caminhão carregado em segundo plano, com o guindaste provisório como reserva |
| Infra | Docker Compose com `postgres`, `backend` (com volume para o arquivo-fonte) e `frontend` (nginx); seed de demonstração FICTÍCIO (`python -m app.demo_seed`, ficha com a = −1,56 m, igual ao modelo); CI com estrutura, backend (com PostgreSQL de serviço), frontend, imagens Docker e E2E (Playwright contra a stack, entrando com um admin só de CI) |

A capacidade mostrada vem da consulta **conservadora provisória** (ADR-015: entre dois pontos da
tabela, vale o de menor capacidade). Carga igual à capacidade (100 %) aparece como dentro do limite
(P-005). Interpolação, arredondamento, níveis de alerta e formato das tabelas da empresa continuam
pendentes com a Guindastes Ribas: ver [`docs/business-rules.md`](docs/business-rules.md) →
"Perguntas em aberto" e [`docs/known-gaps.md`](docs/known-gaps.md).

### Capturas

Feitas com dados FICTÍCIOS. As do Início e do simulador são da TASK-039 e ainda mostram a cena
**anterior** à TASK-041, sem o modelo do caminhão. As da cena escura com o modelo foram feitas com a
cena montada à parte, fora das páginas.

| Tela | Arquivo |
|------|---------|
| Início (1440×900) | [`inicio-1440x900.png`](docs/assets/screenshots/inicio-1440x900.png) |
| Simulador guiado, dentro da capacidade (1440×900) | [`simulador-1440x900.png`](docs/assets/screenshots/simulador-1440x900.png) |
| Simulador guiado, acima da capacidade | [`simulador-acima-da-capacidade-1440x900.png`](docs/assets/screenshots/simulador-acima-da-capacidade-1440x900.png) |
| Cena clara (prancha técnica) com o modelo, carga dentro da capacidade | [`cena-3d/dentro-perspectiva.png`](docs/assets/screenshots/cena-3d/dentro-perspectiva.png) |
| Cena clara com as zonas de giro, acima da capacidade, vista de topo | [`cena-3d/zonas-topo.png`](docs/assets/screenshots/cena-3d/zonas-topo.png) |
| Modelo do guindaste com a lança estendida | [`modelo-3d/05-lanca-estendida.png`](docs/assets/screenshots/modelo-3d/05-lanca-estendida.png) |

As demais ficam em `docs/assets/screenshots/`: Início e simulador em 1280×720, as cinco
situações/câmeras em `cena-3d/` e as oito poses do modelo em `modelo-3d/`.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Three.js (Vite, Node 24, npm); React Router, ícones `lucide-react` e fontes locais (ADR-017); componentes próprios em CSS Modules |
| Backend | Python 3.14 + FastAPI (uv), Clean Architecture |
| Banco | PostgreSQL 18, SQLAlchemy 2 + psycopg 3, migrations com Alembic |
| Autenticação | sessão opaca no banco + cookie `HttpOnly`, senhas com Argon2id (`argon2-cffi`; ADR-016) |
| Formato 3D | GLB/glTF |
| Comunicação | REST + WebSocket |

Decisões em [`docs/decisions/`](docs/decisions/README.md) (ADR-002..017).

## Estrutura do repositório

```text
.
├── backend/          ← API FastAPI em Clean Architecture (domain, application, infrastructure, presentation);
│                        raiz de composição em app/main.py; migrations em alembic/; Dockerfile
├── frontend/         ← SPA React + Three.js (a lógica 3D fica em src/three/); testes E2E em e2e/;
│                        modelo do caminhão em public/models/; conversor do modelo em scripts/;
│                        Dockerfile e nginx.conf.template
├── assets/
│   ├── example-models/ ← GLB de exemplo FICTÍCIO do guindaste provisório
│   └── source/         ← FBX de origem do modelo, só local (no .gitignore)
├── docker-compose.yml ← stack local: postgres + backend + frontend
├── docs/             ← produto, arquitetura, regras de negócio, requisitos, ADRs, guias;
│                        capturas de tela em assets/screenshots/
│   └── produto/      ← documentação técnica original (v0.1) e diagramas, congelados
├── tasks/            ← tarefas: backlog/, in-progress/, completed/
├── handoffs/         ← continuidade entre agentes/pessoas (current.md é o índice)
├── scripts/          ← check-structure.sh (validação do protocolo, usado pelo CI)
└── .github/          ← CI (estrutura, backend, frontend, imagens Docker, E2E) e templates de PR/issue
```

## Como rodar

Pré-requisitos, variáveis de ambiente e todos os comandos oficiais:
[`docs/development-guide.md`](docs/development-guide.md). Roteiro de demonstração, com dados
FICTÍCIOS: [`docs/demo.md`](docs/demo.md).

### Com Docker (stack completa)

Na raiz, com o Docker rodando:

```bash
cp .env.example .env                                   # preencha POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
                                                       # e SESSION_COOKIE_SECURE=false (stack local em HTTP)
docker compose up -d --build                           # constrói e sobe postgres, backend e frontend
docker compose ps                                      # pronto quando os três estiverem "healthy"
docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"
                                                       # migrations + demonstração FICTÍCIA (idempotente)
docker compose run --rm backend python -m app.create_admin --username admin
                                                       # primeiro admin; pede a senha duas vezes, sem eco
# frontend: http://127.0.0.1:8080/    API/OpenAPI: http://127.0.0.1:8000/docs
docker compose down                                    # para tudo e mantém os volumes (não use -v)
```

O nginx do frontend encaminha `/api/` (inclusive o WebSocket) para o backend. No container, o
`FILE_STORAGE_DIR` é fixo (`/data/load-charts`, no volume `ja-guindastes_load-chart-files`); o do
`.env` vale só para o backend fora do container. Só as migrations, sem o seed:
`docker compose run --rm backend alembic upgrade head`.

### Primeiro admin e login

Com banco, a tela e a API exigem login (ADR-016). Não há cadastro aberto:

- o **primeiro admin** é criado no servidor por `python -m app.create_admin --username <nome>
  [--display-name <nome>]`. A senha (10 a 128 caracteres) vem de `ADMIN_PASSWORD` ou é pedida sem
  eco, nunca por argumento. O comando é idempotente: se o usuário já existe, não muda nada;
- os demais usuários, com perfil `ADMIN` ou `OPERATOR`, são criados pelo admin na página **Usuários**;
- a sessão vale 8 h, no cookie `crane_session`. Com `SESSION_COOKIE_SECURE=true` (o padrão), o
  navegador só devolve o cookie em HTTPS. Por isso a stack local em HTTP precisa de
  `SESSION_COOKIE_SECURE=false` (**nunca** em produção). Depois de mudar o `.env`, recrie o backend
  com `docker compose up -d backend`.

O `OPERATOR` consulta o catálogo e as tabelas, valida um arquivo sem gravar e avalia. O `ADMIN`
também cadastra, importa e ativa tabelas e gerencia usuários. Login pela API com `curl`:
[`docs/demo.md`](docs/demo.md) § 3.1.

### Sem Docker (backend e frontend na máquina)

```bash
# banco: só o serviço postgres do Compose (ou outro PostgreSQL 18)
docker compose up -d postgres

# backend (em backend/), com DATABASE_URL e, se quiser as rotas de importação, FILE_STORAGE_DIR
uv sync --locked
set -a && source ../.env && set +a      # o backend não lê o .env sozinho
uv run alembic upgrade head
uv run python -m app.demo_seed          # opcional: demonstração FICTÍCIA (exige FILE_STORAGE_DIR)
uv run python -m app.create_admin --username admin   # primeiro admin (com SESSION_COOKIE_SECURE=false no .env)
uv run uvicorn app.main:app --reload    # OpenAPI em http://localhost:8000/docs

# frontend (em frontend/); o Vite encaminha /api (e o WebSocket) para localhost:8000
npm ci
npm run dev
```

Sem `DATABASE_URL`, a API sobe em modo "persistência não configurada": a avaliação responde
`NOT_EVALUABLE`, a saúde mostra `NOT_CONFIGURED`, as rotas de catálogo e de tabelas gravadas não
são registradas e **não há login**: as rotas que existem ficam abertas, e a tela avisa "modo sem
autenticação". Serve só para desenvolvimento.

Antes de abrir um PR, rode o comando único da § 3 do guia (estrutura + gates do backend e do frontend).

## Rotas principais da API

Todas sob `/api/v1`. Com `DATABASE_URL`, toda rota exige sessão, menos `GET /health` e
`GET /auth/session`. Escrever (cadastros, importação, ativação, usuários) exige o perfil `ADMIN`, e
todo `POST`/`PUT`/`PATCH`/`DELETE` exige o cabeçalho `X-Requested-With: crane-simulator` (ADR-016).
Contrato completo em `/docs` (OpenAPI) com a API no ar.

| Rota | O que faz | Disponível |
|------|-----------|------------|
| `GET /health` | saúde do processo e do banco (`UP`, `DOWN` ou `NOT_CONFIGURED`) | sempre |
| `POST /evaluations` | avalia um estado operacional: geometria, capacidade (ADR-015), utilização e motivos | sempre |
| `WS /ws/evaluation` | a mesma avaliação por WebSocket (`simulation.state.changed` → `simulation.evaluated`, com `sequence`) | sempre |
| `POST /load-charts/validate` | valida uma tabela CSV sem gravar | sempre |
| `POST /manufacturers`, `/cranes`, `/cranes/{id}/configurations` e os `GET` correspondentes | cadastro e leitura de fabricantes, guindastes e configurações (com a ficha técnica geométrica) | com `DATABASE_URL` |
| `PATCH /manufacturers/{id}`, `/cranes/{id}`, `/configurations/{id}` | edita o nome do fabricante, o modelo do guindaste e o nome e/ou a ficha técnica inteira da configuração (vale para as próximas avaliações; as tabelas não mudam); só `ADMIN` | com `DATABASE_URL` |
| `GET /configurations/{id}/load-charts` | lista as tabelas de uma configuração, sem os pontos, com `active_chart_id`; da maior versão para a menor (não há data de importação gravada) | com `DATABASE_URL` |
| `POST /load-charts/import`, `GET /load-charts/{id}`, `POST /load-charts/{id}/activate` | importa CSV/XLSX gravando a tabela e o arquivo-fonte, consulta e ativa a tabela | com `DATABASE_URL` e `FILE_STORAGE_DIR` |
| `GET /auth/session`, `POST /auth/login`, `POST /auth/logout` | sessão atual (`authEnabled: false` sem banco), login com cookie e logout | `GET /auth/session` sempre; login e logout com `DATABASE_URL` |
| `GET /users`, `POST /users`, `PATCH /users/{id}` | listar, criar e editar usuários (nome, perfil, ativo, senha); só `ADMIN` | com `DATABASE_URL` |

## Como o trabalho é organizado

O projeto é desenvolvido com apoio de agentes de IA, seguindo um protocolo baseado em arquivos
versionados:

- [`AGENTS.md`](AGENTS.md) — regras para qualquer agente (e pessoa) antes de tocar no código;
- [`tasks/`](tasks/README.md) — uma tarefa por arquivo, com critérios de aceite; até 15 em paralelo;
- [`handoffs/`](handoffs/README.md) — onde o trabalho parou, um handoff por tarefa;
- branches `task/TASK-NNN-<slug>` → PR para `development` (squash); promoção para `homologation` e
  `production` por decisão da pessoa responsável ([ADR-002](docs/decisions/ADR-002-modelo-de-branches-por-ambiente.md));
- agentes acionados manualmente ou por orquestrador local via CLIs de assinatura, sem API paga
  ([ADR-003](docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md)).

## Documentação

- [`docs/README.md`](docs/README.md) — índice
- [`docs/architecture.md`](docs/architecture.md) — componentes, páginas do frontend, fluxos de avaliação e de login, modelo de dados
- [`docs/development-guide.md`](docs/development-guide.md) — instalação, comandos, variáveis, problemas comuns
- [`docs/testing-strategy.md`](docs/testing-strategy.md) — testes e gates do CI
- [`docs/security.md`](docs/security.md) — login, perfis, sessão, CSRF e superfície de ataque
- [`docs/known-gaps.md`](docs/known-gaps.md) — o que ainda não funciona ou está provisório
- [`docs/demo.md`](docs/demo.md) — roteiro de demonstração com dados FICTÍCIOS
- [`docs/requirements/`](docs/requirements/README.md) — RF-001..024 e RNF-001..012
- [`docs/produto/documentacao-tecnica-v0.1.md`](docs/produto/documentacao-tecnica-v0.1.md) — documentação técnica original

## Licença

A definir pela equipe do projeto.
