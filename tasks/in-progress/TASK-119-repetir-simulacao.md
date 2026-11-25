# TASK-119 — repetir a simulação sem recarregar a página

Depois de finalizar uma simulação pelo planejamento a carga fica no ponto de entrega e não há como
simular de novo sem recarregar a página e refazer o cenário. ADR-053 (Proposto) registra a decisão.

## Critérios de aceite

- [x] **CA-1** — Há um atalho (botão "Repetir simulação" no painel "Planejar operação" e a tecla R) que
  devolve a carga ao ponto de coleta e zera o resultado e o tempo da entrega (guindaste só e tandem).
- [x] **CA-2** — O atalho devolve o guindaste ao primeiro quadro da trajetória (se aplicada), zera o
  progresso da execução e leva o passo a passo ao primeiro passo.
- [x] **CA-3** — Uma nova simulação (engatar, entregar) roda normalmente depois do atalho, com o tempo
  contado do novo engate.
- [x] **CA-4** — Testes Vitest cobrem a cena (`CargoOperation`), a execução (`usePlanPlayback.reset`) e o
  painel (botão). E2E: não coube (ver handoff).
- [x] **CA-5** — `docs/decisions/ADR-053-repetir-simulacao.md` registra o comportamento.
