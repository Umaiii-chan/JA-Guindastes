# Handoff — TASK-035 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-035-demo-reproduzivel.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree isolada, disparado pelo orquestrador da leva C |
| **Branch** | `task/TASK-035-demo-reproduzivel` @ commit deste handoff (base `d58edf6`) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Seed FICTÍCIO idempotente, ajustes do Docker (`FILE_STORAGE_DIR` em volume, healthcheck em
`/api/v1/health`, comando para migrar e semear) e roteiro `docs/demo.md` com valores conferidos.

## 2. O que foi feito

- Criei `backend/app/demo_seed.py` (raiz de composição, fora das camadas do import-linter, como
  `app.main`): `seed_demo(...)` usa `ManageCraneCatalog` (com gerador de id fixo), `ImportLoadChart`
  (validação + arquivo-fonte preservado + `DRAFT`) e `ActivateLoadChart`; `main()` é a linha de
  comando (`python -m app.demo_seed`), com exit code 0/1/2 e mensagens sem a URL do banco.
- Criei `backend/app/demo_data/` com três CSVs FICTÍCIOS (v1, v2 = v1 × 0,9, e um com erros) e um
  README com o rótulo FICTÍCIO (o CSV provisório não aceita comentário, como em
  `tests/fixtures/load_chart_csv/`).
- Ficha FICTÍCIA espelhando `frontend/src/three/crane/createProvisionalCrane.ts`: a = −1,2 m,
  h = 3,3 m, lança 12–22 m, inclinação 0–80°, cabo 1–15 m, giro contínuo (o slider de −180° a 180°
  é volta inteira, e a `CraneGeometry` recusa amplitude ≥ 360°).
- Idempotência por ids fixos (`demo-ficticio-fabricante`, `-guindaste`, `-configuracao`,
  `-tabela-v1`): o que existe não é recriado; tabela em `DRAFT`/`VALIDATED` é ativada; `ACTIVE` fica;
  `SUPERSEDED` não é reativada (aviso); registro com o mesmo id e conteúdo diferente → erro, sem
  sobrescrever.
- `backend/Dockerfile`: cria `/data/load-charts` com dono 10001 (o volume nomeado herda o dono na
  primeira montagem); `HEALTHCHECK` em `/api/v1/health`; comando do seed no cabeçalho.
- `docker-compose.yml`: `FILE_STORAGE_DIR: /data/load-charts` + volume nomeado `load-chart-files`
  no backend; healthcheck em `/api/v1/health`; comando
  `docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"`.
- `.env.example`: só comentário no `FILE_STORAGE_DIR` (nenhuma variável nova foi necessária).
- `docs/demo.md` (novo): roteiro Docker e sem Docker, cenários A–E com valores esperados, relatório
  da tabela com erros, troca de versão (v2: 3 780 kg / 79,37 %), como recomeçar e problemas comuns.
- Testes: `tests/test_demo_seed.py` (18, repositórios em memória: criação, idempotência, DRAFT
  interrompido, SUPERSEDED, conflito de ficha, tabela inválida, cenários do roteiro, relatório de
  erros, troca de versão, linha de comando) e `tests/test_demo_seed_integration.py` (6, `integration`:
  idempotência e cenários com os repositórios SQLAlchemy, transação desfeita, ids com sufixo único).

## 3. Arquivos modificados

```text
 .env.example                                       |   3 +
 backend/Dockerfile                                 |  14 +-
 backend/app/demo_data/README.md                    |  18 +
 .../tabela_carga_ficticia_demo_com_erros.csv       |   6 +
 .../demo_data/tabela_carga_ficticia_demo_v1.csv    |  28 ++
 .../demo_data/tabela_carga_ficticia_demo_v2.csv    |  28 ++
 backend/app/demo_seed.py                           | 376 +++++++++++++++++++++
 backend/tests/test_demo_seed.py                    | 364 ++++++++++++++++++++
 backend/tests/test_demo_seed_integration.py        | 140 ++++++++
 docker-compose.yml                                 |  16 +-
 docs/demo.md                                       | 222 ++++++++++++
 tasks/in-progress/TASK-035-demo-reproduzivel.md    |  76 +++++
 12 files changed, 1286 insertions(+), 5 deletions(-)
```

(mais este handoff). Fora do escopo: nada.

## 4. Comandos executados e resultados

