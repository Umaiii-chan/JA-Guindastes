# TASK-045 — Atualizar a documentação geral para o estado da leva D

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido via orquestrador, depois do merge da leva D) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-045-documentacao-leva-d` (a partir de `2e7313b`, `development` com a leva D e a abertura da TASK-044) |
| **PR** | — |
| **Requisitos** | RNF-011 |
| **Regras de negócio** | — (nenhuma regra nova; `docs/business-rules.md` não é tocado) |
| **Estimativa** | M |

---

## 1. Objetivo

Quem abrir o repositório encontra README e documentos de `docs/` descrevendo o que existe em
`development` @ `2e7313b`, com a leva D (TASK-038..043, PR #39) integrada: login com perfis, casca e
páginas no design system escuro, cena 3D enriquecida, modelo GLB do guindaste sobre caminhão e ficha
FICTÍCIA de demo com a = −1,56 m.

## 2. Contexto

As tarefas da leva D deixaram, nas seções finais dos handoffs (`handoffs/TASK-038.md` a
`TASK-043.md`), a lista do que precisava mudar na documentação geral. Só `docs/demo.md`,
`docs/security.md` (§§ 1–4), `docs/development-guide.md` (variáveis do E2E) e
`docs/testing-strategy.md` (linha do E2E de login) foram tocados por elas. A TASK-044 roda em
paralelo e altera a lista de rotas de `docs/architecture.md`; esta tarefa não mexe nessa lista.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o `README.md`, quando alguém o lê, então encontra o estado com a leva D, como rodar com o passo do primeiro admin (`python -m app.create_admin`) e `SESSION_COOKIE_SECURE=false` em HTTP local, as rotas de login e de usuários com a nota de que toda rota exige sessão com banco, e as capturas de `docs/assets/screenshots/`.
- [ ] **CA-2** — `docs/architecture.md` descreve os componentes de autenticação do backend, a visão do frontend (casca, páginas, rotas do React Router, design system, sessão e guardas, `apiFetch`, cena e modelo GLB), o fluxo de autenticação, as tabelas `app_user`/`user_session` e, na § 8, os ADR-016 e ADR-017. A lista de rotas da API (linha "Apresentação — REST") **não** é alterada.
- [ ] **CA-3** — `docs/development-guide.md` traz `create_admin`, `SESSION_COOKIE_SECURE` e `ADMIN_PASSWORD`, o E2E com `E2E_ADMIN_*`, o script `frontend/scripts/convert-crane-model.mjs` e a estrutura de pastas real.
- [ ] **CA-4** — `docs/testing-strategy.md` descreve os testes jsdom/Testing Library (`// @vitest-environment jsdom`) e os E2E com login; `docs/security.md` completa o que a TASK-038 não cobriu (frontend, GLB servido, dependências novas), sem reescrever §§ 1–4.
- [ ] **CA-5** — `docs/known-gaps.md`: L-003 em "Resolvidos"; L-002 atualizada (modelo 3D ilustrativo; tabela oficial pendente); dívidas novas dos handoffs (limite de tentativas em memória, PATCH de usuário sobrescrevendo campo concorrente, 60 fps não medidos, critério de "atenção"/PEND-004); rotas faltantes da TASK-042 como "em andamento (TASK-044)", não resolvidas.
- [ ] **CA-6** — `docs/requirements/functional.md` e `non-functional.md` com a coluna "Tarefas" acrescida das TASK-038..043 onde elas atendem requisitos, sem mudar o texto nem o status.
- [ ] **CA-7** — `docs/project-overview.md` atualizado onde descreve o estado (perfis, stack, modelo 3D).
- [ ] **CA-8** — `bash scripts/check-structure.sh` passa com 0 erros e nenhum link interno quebrado. Nenhum arquivo de código, ADR, `handoffs/current.md` ou `docs/business-rules.md` alterado.

## 4. Escopo

### Dentro do escopo

- `README.md`, `docs/architecture.md` (fora a lista de rotas), `docs/development-guide.md`,
  `docs/testing-strategy.md`, `docs/security.md`, `docs/known-gaps.md`, `docs/project-overview.md`,
  `docs/requirements/*.md`;
- esta tarefa e `handoffs/TASK-045.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- qualquer código (`backend/**`, `frontend/**`), CI, Docker;
- `handoffs/current.md`, ADRs, `docs/business-rules.md`;
- a lista/tabela de rotas da API em `docs/architecture.md` (TASK-044);
- `docs/demo.md` (não pedido; pendências registradas no handoff).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `README.md` | alterar | sim |
| `docs/architecture.md`, `docs/development-guide.md`, `docs/testing-strategy.md`, `docs/security.md`, `docs/known-gaps.md`, `docs/project-overview.md` | alterar | sim |
| `docs/requirements/functional.md`, `docs/requirements/non-functional.md` | alterar (coluna "Tarefas") | sim |

## 6. Riscos e dependências

- Risco: conflito com a TASK-044 em `docs/architecture.md` → mitigação: não tocar a linha
  "Apresentação — REST" nem a § 4 de importação; auth fica em linhas e seções próprias.
- Risco: documentar algo que o código não faz → mitigação: cada fato conferido no código ou nos
  handoffs; o que não rodou fica como NÃO EXECUTADO/NÃO MEDIDO.

## 7. Teste manual (se houver)

1. Ler o `README.md` e seguir "Como rodar" numa máquina com Docker, até entrar na tela com o admin.
   **Esperado:** login com o admin criado; Início, Simulador, Catálogo, Tabelas e Usuários acessíveis.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Ler os handoffs TASK-038..043, ADR-016/017 e conferir fatos no código | — | — | [x] |
| 2 | README | `README.md` | `check-structure.sh` | [ ] |
| 3 | Arquitetura (sem a lista de rotas) | `docs/architecture.md` | `check-structure.sh` | [ ] |
| 4 | Guia, testes e segurança | `docs/development-guide.md`, `docs/testing-strategy.md`, `docs/security.md` | `check-structure.sh` | [ ] |
| 5 | Lacunas, requisitos e visão geral | `docs/known-gaps.md`, `docs/requirements/*.md`, `docs/project-overview.md` | `check-structure.sh` | [ ] |
| 6 | Handoff e commits | `handoffs/TASK-045.md` | `git log` | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só texto).
- Regras de negócio aplicáveis: nenhuma.
- Decisões necessárias: nenhuma nova.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| links internos válidos e sem `<preencher>` no contexto mínimo | CA-8 | estrutura | `scripts/check-structure.sh` | a rodar |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (não revisado)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
