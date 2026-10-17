# TASK-099 — nivelamento desenhado na avaliação e encerramento das correções

Integração das TASK-093 (patolas seguem a animação, F-27) e TASK-094 (inclinação residual, F-12),
mergeadas em 2026-10-17: a TASK-094 calculava o nivelamento pelo comando das patolas.

## Critérios de aceite

- [x] **CA-1** — A inclinação residual enviada à avaliação usa o nivelamento que a animação já
  alcançou (`reachedOutriggers`), como a extensão e os macacos; o efeito da sessão reavalia quando
  esse nivelamento muda.
- [x] **CA-2** — As tarefas mergeadas da rodada de correções (TASK-090 a 094, 096 a 098) vão para
  `tasks/completed/` com a seção "Encerramento".
