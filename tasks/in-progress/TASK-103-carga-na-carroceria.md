# TASK-103 — carga na carroceria do caminhão: textos e acompanhar o caminhão

Pendências da TASK-101 (ADR-046): os textos ainda diziam "do chão" e a carga solta sobre a
carroceria não acompanhava o caminhão movido no editor. ADR-047 (esta decisão).

## Critérios de aceite

- [ ] **CA-1** — A dica da coleta e entrega (`cargoGuidance`) e a mensagem de soltura de
  `SimulatorRoute.tsx` falam do apoio (chão ou carroceria), mantendo "Toque em Soltar" e os nomes
  acessíveis usados no E2E `cargoDelivery.spec.ts`.
- [ ] **CA-2** — A carga solta sobre a carroceria acompanha o caminhão quando ele muda de posição,
  giro ou tamanho no editor (posição, giro e altura).
- [ ] **CA-3** — Caminhão removido ou trocado por modelo sem carroceria: a carga fica onde está e
  assenta no apoio que houver (terreno ou outra carroceria).
- [ ] **CA-4** — Carga no gancho, ao lado do caminhão ou apoiada em outro caminhão não é afetada.
- [ ] **CA-5** — Testes unitários do domínio para os textos e para o acompanhamento.
- [ ] **CA-6** — A carga só se apoia na carroceria quando o centro da pegada cai dentro dela (ADR-046);
  senão assenta no terreno, sem flutuar na borda.
- [ ] **CA-7** — A colisão da carga solta sobre a carroceria é um prisma da altura da carroceria ao
  topo da carga, não do terreno.
