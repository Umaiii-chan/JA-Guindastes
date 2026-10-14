# ADR-030 — interpolação linear provisória na tabela de carga

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Status**             | Aceito                                                        |
| **Data**               | 2026-10-14                                                    |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                        |
| **Tarefa relacionada** | TASK-059                                                      |
| **Substitui**          | ADR-015 e ADR-029 como estratégia usada na composição          |

## Contexto

Com a consulta conservadora (ADR-015/029), a utilização mudava em degraus: só quando a lança
trocava de coluna ou o raio cruzava um ponto da tabela. A pessoa pediu variação contínua, como no
limitador de carga da cabine.

## Decisão

A composição (`app/main.py`) usa a `LinearInterpolationLookup`:
- interpolação linear no raio, dentro de cada coluna;
- depois, interpolação linear entre as duas colunas vizinhas de comprimento de lança.

Não há extrapolação. Abaixo da menor coluna vale a menor coluna; acima da maior, o motivo é
`BOOM_LENGTH_ABOVE_CHART_MAX`. O resultado vem marcado `LINEAR_INTERPOLATION_PROVISIONAL`, e a
resposta traz os pontos usados (`interpolated_points`). O HUD mostra "interpolado entre pontos da
tabela".

As estratégias `ConservativeTabulatedLookup` e `ExactPointLookup` ficam no código, atrás da mesma
porta, e podem voltar trocando uma linha da composição.

## Consequências

- A simulação varia de forma contínua.
- A curva de capacidade costuma ser convexa, então entre dois pontos o valor interpolado pode ficar
  um pouco **acima** do real. É menos conservador, e por isso o valor é marcado como provisório
  (PEND-001 continua aberta para a Guindastes Ribas).
- Testes específicos da estratégia ficam para depois (`handoffs/TASK-059.md`).
