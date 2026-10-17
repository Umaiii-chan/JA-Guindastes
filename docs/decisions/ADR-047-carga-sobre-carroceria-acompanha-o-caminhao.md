# ADR-047 — carga solta sobre a carroceria acompanha o caminhão movido no editor

| Campo                  | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Status**             | Proposto                                                 |
| **Data**               | 2026-10-17                                               |
| **Autor**              | agente Claude Code, implementador da TASK-103            |
| **Decisores**          | Anderson Sehnem                                          |
| **Tarefa relacionada** | TASK-103                                                 |
| **Complementa**        | ADR-046 (segue Proposto e sem mudança)                   |

## Contexto

O ADR-046 deixa soltar a carga sobre a carroceria do caminhão plataforma. A carga solta é guardada
como posição no mundo (x, z, giro). Se o caminhão for movido, girado ou redimensionado no editor do
ambiente, a carga ficava para trás, no ar ou no chão, longe do caminhão.

## Decisão

1. **Acompanhar** (e não só reassentar): ao mudar o cenário, a carga no chão cuja pegada cobre a
   carroceria de um caminhão (mesmo `id`) é movida com ele. A posição em relação ao centro do caminhão
   gira com o giro dele, o afastamento acompanha a escala do caminhão e o giro da carga soma o do
   caminhão. A altura não é guardada: `cargoBaseY` a recalcula, então ela acompanha o terreno sob o
   caminhão.
2. Se o caminhão sai do cenário, ou é trocado por um modelo diferente, a carga **fica onde está** e
   reassenta no apoio que houver ali (terreno ou outra carroceria).
3. Só vale para a carga solta (`phase: 'ground'`) em operação ao vivo. Carga no gancho, carga ao
   lado do caminhão e a posição inicial escolhida no editor não mudam; mudar a posição inicial
   continua devolvendo a carga ao chão (ADR-035).

## Consequências

- Mudança de posição do caminhão e a carga junto ficam num único redesenho da cena.
- Um caminhão movido enquanto a carga está no gancho não leva nada: ao soltar, ela assenta no apoio
  do lugar.
- Reprodução de gravação não é alterada (o quadro traz a posição da carga).
