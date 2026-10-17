# TASK-091 — colisões completas: outros guindastes, acessórios e terreno

Achados F-07, F-10, F-17, F-23, F-24 e F-30 da auditoria de 2026-10-16 (código em `784a9e1`). A conta
do SAT e das caixas estava certa; faltava cobertura. RN-012; ADR-028; decisões novas no ADR-044.

## Critérios de aceite

- [x] **CA-1** — (F-07) Com 2+ guindastes fora do tandem, a carga, o gancho e a cadeia de cada um não atravessam o corpo nem a lança dos outros, e o cabo não atravessa a lança dos outros: o comando para no último estado seguro e é sinalizado. Cenário da auditoria (guindaste 1 em (0; 0), θ 35°, L 12 m, c 3,1 m, carga 4 × 2 × 1,5; guindaste 2 em (−5; 8,27), rumo 90°, lança deitada): antes 1,18 m de penetração sem alerta.
- [x] **CA-2** — (F-10) A cadeia de acessórios (de G − amarração até G − amarração − soma das alturas) entra na colisão. Gancho giratório + manilha (0,75 m), sem carga, cabo até 15 m: o fim da cadeia para no chão; com a carga no chão, para no topo dela e ainda engata.
- [x] **CA-3** — (F-17) O terreno sob a carga é amostrado na face de baixo com passo fixo de 0,5 m, teto no total de pontos e os picos analíticos das feições. Monte de raio 1 m e 2 m de altura sob viga de 20 m com a base a 0,5 m: antes 0, agora 1,5 m. Tempo da avaliação na mesma ordem de grandeza.
- [x] **CA-4** — (F-23) No tandem, os objetos da biblioteca usam as caixas detalhadas (`obstacleObbs`), como no guindaste único.
- [x] **CA-5** — (F-24) O grupo «Colisões» continua sempre na página (TASK-078; TASK-082); os E2E conferem "sem itens de colisão" em vez de "sem grupo"; comentário do componente corrigido.
- [x] **CA-6** — (F-30) O teste das arestas falha sem os 9 eixos de produto vetorial e o do giro falha com o sinal invertido (provado mutando o código).

## Testes a escrever depois

- Carga contra carga de dois guindastes fora do tandem (não pedido; no tandem os ganchos ficam juntos na carga).
- E2E com dois guindastes e acessórios.
