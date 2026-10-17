# TASK-105 — encerrar as tarefas mergeadas da rodada

As tarefas TASK-088, 089, 095, 099, 100 e 101 já foram mergeadas (PRs #48, #53, #54, #51, #52 e #55) e
ainda estão em `tasks/in-progress/`.

## Critérios de aceite

- [x] **CA-1** — As seis tarefas vão para `tasks/completed/` (`git mv`), cada uma com a seção
  "Encerramento" (data do merge em horário de Brasília, PR e revisão independente).
- [x] **CA-2** — `bash scripts/check-structure.sh` passa sem erros.
