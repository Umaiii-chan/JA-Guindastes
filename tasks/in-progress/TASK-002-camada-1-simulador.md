# TASK-002 — Versionar a documentação do simulador e preencher a Camada 1

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-002-camada-1-simulador` (a partir de `development` @ `c17358a`) |
| **PR** | — |
| **Requisitos** | todos (RF-001..024, RNF-001..012) são registrados por esta tarefa |
| **Regras de negócio** | RN-001..008 são transcritas por esta tarefa, com autorização da pessoa |
| **Estimativa** | M (documentação extensa; a cópia da doc-fonte é verbatim e não precisa de revisão linha a linha) |

---

## 1. Objetivo

Os agentes passam a ter contexto mínimo sobre o produto deste repositório: o **Simulador Web 3D para
Análise de Tabelas de Carga de Guindastes**. Hoje os quatro documentos de contexto mínimo são
templates vazios, e nenhuma tarefa pode ir para `in-progress/` sem o CI falhar.

## 2. Contexto

Em 2026-09-26 a pessoa responsável entregou a documentação técnica v0.1 (13/08/2026) do simulador e
decidiu, em chat:
1. o repositório deixa de ser template e passa a ser o produto;
2. as RN-001..008 são transcritas para `docs/business-rules.md` palavra por palavra, com a origem
   citada, e as PEND-001..008 entram como perguntas em aberto;
3. os ADR-001..008 da doc-fonte serão rascunhados como ADR-004..011 `Proposto` (**TASK-003**, não esta);
4. comandos que ainda não existem ficam marcados como "A VALIDAR" em vez de `<preencher>`;
5. o layout é `frontend/` e `backend/` na raiz, e `src/` e `tests/` do template saem.

A análise que originou esta tarefa ficou só na sessão (achados não verificados). O que ela apontou
como lacuna vai para `docs/known-gaps.md`.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o arquivo-fonte recebido (sha256 `c7793be8762a5286…`), quando comparo com o blob
  de `docs/produto/documentacao-tecnica-v0.1.md`, então o conteúdo é idêntico. Os 16 arquivos de
  `docs/produto/diagrams/` (8 `.dot` e 8 `.png`) também são cópias exatas.
- [ ] **CA-2** — Dado o repositório nesta branch, quando rodo `grep -c '<preencher>'` em
  `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md` e
  `docs/development-guide.md`, então o resultado é 0 nos quatro, e `bash scripts/check-structure.sh`
  termina com exit 0 com esta tarefa em `tasks/in-progress/`.
- [ ] **CA-3** — Dado `docs/business-rules.md`, quando comparo com a doc-fonte § 6.1 (l.144–151), então
  RN-001..008 têm o enunciado idêntico, com origem citada. As PEND-001..008 (l.155–162) estão em
  "Perguntas em aberto" com decisão `pendente`.
- [ ] **CA-4** — Dado `docs/requirements/functional.md` e `non-functional.md`, quando comparo com a
  doc-fonte §§ 4–5, então os 24 RF e os 12 RNF estão presentes com os mesmos IDs e textos.
- [ ] **CA-5** — Dado os documentos preenchidos, quando procuro comandos de instalação, execução,
  teste ou lint, então nenhum foi inventado como existente: os que dependem do código ainda não criado
  estão marcados "A VALIDAR".
- [ ] **CA-6** — Dado `docs/known-gaps.md`, quando reviso, então ele lista as lacunas que impedem
  implementar sem inventar (geometria, alertas, formato de tabela, dados de teste, segurança de upload).

## 4. Escopo

### Dentro do escopo

- Cópia verbatim da doc-fonte e dos diagramas em `docs/produto/`.
- `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md`,
  `docs/development-guide.md`, `docs/requirements/` e `docs/known-gaps.md`.
- Remoção de `src/.gitkeep` e `tests/.gitkeep` (decisão 5).

### Fora do escopo (explicitamente — o agente NÃO faz)

- ADRs da doc-fonte (TASK-003).
- `docs/testing-strategy.md` e `docs/security.md` (tarefa futura; não fazem parte do contexto mínimo).
- Reescrever o `README.md` e retirar do repositório o que só serve ao template (tarefa futura).
- Qualquer código, `.github/workflows/*`, `AGENTS.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docs/produto/documentacao-tecnica-v0.1.md` e `docs/produto/diagrams/*` | criar (cópia) | sim |
| `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md`, `docs/development-guide.md` | alterar | sim |
| `docs/requirements/README.md`, `functional.md`, `non-functional.md` | alterar / criar | sim |
| `docs/known-gaps.md` | alterar | sim |
| `src/.gitkeep`, `tests/.gitkeep` | remover | sim |
| `tasks/in-progress/TASK-002-camada-1-simulador.md`, `handoffs/` | criar / reescrever | sim |

## 6. Riscos e dependências

- Risco: a v0.1 está desatualizada em relação à Estação 1 → a pessoa confirma se há versão mais nova
  (pendência no handoff).
- Risco: agentes tratarem números dos exemplos da doc-fonte como capacidade real → `known-gaps.md` § 5.

## 7. Teste manual (se houver)

1. `bash scripts/check-structure.sh` → **Esperado:** `OK: 0 erros`.
2. `git show HEAD:docs/produto/documentacao-tecnica-v0.1.md | sha256sum` → **Esperado:** `c7793be8762a5286…`.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Copiar doc-fonte e diagramas | `docs/produto/` | CA-1 | [x] |
| 2 | Preencher os 4 documentos mínimos | `docs/*.md` | CA-2, CA-3, CA-5 | [x] |
| 3 | Requisitos | `docs/requirements/` | CA-4 | [x] |
| 4 | Lacunas | `docs/known-gaps.md` | CA-6 | [x] |
| 5 | Remover `src/` e `tests/`, handoff, check, commit | — | CA-2 | [x] |

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica: tarefa só de documentação.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
