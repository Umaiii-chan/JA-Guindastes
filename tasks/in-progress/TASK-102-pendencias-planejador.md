# TASK-102 — pendências do planejador (revisão do PR #48)

Pendências registradas em `docs/known-gaps.md` (L-016), no handoff da TASK-088 e no parecer da
revisora do PR #48: a altura de apoio no caminhão plataforma, o teste do giro da carga na entrega e
o teste de um plano bem-sucedido com a carga dentro do barracão aberto. Backend; sem decisão nova.

## Critérios de aceite

- [ ] **CA-1** — A entrega sobre o caminhão plataforma da biblioteca apoia a carga na carroceria
  (`platform_truck_bed_ratio()`, igual a `loadBed` do frontend: 1,86 m de 3,51 m), em
  `delivery_surface` e em `delivery_cover`; `test_caminhao_plataforma_da_biblioteca_tambem_recebe_a_carga`
  confere o valor.
- [ ] **CA-2** — Teste ponta a ponta do giro da carga na entrega, nos dois sentidos do giro: um muro
  que só bloqueia a entrega com o giro da melhor posição; o teste falha com o sinal invertido em
  `planner.py` (provado por mutação).
- [ ] **CA-3** — Teste de um plano válido com a carga dentro do barracão aberto, com uma ficha
  FICTÍCIA de lança discreta que cabe sob o arco, passando por baixo da parte elevada (`_swings`);
  o teste falha sem a altura de transporte por baixo (provado por mutação).
- [ ] **CA-4** — `docs/known-gaps.md` L-016 atualizada: itens 1 e 2 resolvidos; o cenário padrão da
  IA tende a "nenhuma combinação atende" por limitação geométrica.
- [ ] **CA-5** — Nenhum teste existente quebra (`ruff`, `mypy`, `lint-imports`, `pytest`,
  `scripts/check-structure.sh`).
