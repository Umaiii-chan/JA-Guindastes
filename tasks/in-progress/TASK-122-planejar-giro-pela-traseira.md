# TASK-122 — planejar: girar a carga pela traseira do chassi, não pela frente da cabine

Pedido da pessoa responsável (2026-11-25): no modo planejar, o guindaste era posicionado com a frente
do chassi (ψ = 0°) voltada para o meio do caminho entre a coleta e a entrega, então a carga sempre
girava pela frente da cabine do caminhão. O recomendado é girar por trás dele.

## Critérios de aceite

- [x] **CA-1** — Com o giro livre e em área livre, o rumo recomendado põe o meio do giro sobre a traseira do chassi (ψ = 180°); a carga não passa pela frente da cabine.
- [x] **CA-2** — A frente da cabine continua possível como último recurso, quando nenhum outro rumo atende (obstáculo, zona de giro, capacidade).
- [x] **CA-3** — Configuração com giro da torre limitado na ficha não muda: o rumo segue centrado no arco permitido.
- [x] **CA-4** — Teste automatizado que falha sem a mudança.

## Pendência para a pessoa responsável

- A preferência pela traseira é regra operacional dita no pedido e ainda não está em
  `docs/business-rules.md` (arquivo protegido). Registrar lá, se for o caso.
