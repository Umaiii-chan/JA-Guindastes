# ADR-012 — Toolchain de desenvolvimento do backend e do frontend

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), sessão de 2026-09-26, registrando a escolha da pessoa responsável |
| **Decisores** | Anderson Sehnem (escolheu as opções em chat, em 2026-09-26) |
| **Tarefa relacionada** | TASK-004 |
| **Substitui** | — |

## Contexto

Os ADR-004..011 fixam a stack (FastAPI + Python, React + TypeScript + Three.js, PostgreSQL), mas nem
eles nem a doc-fonte definem versões, gerenciadores de pacotes, ferramentas de teste, lint, tipos e
migrations (`docs/development-guide.md` estava com "A VALIDAR"). Sem isso, nenhum esqueleto de código
nem gate de CI pode ser criado.

Ferramentas verificadas na máquina da pessoa em 2026-09-26: Node v24.19.0, npm 11.17.0, uv 0.12.18
(com CPython 3.14.7 gerenciado), Docker 29.8.0 e Git 2.55.0.

## Decisão

A pessoa responsável escolheu, em chat, as opções recomendadas:

**Backend** (`backend/`):
- Python **3.14**, com dependências e ambiente gerenciados por **uv** (`pyproject.toml` + `uv.lock` versionado);
- **ruff** para lint e formatação; **mypy** em modo `strict` para tipos;
- **pytest** para testes;
- **import-linter** para verificar as regras de dependência da Clean Architecture (ADR-004, RNF-002);
- **Alembic** para migrations, quando a persistência entrar.

**Frontend** (`frontend/`, a criar na TASK-005):
- Node **24** LTS com **npm**;
- **Vite** + React + TypeScript;
- **Three.js puro**, com controllers/adapters próprios para a cena (ADR-005), sem React Three Fiber;
- **Vitest** para testes; **ESLint** e **Prettier**.

**CI:** cada serviço tem um job no `.github/workflows/ci.yml` que roda os mesmos comandos de
`docs/development-guide.md` § 3. A alteração do arquivo protegido foi autorizada pela pessoa em chat.

**Dados de teste:** até a tabela oficial chegar, os testes do motor de cálculo podem usar dados
fictícios, rotulados como FICTÍCIO, só para testar o mecanismo e nunca como capacidade real (decisão da
pessoa em chat; responde a P-007 de `docs/known-gaps.md`, parte "dados fictícios").

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Python 3.14 + uv; Node 24 + npm + Vite; Three.js puro (escolhida)** | versões já instaladas; uv e npm dispensam instalação extra; Three.js puro respeita o ADR-005 | Python 3.14 é a versão mais nova, e alguma dependência futura pode demorar a suportá-la | — |
| Python 3.13 + uv | versão mais conservadora | exige baixar outra versão | a pessoa preferiu a já instalada |
| Poetry no lugar do uv | ferramenta conhecida | mais lenta; exige instalação | a pessoa preferiu uv |
| pnpm no lugar do npm | instalação mais rápida e estrita | exige instalação | a pessoa preferiu npm |
| React Three Fiber | integração declarativa com React | coloca a lógica 3D nos componentes, contra a regra do ADR-005 | conflita com o ADR-005 |

## Consequências

**Positivas:**
- gates determinísticos e iguais no local e no CI;
- a regra de camadas da Clean Architecture passa a ser verificada por máquina, não só por revisão.

**Negativas / custos:**
- dois ecossistemas (Python e Node) para manter no monorepo.

**Riscos e como mitigar:**
- *Dependência sem suporte a Python 3.14* → trocar a versão é um novo ADR; o `uv.lock` mostra exatamente o que foi resolvido.
- *Dados fictícios confundidos com reais* → rótulo FICTÍCIO obrigatório nos arquivos e nos nomes dos testes.

## Impacto na documentação

- [x] `docs/architecture.md` § 8
- [x] `docs/development-guide.md` §§ 1–3 (comandos do backend; frontend continua "A VALIDAR" até a TASK-005)
- [x] `docs/known-gaps.md` (P-007, parte "dados fictícios")
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** versões das ferramentas locais (comandos `--version` em 2026-09-26); os gates do
  backend rodaram localmente na TASK-004 (saída no handoff).
- **Hipótese:** compatibilidade de dependências futuras (SQLAlchemy, driver PostgreSQL, Alembic) com
  Python 3.14 não foi testada, porque elas ainda não entraram no projeto.
