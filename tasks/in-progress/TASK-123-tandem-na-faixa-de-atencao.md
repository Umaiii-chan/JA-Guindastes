# TASK-123 — planejar: recomendar o tandem quando o guindaste sozinho fica na faixa de atenção

Pedido da pessoa responsável (2026-11-25): uma simulação planejada usou 89 % do guindaste e o planejar
deveria ter recomendado o tandem. Decisão no
[ADR-056](../../docs/decisions/ADR-056-tandem-quando-o-guindaste-sozinho-esta-na-faixa-de-atencao.md) (Proposto);
gatilho e ordem da lista escolhidos pela pessoa responsável.

## Critérios de aceite

- [x] **CA-1** — Se o melhor guindaste sozinho válido está na faixa de atenção do modelo (RN-011), o planejamento também procura o tandem.
- [x] **CA-2** — Havendo tandem válido, ele vem primeiro e as opções de um guindaste continuam na lista.
- [x] **CA-3** — Abaixo da faixa de atenção, ou sem tandem válido, a resposta é a de antes.
- [x] **CA-4** — A tela avisa que um guindaste atende, mas em atenção, e recomenda os dois.
- [x] **CA-5** — Testes automatizados no backend e no frontend.
