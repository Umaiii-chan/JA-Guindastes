# Handoff — TASK-005 — implementação (correção do setup-uv no CI)

> Handoff anterior (TASK-004) arquivado em `handoffs/history/2026-09-26-TASK-004-implementacao.md`.
> A TASK-004 foi mergeada (PR #4) com o job "Backend" falhando, e continua em `tasks/in-progress/`
> até a pessoa decidir movê-la (pendência 1).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:37 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-005-corrigir-setup-uv-ci.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-005-corrigir-setup-uv-ci`, a partir de `development` @ `f0d0bfc` |
| **Duração aproximada** | ~10 min |

---

## 1. Objetivo desta etapa

Fazer o job "Backend" do CI voltar a rodar.

## 2. O que foi feito

- Li o log do job que falhou no run `36259482656` (PR #4):
  `Unable to resolve action astral-sh/setup-uv@v10, unable to find version v10`.
- Verifiquei no GitHub que a tag `v10` não existe e que a `v10.2.0` existe (`c18668ad…`).
- Troquei a linha no `.github/workflows/ci.yml` para `astral-sh/setup-uv@v10.2.0`.

## 3. Arquivos modificados

```text
 M .github/workflows/ci.yml   (1 linha)
 M docs/development-guide.md  (1 linha na § 9: push recusado sem escopo workflow)
?? handoffs/history/2026-09-26-TASK-004-implementacao.md
?? tasks/in-progress/TASK-005-corrigir-setup-uv-ci.md
```

(mais este `handoffs/current.md`). Fora do escopo: nenhum.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `gh run view 36259482656 --log-failed` | ✅ | erro de resolução da action `setup-uv@v10` no passo "Set up job" |
| `gh api repos/astral-sh/setup-uv/git/ref/tags/v10` | ✅ | `Not Found` |
| `gh api repos/astral-sh/setup-uv/git/ref/tags/v10.2.0` | ✅ | `c18668ad3cf93ea998bef934396af7bb5c839dc7` |
| `bash scripts/check-structure.sh` | ver o commit | rodado antes do commit |
| CI do PR (job Backend) | ⚠️ NÃO EXECUTADO ainda | roda quando o PR for aberto |

## 5. Decisões tomadas

- Usei a tag completa `v10.2.0`, que é o formato que essa action publica.
- Tarefa separada, e não dentro do frontend, porque o CI de `development` está quebrado.
- A mudança no arquivo protegido está dentro da autorização da TASK-004 (gates de backend e frontend).

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- Frontend: passa a ser a TASK-006.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Mover a TASK-004 para `completed/` (sem revisão independente)? | — | Sim, movida nesta branch (pessoa, em chat) | 2026-09-26 |
| 2 | Antes de mergear, conferir se todos os checks estão verdes (sem branch protection no plano Free, o GitHub não impede o merge) | — | | |
| 3 | Herdadas: apagar as branches das tarefas mergeadas; P-013, P-010, P-007 (dados oficiais); convenções geométricas P-001..P-003 | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável (merge com **squash** depois do CI verde); depois Implementador da TASK-006

**O que fazer, concretamente:**
1. Confirmar que o job "Backend" passou no PR desta tarefa e fazer o merge.
2. TASK-006: esqueleto do frontend (Vite + React + TypeScript + Three.js puro) com gates no job `quality`.

**Ler primeiro:**
1. `AGENTS.md`
2. este handoff
3. `handoffs/history/2026-09-26-TASK-004-implementacao.md` (contexto do backend)

**Cuidado com:**
- Pushes que alteram `.github/workflows/` exigem o escopo `workflow` no token (ver
  `docs/development-guide.md` § 9).

## 11. Como revisar este trabalho

- Uma linha no `ci.yml`. A evidência é o job "Backend" verde no PR.
