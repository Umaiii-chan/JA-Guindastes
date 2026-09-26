# Simulador Web 3D para Análise de Tabelas de Carga de Guindastes

Ferramenta web interativa para posicionar um guindaste e uma carga num cenário 3D, calcular os
parâmetros operacionais (raio de trabalho, altura, comprimento de lança) e obter a capacidade
admissível e os alertas **a partir da tabela de carga oficial** da configuração selecionada.

Projeto acadêmico do curso de Engenharia de Software (2º semestre de 2026), com a empresa parceira
**Guindastes Ribas Ltda.** Detalhes em [`docs/project-overview.md`](docs/project-overview.md).

> **Premissa de segurança:** é uma ferramenta de **planejamento e análise**, não de certificação de
> içamentos reais. O sistema não inventa capacidade fora do domínio conhecido da tabela (RN-004, RN-007).

---

## Estado atual (2026-09-26)

| Parte | Situação |
|-------|----------|
| Documentação e decisões | contexto do produto, regras de negócio (RN-001..008), requisitos (RF/RNF) e ADR-003..012 aceitos; ADR-013 (geometria) proposto |
| Backend | esqueleto em Clean Architecture e núcleo de domínio da tabela de carga (consulta só por ponto exato; interpolação pendente com a empresa) |
| Frontend | esqueleto Vite + React + TypeScript + Three.js |
| CI | estrutura, backend e frontend verificados a cada PR |

O que ainda depende da Guindastes Ribas (método de interpolação, níveis de alerta, formato das
tabelas, modelo 3D real) está em [`docs/business-rules.md`](docs/business-rules.md) → "Perguntas em
aberto" e em [`docs/known-gaps.md`](docs/known-gaps.md).

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Three.js (Vite, Node 24, npm) |
| Backend | Python 3.14 + FastAPI (uv), Clean Architecture |
| Banco | PostgreSQL |
| Formato 3D | GLB/glTF preparado |
| Comunicação | REST + WebSocket |

Decisões em [`docs/decisions/`](docs/decisions/README.md) (ADR-004..012).

## Estrutura do repositório

```text
.
├── backend/        ← API FastAPI em Clean Architecture (domain, application, infrastructure, presentation)
├── frontend/       ← SPA React + Three.js (a lógica 3D fica em src/three/)
├── docs/           ← produto, arquitetura, regras de negócio, requisitos, ADRs, guias
│   └── produto/    ← documentação técnica original (v0.1) e diagramas, congelados
├── tasks/          ← tarefas: backlog/, in-progress/, completed/
├── handoffs/       ← continuidade entre agentes/pessoas (current.md é o índice)
├── scripts/        ← check-structure.sh (validação do protocolo, usado pelo CI)
└── .github/        ← CI (estrutura, backend, frontend) e templates de PR/issue
```

## Como rodar

Pré-requisitos e todos os comandos oficiais: [`docs/development-guide.md`](docs/development-guide.md).

```bash
# backend (em backend/)
uv sync --locked
uv run uvicorn app.presentation.api.main:app --reload   # OpenAPI em http://localhost:8000/docs

# frontend (em frontend/)
npm ci
npm run dev
```

Antes de abrir um PR, rode o comando único da § 3 do guia (estrutura + gates do backend e do frontend).

## Como o trabalho é organizado

O projeto é desenvolvido com apoio de agentes de IA, seguindo um protocolo baseado em arquivos
versionados:

- [`AGENTS.md`](AGENTS.md) — regras para qualquer agente (e pessoa) antes de tocar no código;
- [`tasks/`](tasks/README.md) — uma tarefa por arquivo, com critérios de aceite; até 4 em paralelo;
- [`handoffs/`](handoffs/README.md) — onde o trabalho parou, um handoff por tarefa;
- branches `task/TASK-NNN-<slug>` → PR para `development` (squash); promoção para `homologation` e
  `production` por decisão da pessoa responsável ([ADR-002](docs/decisions/ADR-002-modelo-de-branches-por-ambiente.md));
- agentes acionados manualmente ou por orquestrador local via CLIs de assinatura, sem API paga
  ([ADR-003](docs/decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md)).

## Documentação

- [`docs/README.md`](docs/README.md) — índice
- [`docs/architecture.md`](docs/architecture.md) — arquitetura e fluxo de avaliação em tempo real
- [`docs/requirements/`](docs/requirements/README.md) — RF-001..024 e RNF-001..012
- [`docs/produto/documentacao-tecnica-v0.1.md`](docs/produto/documentacao-tecnica-v0.1.md) — documentação técnica original

## Licença

A definir pela equipe do projeto.
