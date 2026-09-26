# Handoff — TASK-011 — implementação (persistência mínima com PostgreSQL)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:35 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-011-persistencia-postgresql.md` |
| **Etapa concluída** | planejamento + testes + implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-011-persistencia-postgresql`, a partir de `ae2ec66` (ver § 5, decisão 1) |
| **Duração aproximada** | ~40 min (dos quais ~10 min esperando o Docker Desktop, que não subiu) |

---

## 1. Objetivo desta etapa

Criar a infraestrutura mínima de persistência (PostgreSQL no Docker Compose, configuração por
`DATABASE_URL`, engine/sessão do SQLAlchemy, `Base` declarativa e Alembic), sem tabelas de negócio.

## 2. O que foi feito

- Verifiquei que a tag `postgres:18` existe (`docker manifest inspect`) e que `postgres:19` não existe
  (`no such manifest`). A imagem `postgres:18` traz `PG_VERSION=18.6-1.pgdg13+2`,
  `PGDATA=/var/lib/postgresql/18/docker` e `VOLUME /var/lib/postgresql` (`docker buildx imagetools inspect`).
- Criei `docker-compose.yml` na raiz: só o serviço `postgres` (`postgres:18`), credenciais de
  `${POSTGRES_USER:?...}`, `${POSTGRES_PASSWORD:?...}`, `${POSTGRES_DB:?...}` (erro claro se faltarem),
  porta `127.0.0.1:${POSTGRES_PORT:-5432}:5432`, volume nomeado `postgres-data` montado em
  `/var/lib/postgresql` e healthcheck com `pg_isready`.
- Acrescentei ao `.env.example` `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` e
  `DATABASE_URL`, todas vazias, com o comentário **na linha de cima** (ver § 5, decisão 9).
- `uv add sqlalchemy alembic "psycopg[binary]"` em `backend/`: SQLAlchemy 2.1.1, Alembic 1.20.0,
  psycopg 3.3.6 + psycopg-binary 3.3.6 (transitivas novas: Mako 1.4.3, MarkupSafe 3.0.3, tzdata 2026.4).
  Verifiquei no `uv.lock` que há wheels `cp314` para Windows (`win_amd64`) e Linux (`manylinux`) de
  SQLAlchemy e psycopg-binary; Alembic e Mako são Python puro. `uv sync --locked` passou.
- Criei em `backend/app/infrastructure/database/`:
  - `config.py`: `DatabaseSettings.from_environment()` lê `DATABASE_URL`; erro
    `DatabaseConfigurationError` se faltar, estiver vazia, não for URL ou não usar `postgresql+psycopg://`.
    Nenhuma mensagem inclui o valor recebido (pode ter senha); o `repr` mascara a senha.
  - `engine.py`: `create_database_engine(settings)` (`pool_pre_ping=True`, sem conectar) e
    `create_session_factory(engine)`.
  - `base.py`: `Base(DeclarativeBase)` com `MetaData(naming_convention=...)`, sem modelos.
- Gerei o Alembic com `uv run alembic init alembic` (template `generic`) e adaptei:
  - `backend/alembic/env.py`: URL vinda de `DatabaseSettings` (config inválida vira `CommandError`, que o
    Alembic mostra como `FAILED: <mensagem>` sem traceback); `target_metadata = Base.metadata`;
    modo online com `NullPool`.
  - `backend/alembic.ini`: sem `sqlalchemy.url`; `prepend_sys_path = %(here)s` (funciona com `-c` de
    outra pasta); hooks pós-geração `ruff format` e `ruff check --fix`; só ASCII (ver § 5, decisão 7).
  - `backend/alembic/script.py.mako`: tipos modernos (`str | Sequence[str] | None`,
    `collections.abc.Sequence`) para passar nas regras `UP` do ruff.
  - `backend/alembic/versions/.gitkeep`; nenhuma revisão. Removi o `README` gerado (uma linha, sem
    conteúdo útil).
- `backend/pyproject.toml`: além das dependências, `[tool.ruff.lint.isort] known-third-party = ["alembic"]`
  (a pasta `backend/alembic/` fazia o ruff tratar o pacote como primeira parte) e o marcador
  `integration` do pytest.
