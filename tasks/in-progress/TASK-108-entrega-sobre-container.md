# TASK-108 — entrega sobre contêiner, carreta prancha e qualquer objeto com apoio declarado

Pedido do Anderson (2026-10-17): "entrega sobre container E sobre caminhão, o mais próximo do real para
cobrir qualquer simulação". Até o ADR-049 só o caminhão plataforma recebia carga por cima. ADR-052 (esta
decisão, Proposto).

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Branch** | `task/TASK-108-entrega-sobre-container` (a partir de `anderson/development` @ `c84a386`) |
| **Requisitos** | pedido do Anderson; ADR-046, ADR-047, ADR-049, ADR-036 |

## Critérios de aceite

- [ ] **CA-1** — Contêiner ISO de 20 e 40 pés (e 40 pés high cube), carreta prancha e o caminhão plataforma
  recebem a carga por cima; o apoio é o topo do `loadBed` do objeto da biblioteca (teto do contêiner a
  2,591 m, 2,896 m no high cube; convés da prancha a 1,5 m; carroceria do caminhão como antes).
- [ ] **CA-2** — Qualquer objeto da biblioteca que declare `loadBed` recebe carga pelo mesmo critério do
  centro da pegada (ADR-046); uma caixa comum não recebe.
- [ ] **CA-3** — A carga solta acompanha o objeto movido, girado ou redimensionado no editor (ADR-047), nos
  três tipos de apoio; trocado por outro modelo, a carga fica e assenta no terreno.
- [ ] **CA-4** — Frontend e backend (planejador e layout seguro da IA) têm paridade: um dourado
  (`backend/tests/fixtures/support_surfaces.golden.json`) é conferido pelos dois lados.
- [ ] **CA-5** — Com capacidade de carga conhecida do apoio, o planejador recusa carga mais pesada e a cena
  avisa; sem dado, o apoio é rotulado FICTÍCIO na dica e nas notas do plano e o peso não limita.
- [ ] **CA-6** — A IA conhece os contêineres e a prancha (`LIBRARY_MODELS`); o layout seguro deixa qualquer apoio
  no ponto de entrega.
- [ ] **CA-7** — ADR-052 escrito; `docs/known-gaps.md` L-016 atualizado; créditos dos modelos atualizados.
- [ ] **CA-8** — Nenhum teste existente quebra (só o texto da recusa da caixa "carreta" mudou, de propósito).
