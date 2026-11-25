# TASK-124 — IA do cenário: dizer como a carga é orientada

Relato da pessoa responsável (2026-11-25): ao pedir à IA "depositar a viga 3 m ao lado da posição
original", a área de entrega saiu praticamente em cima da carga.

## Critérios de aceite

- [x] **CA-1** — O prompt do cenário diz que, com giro 0, o comprimento da carga fica ao longo do eixo Z (como no simulador), e o que é "ao lado" e "à frente".
- [x] **CA-2** — O mesmo pedido passa a gerar a entrega deslocada na direção da largura da carga.
- [x] **CA-3** — Teste automatizado amarra o texto do prompt à convenção do planejador.
