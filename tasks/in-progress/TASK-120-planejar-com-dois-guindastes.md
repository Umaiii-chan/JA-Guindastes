# TASK-120 — recomendar e planejar com 2 guindastes quando um só não atende

Pedido da pessoa responsável (via sessão coordenadora, 2026-11-25). Decisão no
[ADR-053](../../docs/decisions/ADR-053-recomendar-dois-guindastes-quando-um-nao-atende.md) (Proposto).
Sem regra de cálculo nova: usa a RN-016.

## Critérios de aceite

- [x] **CA-1** — Quando a avaliação de um guindaste fica acima de 100 % do limite ou não é avaliável por estar além da tabela (carga acima, raio fora do alcance), o cartão de resultado recomenda 2 guindastes e leva à folha "Planejar".
- [x] **CA-2** — Motivos que dois guindastes não resolvem (sem tabela, sem ficha, ângulo fora da ficha etc.) não geram a recomendação.
- [x] **CA-3** — Planejar com 2 guindastes: a lista de recomendações avisa que nenhum guindaste sozinho atende, mostra a divisão da carga por guindaste e o passo a passo lista as duas posições (backend já devolvia o tandem: posições, trajetórias e avaliação de cada um).
- [x] **CA-4** — "Aplicar" um tandem posiciona e liga o içamento com dois guindastes, para a trajetória engatar e mover os dois sem passo manual.
- [x] **CA-5** — Testes automatizados (frontend) e docs/handoff atualizados.