- Testes em `backend/tests/infrastructure/database/` (17 novos; 83 antes, 100 agora):
  - `test_config.py` (10): sem `DATABASE_URL` (ausente, vazia, só espaços), leitura de `os.environ`,
    URL válida, URL inválida sem ecoar o valor, outros drivers recusados, `repr` sem senha.
  - `test_engine.py` (3): engine e sessão criados **sem conectar** (`psycopg.connect` substituído por um
    que falha; host `.invalid`), convenção de nomes na `Base.metadata`.
  - `test_alembic_env.py` (2): `alembic upgrade head --sql` em subprocesso, com e sem `DATABASE_URL`.
  - `test_postgres_integration.py` (2, marcador `integration`): `SELECT 1` pelo engine e pela sessão;
    **pulados** sem `DATABASE_URL` ou sem banco respondendo (sonda com `connect_timeout=3`).
- Testei manualmente o template do Alembic: gerei uma revisão descartável com
  `alembic revision -m "teste descartavel de template"`, conferi que o arquivo gerado passa em
  `ruff check` e `ruff format --check`, e apaguei o arquivo.
- Tentei subir o banco: o Docker Desktop estava parado; rodei `docker desktop start`, o motor não subiu
  (ver § 4 e § 7) e rodei `docker desktop stop` para deixar a máquina como estava.
- Atualizei `docs/development-guide.md` (status, stack, § 1 Docker, § 2 instalação, § 3 comandos do banco
  e do Alembic, § 4 estrutura, § 6 variáveis, § 9 cinco linhas novas, incluindo a do
  `lint-imports >/dev/null` pedida pela pessoa) e `docs/architecture.md` (§ 5 persistência; § 7 linhas
  "local" e "CI").
- Simulei o merge com o `development` atual (`f18dd9e`, que já tem TASK-010, 012, 013 e 014) num
  HEAD desanexado: sem conflitos e com todos os gates verdes (§ 4). Voltei para a branch da tarefa; o
  commit de merge simulado não ficou em nenhuma branch.

## 3. Arquivos modificados

`git diff --stat ae2ec66...HEAD` antes do commit deste handoff:

```text
 .env.example                                       |  22 +++
 backend/alembic.ini                                | 156 +++++++++++++++++++
 backend/alembic/env.py                             |  61 ++++++++
 backend/alembic/script.py.mako                     |  28 ++++
 backend/alembic/versions/.gitkeep                  |   0
 backend/app/infrastructure/database/base.py        |  24 +++
 backend/app/infrastructure/database/config.py      |  62 ++++++++
 backend/app/infrastructure/database/engine.py      |  21 +++
 backend/pyproject.toml                             |  11 ++
 backend/tests/infrastructure/__init__.py           |   0
 backend/tests/infrastructure/database/__init__.py  |   0
 .../infrastructure/database/test_alembic_env.py    |  52 +++++++
 .../tests/infrastructure/database/test_config.py   |  75 +++++++++
 .../tests/infrastructure/database/test_engine.py   |  61 ++++++++
 .../database/test_postgres_integration.py          |  49 ++++++
 backend/uv.lock                                    | 169 +++++++++++++++++++++
 docker-compose.yml                                 |  33 ++++
 docs/architecture.md                               |  10 +-
 docs/development-guide.md                          |  50 +++++-
 .../TASK-011-persistencia-postgresql.md            | 151 ++++++++++++++++++
 20 files changed, 1025 insertions(+), 10 deletions(-)
```

Mais `handoffs/TASK-011.md` (este arquivo) e um ajuste de redação em `docs/development-guide.md` § 1,
no commit do handoff.

Fora do escopo: nenhum. `backend/tests/infrastructure/__init__.py` também foi criado pela TASK-010 (já
em `development`); os dois são vazios e o merge simulado não teve conflito.

## 4. Comandos executados e resultados

