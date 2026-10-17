# TASK-089 — zonas de giro, escolha de rumo, tandem e busca

Achados F-06, F-18, F-28, F-04 e F-03 (parte do planejador) da auditoria AUD-01 (2026-10-16). Empilhada
sobre a TASK-088 (`task/TASK-088-planejador-caminho`).

## Critérios de aceite

- [x] **CA-1 (F-06)** — Com zonas de giro, o plano avalia o giro logo antes e logo depois de cada fronteira atravessada (±ε), no estado interpolado entre os quadros-chave: o pior ponto não fica entre duas amostras.
- [x] **CA-2 (F-18)** — Em cada posição, todos os rumos e os dois sentidos do giro são avaliados; vale o primeiro válido na ordem de tempo (válidas primeiro, o tempo só desempata).
- [x] **CA-3 (F-28)** — O `timed_out` da busca chega à resposta da API (`timed_out`) e a tela mostra um aviso simples quando a busca foi cortada.
- [x] **CA-4 (F-04)** — Pares de tandem com os corpos sobrepostos ou com giros em sentidos opostos são recusados, com o motivo nas notas (correção mínima, sem o tandem completo).
- [x] **CA-5 (F-03)** — A tela envia o centro de gravidade da Carga (`cg_offset_m`) ao planejar; o backend usa os pontos de içamento a 1/4 e 3/4 do comprimento, como a cena (ADR-041).
