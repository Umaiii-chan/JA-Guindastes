# TASK-112 — e2e da coleta e entrega defasado desde a TASK-107

`e2e/tests/cargoDelivery.spec.ts` falhava localmente na `development`: desde a TASK-107, Engatar exige o
gancho à altura das lingas esticadas (2,45 m do topo para a carga de 2 × 2 m), e o spec ainda baixava o
cabo até o contato. No CI ele era pulado (`test.skip(hasBackend)`), então ninguém via.

## Critérios de aceite

- [x] **CA-1** — O spec engata pela distância real das lingas (desce o cabo até o botão liberar) e confere
  que a engatada com folga ainda não solta (Soltar desabilitado), sem relaxar nenhuma asserção.
- [x] **CA-2** — O spec roda também no CI (sem `test.skip(hasBackend)`): a avaliação é respondida também
  pelo WebSocket (`page.routeWebSocket`), que é o canal usado quando há stack.
- [x] **CA-3** — Suíte E2E local sem backend inteira rodada, com a lista do que passa e falha na `development`.
