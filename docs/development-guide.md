# Guia de desenvolvimento

> **Status deste documento:** parcial (2026-09-26). Os comandos do **backend** são reais (TASK-004,
> ADR-012). Os do **frontend** também (TASK-007). Os do **banco local e do Alembic** também
> (TASK-011). Os comandos listados aqui são os **únicos** que os agentes devem executar. Se um comando
> não está aqui, ou está "A VALIDAR", o agente pergunta antes de rodar.
> Mantenha este documento sincronizado com o CI (`.github/workflows/ci.yml`): os dois devem rodar
> os mesmos comandos.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 |
| Stack | Python 3.14 + FastAPI, uv (backend) / Node 24 + TypeScript + React + Three.js, npm + Vite (frontend) / PostgreSQL 18 no Docker Compose, SQLAlchemy 2 + psycopg 3 + Alembic (persistência) — ADR-007, ADR-012 |

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar / verificar |
|------------|--------|---------------------------|
| Git | 2.x | `git --version` |
| Bash (Git Bash no Windows) | — | necessário para `scripts/check-structure.sh` |
| uv (gerencia o Python e as dependências do backend) | 0.12+ | `uv --version`; instala o Python 3.14 sozinho a partir de `backend/.python-version` |
| Node.js + npm (frontend) | Node 24 LTS, npm 11 | `node --version`, `npm --version` |
| Docker + Docker Compose (PostgreSQL local; só para rodar o banco e os testes de integração) | Docker 29, Compose v2 ou mais novo (instalados na máquina de desenvolvimento: Docker 29.8.0, Compose v5.5.1) | `docker --version`, `docker compose version`; no Windows, o Docker Desktop precisa estar rodando (ver § 9) |

---

## 2. Instalação

```bash
# clonar
git clone https://github.com/Umaiii-chan/JA-Guindastes.git
cd JA-Guindastes

# instalar dependências do backend
cd backend && uv sync --locked && cd ..
cd frontend && npm ci && cd ..

# configurar ambiente
cp .env.example .env
# edite .env com valores locais (nunca commitar): POSTGRES_* e DATABASE_URL (ver § 6)

# subir o banco local e aplicar as migrations (precisa do Docker rodando)
docker compose up -d
cd backend && set -a && source ../.env && set +a && uv run alembic upgrade head && cd ..
```

---

## 3. Comandos do dia a dia

**Estes comandos são a referência oficial.** O CI e os agentes usam exatamente estes.

| Ação | Comando | Observações |
|------|---------|-------------|
| Rodar o backend em desenvolvimento | `uv run uvicorn app.presentation.api.main:app --reload` | em `backend/`; OpenAPI em `/docs` |
| Rodar testes (backend) | `uv run pytest` | em `backend/`; ver [`testing-strategy.md`](testing-strategy.md) e doc-fonte § 20 |
| Rodar um teste específico (backend) | `uv run pytest tests/<arquivo>.py::<teste>` | em `backend/` |
| Lint (backend) | `uv run ruff check .` | em `backend/` |
| Formatação — verificar (backend) | `uv run ruff format --check .` | em `backend/` |
| Formatação — corrigir (backend) | `uv run ruff format .` | em `backend/` |
| Verificação de tipos (backend) | `uv run mypy app` | em `backend/`; modo strict (RNF-008) |
| Regras de camadas (backend) | `uv run lint-imports` | em `backend/`; contratos em `backend/pyproject.toml` (ADR-004, RNF-002) |
| Rodar o frontend em desenvolvimento | `npm run dev` | em `frontend/` (Vite) |
| Rodar testes (frontend) | `npm test` | em `frontend/`; Vitest, testes em `frontend/tests/` |
| Rodar um teste específico (frontend) | `npx vitest run tests/<caminho>.test.ts` | em `frontend/` |
| Lint (frontend) | `npm run lint` | em `frontend/`; ESLint, inclui a regra "Three.js só em `src/three/`" (ADR-005) |
| Formatação — verificar (frontend) | `npm run format:check` | em `frontend/`; Prettier |
| Formatação — corrigir (frontend) | `npm run format` | em `frontend/` |
| Verificação de tipos (frontend) | `npm run typecheck` | em `frontend/`; `tsc -b` com `strict` |
| Build (frontend) | `npm run build` | em `frontend/`; saída em `frontend/dist/` |
| Subir o banco local (PostgreSQL 18) | `docker compose up -d` | na raiz; lê o `.env` da raiz; pronto quando `docker compose ps` mostrar `healthy`; porta só em `127.0.0.1` |
| Ver o estado do banco local | `docker compose ps` | na raiz |
| Parar o banco local (mantém os dados) | `docker compose down` | na raiz; **não** use `down -v`: o `-v` apaga o volume `ja-guindastes_postgres-data` com os dados |
| Exportar as variáveis do `.env` no shell | `set -a && source ../.env && set +a` | em `backend/`, no Bash/Git Bash; o backend, o Alembic e o pytest **não** leem o `.env` sozinhos (§ 6) |
| Migrations (aplicar) | `uv run alembic upgrade head` | em `backend/`, com `DATABASE_URL` exportada e o banco no ar; ainda não há nenhuma revisão (as tabelas entram com cada caso de uso) |
| Migrations (criar) | `uv run alembic revision --autogenerate -m "<descrição>"` | em `backend/`, com o banco no ar; compara o banco com `Base.metadata` (os modelos precisam estar importados em `backend/alembic/env.py`); o arquivo sai em `backend/alembic/versions/` já passado pelo `ruff format` e `ruff check --fix`; **revise-o** antes de commitar |
| Migrations (gerar o SQL sem conectar) | `uv run alembic upgrade head --sql` | em `backend/`; só precisa de `DATABASE_URL` definida |
| Testes de integração com banco | `uv run pytest -m integration` | em `backend/`, com o banco no ar e `DATABASE_URL` exportada; sem isso, são pulados (é o que acontece no CI, que ainda não tem banco) |
| Auditoria de dependências | A VALIDAR | ver [`security.md`](security.md) § 5 |
| Validar estrutura do repo | `bash scripts/check-structure.sh` | universal, já funciona |

