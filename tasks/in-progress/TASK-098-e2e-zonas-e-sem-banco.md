# TASK-098 — E2E de zonas de giro e do modo sem banco

Dois testes ponta a ponta falham na `development` por causa de funcionalidades que entraram depois
deles, não por defeito do produto (achado na rodada de correções de 2026-10-16).

## Critérios de aceite

- [x] **CA-1** — `rotationZones.spec.ts`: antes de girar a torre, os três testes sobem o gancho
  (cabo no mínimo). Com a carga de 2 m pendurada baixa, a guarda de colisão com o corpo do guindaste
  (RN-012; TASK-063) parava o giro em 12°, antes da zona lateral.
- [x] **CA-2** — `auth.spec.ts` (modo sem autenticação): o teste também simula `GET /ai/status`.
  Contra a stack com banco, a chamada real respondia 401 e a tela ia para o login com "A sessão
  acabou".
