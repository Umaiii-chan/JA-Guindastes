# TASK-035 — Tornar a demonstração reproduzível (seed FICTÍCIO, Docker e roteiro)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva C, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-035-demo-reproduzivel` (a partir de `d58edf6`) |
| **PR** | — |
| **Requisitos** | doc-fonte § 23 (Estação 5: roteiro de demo reproduzível) e § 24 (DoD do MVP: "a simulação de demonstração puder ser repetida do início ao fim") |
| **Regras de negócio** | RN-003 (ficha só do cadastro), RN-004, RN-005, RN-007, RN-008; ADR-012 (dados FICTÍCIOS rotulados) |
| **Estimativa** | M |

---

## 1. Objetivo

Qualquer pessoa consegue subir o sistema, cadastrar uma demonstração FICTÍCIA com um comando e seguir
um roteiro do início ao fim (selecionar a configuração, mover o guindaste, ver capacidade e
utilização, ver o relatório de uma importação com erro e trocar a versão da tabela), com os valores
esperados conferidos por teste.

## 2. Contexto

Leva C (última). A leva B deixou a avaliação ligada ao banco, os cadastros REST, a importação com
gravação e a ativação (TASK-029..032). Faltavam: dados para demonstrar, `FILE_STORAGE_DIR` no
Compose (pendência 7 da TASK-031), healthcheck na rota de saúde (pendência 1 da TASK-027; § 10 da
TASK-029) e um roteiro. Paralelas: TASK-033/034 (`frontend/src`), TASK-036 (e2e, `vite.config.ts`,
job novo no CI), TASK-037 (docs consolidadas).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um banco em `head` com `DATABASE_URL` e `FILE_STORAGE_DIR`, quando rodo `uv run python -m app.demo_seed`, então são criados fabricante, guindaste e configuração FICTÍCIOS (ficha a = −1,2 m, h = 3,3 m e as faixas dos sliders do guindaste provisório) e a tabela FICTÍCIA `demo_data/tabela_carga_ficticia_demo_v1.csv` é importada pelo fluxo real e ativada, com uma mensagem por passo.
- [ ] **CA-2** — Dado o seed já rodado, quando rodo de novo, então nada é duplicado nem alterado e as mensagens dizem "já existia"/"já estava ativa" (testes com repositórios falsos e com PostgreSQL, marcador `integration`).
- [ ] **CA-3** — Sem `DATABASE_URL` ou `FILE_STORAGE_DIR`, ou com o banco fora do ar, o seed termina com código ≠ 0 e mensagem clara, sem repetir a URL.
- [ ] **CA-4** — `docker-compose.yml`: `FILE_STORAGE_DIR` num volume nomeado do backend; healthcheck do backend (e da imagem) em `GET /api/v1/health`; comando documentado para migrar e semear com `docker compose run --rm backend ...`; `docker compose config` válido.
- [ ] **CA-5** — `docs/demo.md` com o roteiro completo (Docker e sem Docker), os valores esperados conferidos por `tests/test_demo_seed.py` e o aviso de que tudo é FICTÍCIO.
- [ ] **CA-6** — Nenhum teste existente quebra; gates do backend e `scripts/check-structure.sh` passam; nenhuma dependência nova.

## 4. Escopo

### Dentro do escopo

- `backend/app/demo_seed.py`, `backend/app/demo_data/` e os testes do seed;
- `backend/Dockerfile`, `docker-compose.yml`, comentários do `.env.example`;
- `docs/demo.md` (novo).

### Fora do escopo (explicitamente — o agente NÃO faz)

- telas do frontend (TASK-033/034), e2e e `vite.config.ts` (TASK-036), jobs existentes do CI;
- `README.md`, `handoffs/current.md` e os demais `docs/*.md` (TASK-037 consolida);
- dados reais, interpolação, níveis de alerta, migrations automáticas.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/demo_seed.py` | criar | sim |
| `backend/app/demo_data/*.csv`, `README.md` | criar | sim |
| `backend/tests/test_demo_seed.py`, `test_demo_seed_integration.py` | criar | sim |
| `backend/Dockerfile`, `docker-compose.yml`, `.env.example` | alterar | sim |
| `docs/demo.md` | criar | sim |

## 6. Riscos e dependências

- Os valores do roteiro dependem da ficha e da consulta conservadora provisória (ADR-015): se a
  estratégia ou a definição do raio mudar, `tests/test_demo_seed.py` quebra e o roteiro precisa ser
  atualizado junto.
- Integração e Docker não rodam localmente (sem virtualização): o CI valida o seed com PostgreSQL;
  o comando do Compose não é exercitado pelo job `docker` existente.

## 7. Teste manual (se houver)

O próprio `docs/demo.md`, seções 3 a 8.