Os comandos que precisam do banco no ar (`docker compose up -d`, `alembic upgrade head` conectado e
`pytest -m integration` com banco) foram escritos na TASK-011, mas **ainda não rodaram contra um banco
real**: na máquina de desenvolvimento o Docker não subiu por falta de virtualização (ver § 9 e o
handoff da TASK-011). O modo sem conexão (`alembic upgrade head --sql`) e os testes sem banco rodaram.

Comando único que roda tudo antes de abrir PR:

```bash
bash scripts/check-structure.sh && (cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run lint-imports && uv run pytest)
(cd frontend && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build)
```

---

## 4. Estrutura de pastas do código

Estrutura **planejada** (doc-fonte § 9, adaptada à raiz deste repositório). Nada disso existe ainda.

```text
frontend/
├── src/
│   ├── app/             ← bootstrap, router, providers
│   ├── domain/          ← tipos e regras locais independentes da UI
│   ├── application/     ← casos de uso do cliente / orquestração
│   ├── infrastructure/  ← api/ e websocket/
│   ├── presentation/    ← pages/, components/, panels/
│   └── three/           ← scene/, camera/, controls/, loaders/, crane/, animation/, collision/
└── tests/
backend/
├── alembic/             ← migrations (env.py, script.py.mako, versions/); config em backend/alembic.ini (existe desde a TASK-011)
├── app/
│   ├── domain/          ← entities/, value_objects/, services/, exceptions/
│   ├── application/     ← ports/, use_cases/
│   ├── infrastructure/  ← database/ (config, engine, Base; TASK-011), repositories/, storage/, importers/
│   └── presentation/    ← api/, websocket/
└── tests/
assets/example-models/   ← modelos 3D de exemplo
docker-compose.yml       ← ambiente local; hoje só o serviço postgres (existe desde a TASK-011)
docker/                  ← imagens e configuração do Docker Compose
docs/                    ← documentação do projeto (este diretório); doc-fonte em docs/produto/
```

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

Variáveis em uso (TASK-011):

| Variável | Quem lê | Obrigatória? | Observação |
|----------|---------|--------------|------------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `docker-compose.yml` (serviço `postgres`) | sim, para `docker compose up` | só valem na primeira subida, quando o volume é criado |
| `POSTGRES_PORT` | `docker-compose.yml` | não (padrão `5432`) | porta do host, publicada só em `127.0.0.1` |
| `DATABASE_URL` | backend (`app/infrastructure/database/config.py`), Alembic (`backend/alembic/env.py`), testes de integração | sim, para o backend e o Alembic | formato `postgresql+psycopg://<usuario>:<senha>@localhost:<porta>/<banco>`, com os mesmos valores de `POSTGRES_*`; outro esquema (`postgresql://`, `sqlite://`...) é recusado com erro claro |

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
| `uv run alembic upgrade head` (ou a aplicação) fica parado mais de 2 minutos e termina com `connection timeout expired` | o banco não está no ar e o psycopg espera o tempo-limite padrão de conexão antes de desistir | subir o banco (`docker compose up -d`) e conferir `docker compose ps`; para falhar mais rápido, acrescentar `?connect_timeout=5` ao fim do `DATABASE_URL` local |

Agentes: ao resolver um problema de ambiente que tomou tempo, adicione uma linha aqui.