Todos em `backend/`, na branch da tarefa, salvo indicação.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `docker manifest inspect postgres:18` | ✅ | índice OCI com manifest `linux/amd64` (tag existe) |
| `docker manifest inspect postgres:19` | ✅ (esperado falhar) | `no such manifest: docker.io/library/postgres:19` |
| `uv sync --locked` | ✅ | `Resolved 48 packages` / `Checked 45 packages` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `49 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 33 source files` |
| `uv run lint-imports` (com `PYTHONIOENCODING=utf-8`) | ✅ | 3 contratos `KEPT`; `Contracts: 3 kept, 0 broken.` |
| `uv run pytest -rs` (sem `DATABASE_URL`) | ✅ | `98 passed, 2 skipped in 5.76s`; os 2 pulados: `DATABASE_URL não definida: teste de integração com PostgreSQL pulado` |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)`; `4 commit(s) desta branch sem co-autoria de IA` (antes do commit do handoff; resultado final no retorno do agente) |
| `alembic upgrade head --sql` sem `DATABASE_URL` | ✅ (esperado falhar) | `FAILED: a variável de ambiente DATABASE_URL não está definida. Copie .env.example ...` |
| `alembic upgrade head --sql` com `DATABASE_URL=sqlite:///x.db` | ✅ (esperado falhar) | `FAILED: DATABASE_URL deve começar com 'postgresql+psycopg://' ...; recebido 'sqlite://'.` |
| `alembic upgrade head --sql` com URL FICTÍCIA `postgresql+psycopg://...@localhost:5432/...` | ✅ | `Context impl PostgresqlImpl.` / `BEGIN;` / `COMMIT;` (nenhuma revisão) |
| `docker compose --env-file .env.example config` (raiz) | ✅ (esperado falhar) | `required variable POSTGRES_DB is missing a value: defina POSTGRES_DB no .env (ver .env.example)` (idem USER e PASSWORD) |
| `docker compose --env-file <arquivo FICTÍCIO> config` (raiz) | ✅ | `image: postgres:18`, `host_ip: 127.0.0.1`, `published: "5432"`, volume `ja-guindastes_postgres-data` em `/var/lib/postgresql` |
| `pytest -m integration` com `DATABASE_URL` FICTÍCIA em `127.0.0.1:5432` (sem banco) | ✅ (pulado) | `2 skipped in 7.11s`: `PostgreSQL de DATABASE_URL não respondeu` |
| `alembic upgrade head` com URL FICTÍCIA, sem banco | ⚠️ | falhou depois de **mais de 120 s** com `ConnectionTimeout ... connection timeout expired`; com `?connect_timeout=5` falhou em ~7 s (registrado no guia, § 9) |
| `uv run lint-imports >/dev/null` | ❌ (reproduz o problema do guia § 9) | exit 1, `UnicodeEncodeError: 'charmap' codec can't encode characters`; com `PYTHONIOENCODING=utf-8`: exit 0 |
| **Merge simulado com `development` @ `f18dd9e`** (HEAD desanexado) | ✅ | `git merge-tree`: sem conflitos; `ruff check` ok, `66 files already formatted`, mypy `41 source files` ok, `3 kept, 0 broken`, `298 passed, 2 skipped`, check-structure `OK: 0 erros, 1 aviso(s)` |
| **Verificação com banco real** (`docker compose up -d`, `alembic upgrade head`, `SELECT 1`, `docker compose down`) | ⚠️ **NÃO EXECUTADO** | o motor do Docker não sobe nesta máquina (abaixo) |
| Auditoria de vulnerabilidades das dependências | ⚠️ NÃO EXECUTADO | não há ferramenta definida (`docs/security.md` § 5 e guia § 3: "A VALIDAR") |

Por que a verificação com banco real não rodou:

```text
$ docker info
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; ...
$ docker desktop start --timeout 180
✗ Failed to start Docker Desktop
Docker Desktop is still starting: context deadline exceeded
$ docker desktop logs   (trecho)
... "state":"stopped","stopReason":"engine linux/wsl failed to start: checking preconditions:
Virtual Machine Platform not enabled\nNo virtualization available"
$ docker desktop stop
✓ Stopping Docker Desktop
```

Ativar a virtualização é mudança de configuração do sistema, que agentes não fazem (§ 8, item 1).
Nenhum volume nem container foi criado.

## 5. Decisões tomadas

1. **Base `ae2ec66`**, como pedido pela pessoa. O worktree veio em `f7570d7`; criei a branch a partir de
   `ae2ec66`. Durante a tarefa o `development` avançou para `f18dd9e`; não rebaseei (a pessoa fixou a
   base) e simulei o merge (§ 4): limpo.
