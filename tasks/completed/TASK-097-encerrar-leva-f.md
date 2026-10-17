# TASK-097 — encerrar a leva F e destravar o CI

O `scripts/check-structure.sh` falha na `development` (e em todo PR aberto a partir dela): há 17
tarefas em `tasks/in-progress/` (máximo 15), todas já mergeadas, e a TASK-080 não tem handoff.

## Critérios de aceite

- [x] **CA-1** — As tarefas mergeadas da leva F (TASK-049 e TASK-071 a TASK-087) vão para
  `tasks/completed/`, cada uma com a seção "Encerramento" (data do merge e revisão independente
  dispensada pela pessoa responsável, autorização permanente de `handoffs/current.md` § 3, item 1),
  como na TASK-070.
- [x] **CA-2** — `bash scripts/check-structure.sh` passa sem erros.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-16 (PR #46). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
