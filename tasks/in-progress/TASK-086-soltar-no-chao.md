# TASK-086 — trajetória solta a carga no chão

A trajetória terminava com a carga a ~1,3 m do chão (o planejador não desconta toda a altura das lingas), e "Soltar" falhava.

## Critérios de aceite

- [x] **CA-1** — No quadro "soltar", a tela desce o cabo até a carga apoiar (a guarda de colisão para no chão) e solta.
- [x] **CA-2** — Verificado em 2026-10-14 no navegador: planejar, aplicar e executar terminam em "Entregue!".

## Testes a escrever depois

- E2E da trajetória até "Entregue"; corrigir no planejador a altura final (`delivery_state`).