2. **`postgres:18`** (PostgreSQL 18.6 hoje): a major mais nova que existe (a 19 não tem tag). Imagem
   Debian padrão, não a `-alpine`, por ser a variante de referência. Volume montado em
   `/var/lib/postgresql` porque a partir da 18 a imagem guarda os dados em `/var/lib/postgresql/18/docker`.
3. **`name: ja-guindastes` no Compose**: nome de projeto fixo, para o volume ser o mesmo em qualquer
   pasta ou worktree (senão cada worktree criaria um banco e todos disputariam a porta 5432).
4. **Porta só em `127.0.0.1`**: o banco local não fica exposto na rede. `POSTGRES_PORT` opcional
   (padrão 5432) para quem já tem outro PostgreSQL na máquina.
5. **`DATABASE_URL` exige `postgresql+psycopg://`**: PostgreSQL pelo ADR-007 e o driver escolhido. Com
   `postgresql://` o SQLAlchemy procuraria outro driver, não instalado; o erro agora é claro na
   configuração. Se a pessoa preferir aceitar outros esquemas, é uma linha em `config.py`.
6. **Convenção de nomes na `Base.metadata`** (a sugerida na documentação do SQLAlchemy): dá nomes
   determinísticos a constraints e índices, necessários para migrations de `ALTER`/`DROP`. Custa zero
   agora (sem tabelas) e seria caro mudar depois das primeiras migrations. `pool_pre_ping=True` no engine
   para descartar conexões mortas depois de reiniciar o container.
7. **Alembic em `backend/alembic/`** (o exemplo da pessoa) com `known-third-party = ["alembic"]` no ruff;
   `alembic.ini` só com ASCII porque o Alembic 1.20 lê o arquivo com a codificação do sistema
   (`encoding="locale"`, cp1252 no Windows; verificado em `alembic/util/compat.py`).
8. **Hooks do ruff e template modernizado**: sem isso, cada revisão gerada falharia nos gates (`UP007`,
   `UP035`, `I001`, `W291`). Verificado com uma revisão descartável.
9. **Comentário na linha de cima no `.env.example`**: verifiquei que o Compose lê
   `POSTGRES_PORT=   # comentário` como valor `# comentário` (erro `invalid hostPort: # opcional ...`);
   com `POSTGRES_USER` isso criaria um usuário chamado "# comentário" sem nenhum erro.
10. **Testes de integração pulados sem banco** (pedido da pessoa; o CI não tem banco). O pulo é
    explícito, com motivo no `-rs`. Justificativa exigida por `docs/testing-strategy.md` § 5.
11. **Dependências** (fonte: PyPI, via `uv add`; confirmadas no registro pelo próprio `uv`):

| Pacote | Versão | Motivo | Alternativa considerada | Licença |
|--------|--------|--------|-------------------------|---------|
| `sqlalchemy` | 2.1.1 | ORM/engine da infraestrutura (doc-fonte § 8.4; pedido da pessoa) | nenhuma: a doc-fonte já nomeia o SQLAlchemy | MIT |
| `alembic` | 1.20.0 | migrations (ADR-012) | nenhuma: definido no ADR-012 | MIT |
| `psycopg[binary]` (+ `psycopg-binary`) | 3.3.6 | driver PostgreSQL com wheels binários (preferência da pessoa) | psycopg2 (geração anterior); asyncpg (assíncrono, e o engine é síncrono por ora) | LGPL-3.0-only |
| `mako`, `markupsafe` (transitivas do Alembic) | 1.4.3, 3.0.3 | templates das revisões | — | MIT, BSD-3-Clause |
| `tzdata` (transitiva do psycopg no Windows) | 2026.4 | fusos horários | — | Apache-2.0 |

## 6. Regras de negócio aplicadas

- nenhuma (tarefa só de infraestrutura; nenhuma tabela de negócio criada)

## 7. O que NÃO foi feito e por quê

