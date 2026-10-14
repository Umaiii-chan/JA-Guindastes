# TASK-075 — recomendação de guindaste, posição e trajetória

Pedido: dependendo da carga, recomendar o modelo de guindaste (ou dois, se preciso), sugerir a posição
do guindaste, planejar a trajetória (coletar e levar à entrega) e ter modo passo a passo.
Decisão: `docs/decisions/ADR-038-planejamento-da-operacao.md`.

- [x] **CA-1** — Serviço de domínio puro `backend/app/domain/services/planning/`: grade de posições de 2 m
      ao redor da coleta e da entrega (até o maior raio da tabela), descartando as posições sobre
      obstáculos, com inclinação ou solo fora do limite.
- [x] **CA-2** — Raio, giro e utilização do limite (`EvaluateOperation`, fatores da RN-015) no pior ponto
      do caminho, com o giro amostrado pelo sentido de menor tempo e a carga a topo do obstáculo mais
      alto + 1 m.
- [x] **CA-3** — Escolhe o comprimento de lança (e o ângulo) que minimiza a utilização máxima.
- [x] **CA-4** — Ranqueia (válidas primeiro, menor utilização, menor risco); sem configuração única, tenta
      tandem (75 % cada, divisão pelo CG).
- [x] **CA-5** — Trajetória `aproximar → engatar → levantar → girar → baixar → soltar` com estados por fase.
- [x] **CA-6** — `POST /api/v1/planning/recommend` conforme o contrato; menos de 3 s em cenários pequenos.
- [x] **CA-7** — Painel "Planejar operação": coleta, entrega, recomendações com motivo resumido, "Aplicar",
      "Executar trajetória" e "Passo a passo" (próxima ação, conferida com tolerância).
- [x] **CA-8** — Testes de domínio, de aplicação, da API e do frontend; paridade do terreno entre Python e
      TypeScript.

Capturas: `docs/assets/screenshots/leva-f/task-075-*.png` (coleta e entrega a 15 m, com um container no
meio).
