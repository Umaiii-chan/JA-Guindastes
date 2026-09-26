# Simulador Web 3D para Análise de Tabelas de Carga de Guindastes

Ferramenta web interativa para posicionar um guindaste e uma carga num cenário 3D, calcular os
parâmetros operacionais (raio de trabalho, altura, comprimento de lança) e obter a capacidade
admissível e os alertas **a partir da tabela de carga oficial** da configuração selecionada.

Projeto acadêmico do curso de Engenharia de Software (2º semestre de 2026), com a empresa parceira
**Guindastes Ribas Ltda.** Detalhes em [`docs/project-overview.md`](docs/project-overview.md).

> **Premissa de segurança:** é uma ferramenta de **planejamento e análise**, não de certificação de
> içamentos reais. O sistema não inventa capacidade fora do domínio conhecido da tabela (RN-004, RN-007).
> Todos os dados de exemplo do repositório são **FICTÍCIOS** (ADR-012): ainda não há tabela de carga
> oficial nem modelo 3D real.

---

## Estado atual (2026-09-26, `development` @ `d58edf6`)

Concluídas as tarefas TASK-001..032. Em andamento, na última leva: telas de catálogo e de
importação (TASK-033/034), demo reproduzível (TASK-035), testes ponta a ponta (TASK-036) e esta
documentação (TASK-037).

| Parte | Situação |
|-------|----------|
| Documentação e decisões | contexto do produto, regras de negócio (RN-001..008), requisitos (RF/RNF), ADR-002..013 aceitos, ADR-014 (ORM) proposto, ADR-015 (consulta conservadora) aceito como provisório |
| Backend | Clean Architecture: domínio (tabela de carga, geometria do ADR-013, carga, consulta conservadora provisória do ADR-015), casos de uso (avaliação, cadastro, importação com gravação, ativação), PostgreSQL com SQLAlchemy + Alembic, storage local do arquivo-fonte, importação CSV/XLSX, API REST e WebSocket |
| Frontend | cena Three.js com guindaste provisório (FICTÍCIO) e `CraneController`, geometria de pré-visualização, loader GLB/glTF com mapeamento cinemático, painel que mostra a avaliação do backend (WebSocket, com REST de reserva) |
| Infra | Docker Compose com `postgres`, `backend` e `frontend` (nginx); CI com estrutura, backend (com PostgreSQL de serviço), frontend e imagens Docker |

A capacidade mostrada vem da consulta **conservadora provisória** (ADR-015: entre dois pontos da
tabela, vale o de menor capacidade). Interpolação, arredondamento, níveis de alerta e formato das
tabelas da empresa continuam pendentes com a Guindastes Ribas: ver
[`docs/business-rules.md`](docs/business-rules.md) → "Perguntas em aberto" e
[`docs/known-gaps.md`](docs/known-gaps.md).

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Three.js (Vite, Node 24, npm) |
| Backend | Python 3.14 + FastAPI (uv), Clean Architecture |
| Banco | PostgreSQL 18, SQLAlchemy 2 + psycopg 3, migrations com Alembic |
| Formato 3D | GLB/glTF |
| Comunicação | REST + WebSocket |

Decisões em [`docs/decisions/`](docs/decisions/README.md) (ADR-002..015).

## Estrutura do repositório

```text
.
├── backend/          ← API FastAPI em Clean Architecture (domain, application, infrastructure, presentation);
│                        raiz de composição em app/main.py; migrations em alembic/; Dockerfile
├── frontend/         ← SPA React + Three.js (a lógica 3D fica em src/three/); Dockerfile e nginx.conf.template
├── assets/
│   └── example-models/ ← GLB de exemplo FICTÍCIO do guindaste provisório
├── docker-compose.yml ← stack local: postgres + backend + frontend
├── docs/             ← produto, arquitetura, regras de negócio, requisitos, ADRs, guias
│   └── produto/      ← documentação técnica original (v0.1) e diagramas, congelados
├── tasks/            ← tarefas: backlog/, in-progress/, completed/
├── handoffs/         ← continuidade entre agentes/pessoas (current.md é o índice)
├── scripts/          ← check-structure.sh (validação do protocolo, usado pelo CI)
└── .github/          ← CI (estrutura, backend, frontend, imagens Docker) e templates de PR/issue
```