- **CA-1 e CA-5 com banco real: NÃO EXECUTADOS.** O Docker Desktop não sobe nesta máquina ("Virtual
  Machine Platform not enabled / No virtualization available"). O Compose foi validado com
  `docker compose config`, o Alembic no modo offline, e os testes de integração pularam como esperado.
  Falta rodar o teste manual da tarefa (§ 7 da tarefa) numa máquina com Docker funcionando.
- Modelos, tabelas, repositórios e revisões de negócio: fora do escopo (entram com cada caso de uso).
- Serviço PostgreSQL no CI: fora do escopo (a pessoa pediu para não alterar `.github/workflows/`).
- Auditoria de vulnerabilidades: sem ferramenta definida no projeto.
- `docs/known-gaps.md` não foi alterado (arquivo da TASK-010 nesta leva); o que seria registrado lá
  está nas pendências abaixo.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Ativar a virtualização na máquina (recurso "Plataforma de Máquina Virtual" do Windows e virtualização no BIOS/UEFI) e rodar o teste manual da tarefa (§ 7): `docker compose up -d`, `alembic upgrade head`, `pytest -m integration` (esperado `2 passed`) e `docker compose down` | sim, para dar CA-1 e CA-5 como verificados | | |
| 2 | `docs/policies/security.md` § 4.4 pede ADR para "dependência relevante (framework, ORM, ...)". SQLAlchemy está na doc-fonte (§ 8.4) mas não tem ADR próprio, e o psycopg 3 foi escolhido em chat. Quer um ADR registrando SQLAlchemy 2 + psycopg 3 (eu não criei para não inventar decisão)? | não | | |
| 3 | O psycopg 3 é LGPL-3.0-only (usado como biblioteca, sem modificação). Serve para o projeto? | não | | |
| 4 | Confirmar as escolhas técnicas desta tarefa: exigir `postgresql+psycopg://` em `DATABASE_URL` (§ 5.5) e a convenção de nomes da `Base` (§ 5.6) | não | | |
| 5 | Criar uma tarefa para ter PostgreSQL no CI (serviço no `ci.yml`), para os testes de integração rodarem de verdade no PR | não | | |
| 6 | Definir a ferramenta de auditoria de dependências (`docs/security.md` § 5), para cumprir `docs/policies/security.md` § 4.5 | não | | |
| 7 | Registrar em `docs/known-gaps.md` (arquivo da TASK-010 nesta leva): testes de integração com banco pulados no CI; verificação com banco real pendente | não | | |

## 9. ⚠️ Segurança

- nada a relatar. Nenhum `.env` foi criado; as credenciais dos testes e dos comandos acima são
  FICTÍCIAS (`usuario_ficticio`, `senha_ficticia`...). `alembic.ini` não guarda URL. Triagem
  `git diff | grep -iE "password|secret|token|key"`: só nomes de variáveis, textos de documentação e as
  senhas FICTÍCIAS dos testes.

## 10. Próximo passo

**Papel:** Pessoa responsável, depois Revisor (outra sessão/ferramenta, AGENTS.md § 3)

**O que fazer, concretamente:**
1. Pessoa: responder a pendência 1 (virtualização) e rodar o teste manual da tarefa; colar a saída aqui.
2. Pessoa: push e PR (o agente foi instruído a não fazer push nem PR nesta execução).
3. Revisor: revisar o diff `git diff development...task/TASK-011-persistencia-postgresql`.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-011-persistencia-postgresql.md` §§ 3 e 7
4. `backend/app/infrastructure/database/config.py` (validação e mensagens de erro)
5. `backend/alembic/env.py` e `docker-compose.yml`
6. `docs/development-guide.md` §§ 3, 6 e 9

**Cuidado com:**
- `POSTGRES_*` só valem na **primeira** subida: se o volume `ja-guindastes_postgres-data` já existe com
  outras credenciais, mudar o `.env` não muda o banco.
- `docker compose down -v` apaga o volume com os dados.
- O backend, o Alembic e o pytest não leem o `.env` sozinhos (exporte as variáveis; guia § 6).
- Sem banco no ar, o psycopg espera mais de 2 minutos antes de falhar (use `?connect_timeout=5`).

## 11. Como revisar este trabalho

- Comece por `config.py` (nenhuma mensagem pode vazar a senha) e pelos testes de `test_config.py`.
- `docker-compose.yml`: tag, porta em `127.0.0.1`, volume em `/var/lib/postgresql` (PostgreSQL 18+).
- `alembic.ini` é quase todo o template gerado; as mudanças são o cabeçalho, `prepend_sys_path`, a
  remoção de `sqlalchemy.url` e os hooks do ruff.
- Tenho menos certeza sobre o comportamento real com banco (não pude rodar): o `env.py` online e os
  testes de integração só foram exercitados até a tentativa de conexão.
- `backend/uv.lock` é gerado.
