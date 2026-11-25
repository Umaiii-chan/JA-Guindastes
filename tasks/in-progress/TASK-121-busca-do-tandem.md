# TASK-121 — busca do tandem: achar pares viáveis em translações comuns

Pedido da pessoa responsável (via sessão coordenadora, 2026-11-25): "Planejar operação" quase nunca
recomenda 2 guindastes. Decisão em [ADR-055](../../docs/decisions/ADR-055-busca-do-tandem-sentidos-opostos-medidos.md) (Proposto).

## Critérios de aceite

- [x] **CA-1** — Diagnóstico com os casos reais reproduzido em teste (viga 10 × 0,6 × 0,8 m): 5 t a 3 m, nos dois eixos, passam a recomendar tandem válido.
- [x] **CA-2** — O descarte por "sentidos opostos" passa a medir a variação da distância entre os ganchos (tolerância 0,5 m); sem pontos de içamento cai como antes; mesmo sentido não muda.
- [x] **CA-3** — Translações laterais longas continuam recusadas e a nota diz por quê (coberto por teste; passo 2 do ADR).
- [x] **CA-4** — Limite de capacidade e RN-016 intactos.