## Como rodar

Pré-requisitos, variáveis de ambiente e todos os comandos oficiais:
[`docs/development-guide.md`](docs/development-guide.md). Roteiro de demonstração: `docs/demo.md`
(criado pela TASK-035).

### Com Docker (stack completa)

Na raiz, com o Docker rodando:

```bash
cp .env.example .env                                   # preencha POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
docker compose up -d --build                           # constrói e sobe postgres, backend e frontend
docker compose ps                                      # pronto quando os três estiverem "healthy"
docker compose run --rm backend alembic upgrade head   # aplica as migrations (sob demanda)
# frontend: http://127.0.0.1:8080/    API/OpenAPI: http://127.0.0.1:8000/docs
docker compose down                                    # para tudo e mantém o volume (não use -v)
```

O nginx do frontend encaminha `/api/` (inclusive o WebSocket) para o backend. Em `d58edf6`, o
`docker-compose.yml` ainda não passa `FILE_STORAGE_DIR` ao backend: as rotas de importação com
gravação e ativação só aparecem rodando o backend fora do container (ajuste do Docker previsto na
TASK-035).

### Sem Docker (backend e frontend na máquina)

```bash
# banco: só o serviço postgres do Compose (ou outro PostgreSQL 18)
docker compose up -d postgres

# backend (em backend/), com DATABASE_URL e, se quiser as rotas de importação, FILE_STORAGE_DIR
uv sync --locked
set -a && source ../.env && set +a      # o backend não lê o .env sozinho
uv run alembic upgrade head
uv run uvicorn app.main:app --reload    # OpenAPI em http://localhost:8000/docs

# frontend (em frontend/); o Vite encaminha /api (e o WebSocket) para localhost:8000
npm ci
npm run dev
```

Sem `DATABASE_URL`, a API sobe em modo "persistência não configurada": a avaliação responde
`NOT_EVALUABLE`, a saúde mostra `NOT_CONFIGURED`, e as rotas de catálogo e de tabelas gravadas não
são registradas.

Antes de abrir um PR, rode o comando único da § 3 do guia (estrutura + gates do backend e do frontend).

## Rotas principais da API

Todas sob `/api/v1`, sem autenticação (P-009; só para uso local). Contrato completo em `/docs`
(OpenAPI) com a API no ar.

| Rota | O que faz | Disponível |
|------|-----------|------------|
| `GET /health` | saúde do processo e do banco (`UP`, `DOWN` ou `NOT_CONFIGURED`) | sempre |
| `POST /evaluations` | avalia um estado operacional: geometria, capacidade (ADR-015), utilização e motivos | sempre |
| `WS /ws/evaluation` | a mesma avaliação por WebSocket (`simulation.state.changed` → `simulation.evaluated`, com `sequence`) | sempre |
| `POST /load-charts/validate` | valida uma tabela CSV sem gravar | sempre |
| `POST /manufacturers`, `/cranes`, `/cranes/{id}/configurations` e os `GET` correspondentes | cadastro e leitura de fabricantes, guindastes e configurações (com a ficha técnica geométrica) | com `DATABASE_URL` |
| `POST /load-charts/import`, `GET /load-charts/{id}`, `POST /load-charts/{id}/activate` | importa CSV/XLSX gravando a tabela e o arquivo-fonte, consulta e ativa a tabela | com `DATABASE_URL` e `FILE_STORAGE_DIR` |

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
- [`docs/architecture.md`](docs/architecture.md) — componentes, fluxo de avaliação, modelo de dados
- [`docs/development-guide.md`](docs/development-guide.md) — instalação, comandos, variáveis, problemas comuns
- [`docs/testing-strategy.md`](docs/testing-strategy.md) — testes e gates do CI
- [`docs/known-gaps.md`](docs/known-gaps.md) — o que ainda não funciona ou está provisório
- [`docs/requirements/`](docs/requirements/README.md) — RF-001..024 e RNF-001..012
- [`docs/produto/documentacao-tecnica-v0.1.md`](docs/produto/documentacao-tecnica-v0.1.md) — documentação técnica original

## Licença

A definir pela equipe do projeto.