Em `backend/`, no Windows (Git Bash), sem PostgreSQL local:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | `Checked 49 packages` |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `152 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 87 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `826 passed, 36 skipped` (os 6 novos de integração pulados: sem `DATABASE_URL`) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |
| `docker compose --env-file <.env de teste> config --quiet` | ✅ | sem erro; `FILE_STORAGE_DIR`, volume `load-chart-files` e healthcheck `/api/v1/health` no backend |
| `python -m app.demo_seed` com `DATABASE_URL` para porta fechada | ✅ | `ERRO: falha no banco (OperationalError)...`, exit 1 (demorou ~2 min: timeout de conexão do SO; pendência 2 da TASK-029) |
| Testes `integration` do seed | ⚠️ NÃO EXECUTADO | sem PostgreSQL local; o job de backend do CI roda com `REQUIRE_INTEGRATION_DB=1` |
| `docker build`, `docker compose up`, comando do seed no Compose | ⚠️ NÃO EXECUTADO | Docker não sobe localmente (virtualização desativada; pendência 6 do `current.md`) |
| hadolint no `backend/Dockerfile` | ⚠️ NÃO EXECUTADO | exigiria baixar ferramenta nova |

## 5. Decisões tomadas

- **Ids fixos e legíveis** em vez de UUID: tornam o seed idempotente sem consulta por nome (nomes
  não são únicos, pendência 1 da TASK-030) e o roteiro reproduzível (o id é digitável). A porta
  aceita qualquer texto não vazio; o gerador de id do `ManageCraneCatalog` já era injetável.
- **Seed pela camada de casos de uso**, não pela API: não exige a API no ar e usa o mesmo fluxo de
  importação (validação, SHA-256, arquivo preservado, `DRAFT`) e de ativação.
- **Não sobrescreve**: registro com id da demo e conteúdo diferente vira erro claro. Não compara o
  conteúdo do CSV já gravado (o SHA-256 muda entre checkouts LF/CRLF).
- **`SUPERSEDED` não é reativada**: segue a TASK-031 (reativar não está no fluxo § 13.2); recomeçar =
  `docker compose down --volumes`.
- **Caminho fixo no container** (`/data/load-charts`), não interpolado do `.env`: o `FILE_STORAGE_DIR`
  do `.env` é um caminho do host (uso sem Docker).
- **Healthcheck continua 200 com banco DOWN** (semântica da TASK-029); só troquei a URL.
- **Migrar e semear num só `sh -c`**, sob demanda (mantém a decisão da TASK-027 de não migrar na
  subida).
- Nenhuma dependência nova.

## 6. Regras de negócio aplicadas

- ADR-012: tudo FICTÍCIO, rotulado em nomes, README, mensagens do seed e `docs/demo.md`.
- RN-003: a ficha vem do cadastro (seed), não do modelo 3D.
- RN-004/RN-007/ADR-015: os valores do roteiro são os da consulta conservadora provisória, sem
  interpolação; cenários D e E mostram "fora do domínio".
- RN-005: versões distintas (`demo-ficticia-v1`, `-v2`) na mesma configuração.
- Regra **não documentada**: nenhuma inventada; ver § 8.

## 7. O que NÃO foi feito e por quê

- Integração e Docker NÃO EXECUTADOS localmente (§ 4).
- O job `docker` do CI não roda o seed (não posso alterar jobs existentes); pendência 1.
- `README.md`, `docs/development-guide.md`, `docs/architecture.md`, `docs/known-gaps.md` e
  `handoffs/current.md` não foram editados (protocolo da leva C; ver § 10).
- O roteiro cita as telas de catálogo e de importação da TASK-033/034 de forma condicional ("se
  disponível"), com alternativa (campo de id / `curl`), porque elas estão em paralelo.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Acrescentar ao CI um passo que rode o seed no Compose (`docker compose run --rm --no-deps backend python -m app.demo_seed`) e confira uma avaliação? Não alterei o job `docker` existente; cabe à TASK-036 (job novo) ou a uma tarefa futura | não | | |
| 2 | Os valores FICTÍCIOS da demo (tabela v1/v2, carga de 3 000 kg) servem para a banca, ou devem ser trocados por dados de validação quando a empresa liberar (P-007)? | não | | |
| 3 | Ids fixos legíveis (`demo-ficticio-*`) convivem com os UUIDs gerados pela API. Aceitável para dados de demonstração? | não | | |
| 4 | Timeout de conexão no seed/API com banco inacessível (hoje ~2 min no Windows; repete a pendência 2 da TASK-029) | não | | |

## 9. ⚠️ Segurança

- nada a relatar (nenhuma credencial; o seed não imprime a `DATABASE_URL` nem a mensagem do driver).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável.

**O que fazer, concretamente:**
1. Push/PR; conferir no CI os 6 testes `integration` de `tests/test_demo_seed_integration.py` e o job
   `docker` (a troca do healthcheck para `/api/v1/health` passa pelo `up --wait`).
2. Seguir `docs/demo.md` numa máquina com Docker e marcar os valores conferidos.
3. Documentação para a TASK-037 (não editada aqui): `README.md` (link para `docs/demo.md` e o comando
   do seed); `docs/development-guide.md` § 3 (comando do seed, `docker compose down --volumes`
   apaga também os arquivos importados) e § 6 (`FILE_STORAGE_DIR` fixo no container, volume
   `load-chart-files`); `docs/architecture.md` (módulo `app.demo_seed` na raiz de composição);
   `docs/known-gaps.md` (demo com dados FICTÍCIOS; pendências do § 8); `handoffs/current.md`.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `backend/app/demo_seed.py`
4. `backend/tests/test_demo_seed.py` (`ROTEIRO_FICTICIO` = tabela do § 5 de `docs/demo.md`)
5. `docs/demo.md`

**Cuidado com:**
- Mudar a ficha, a tabela v1, a estratégia de consulta ou a definição do raio muda os valores do
  roteiro: atualize `ROTEIRO_FICTICIO` e `docs/demo.md` juntos.
- `docker compose down --volumes` agora apaga dois volumes (banco e arquivos importados).

## 11. Como revisar este trabalho

- Comece por `seed_demo` e `_seed_load_chart` em `backend/app/demo_seed.py` (idempotência por
  status).
- Menos certeza: a herança do dono do diretório pelo volume nomeado (comportamento do Docker com
  volume vazio; não testado localmente) e a formatação exata dos números na tela (o roteiro dá os
  valores arredondados; a tela formata em pt-BR).
