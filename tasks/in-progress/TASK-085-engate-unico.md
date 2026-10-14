# TASK-085 — trajetória engata uma vez só

Relato da pessoa usuária em 2026-10-14: em todas as simulações, a trajetória parava com "Não deu para engatar a carga. A carga está perto do chão, a 16,00 m do centro da entrega. Toque em Soltar."

Causa: o planejador gera dois quadros "engatar" seguidos (`move(HOOK)` e `hold(HOOK)` em `backend/app/domain/services/planning/trajectory.py`). A tela chamava o engate nos dois, e o segundo falhava com a carga já no gancho.

## Critérios de aceite

- [x] **CA-1** — Engatar e soltar só no primeiro quadro de cada fase (`startsPhase` em `usePlanPlayback.ts`).
- [ ] **CA-2** — Trajetória executada até "Entregue" na tela.

## Testes a escrever depois

- E2E: planejar, aplicar e executar a trajetória até a entrega.
