# ADR-043 — lança entre colunas na interpolação: próxima mais longa

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Status**             | Aceito                                                        |
| **Data**               | 2026-10-16                                                    |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-16                        |
| **Tarefa relacionada** | TASK-096                                                      |
| **Substitui**          | ADR-030 quanto ao comprimento de lança (item 2 da decisão)    |

## Contexto

O ADR-030 interpola linearmente no raio e também entre as duas colunas vizinhas de comprimento de
lança. A auditoria de 2026-10-16 mostrou que a segunda interpolação contraria a nota padrão das
tabelas de fabricante, citada no ADR-029: para comprimentos entre os listados, use a capacidade da
próxima lança mais longa. Como a lança mais curta levanta mais no mesmo raio, interpolar entre as
colunas dá uma capacidade acima da coluna mais longa (exemplo FICTÍCIO: 30 m com 10 000 kg e 40 m
com 8 400 kg em 12 m → 9 200 kg em 35 m, contra 8 400 kg pela nota do fabricante). É o lado
inseguro.

## Decisão

A `LinearInterpolationLookup` continua sendo a estratégia da composição, com uma mudança:

- **comprimento de lança** igual (±ε) a uma coluna → essa coluna; entre colunas, ou abaixo da
  menor → a coluna da **próxima lança mais longa** (a regra do ADR-029). O comprimento não é
  interpolado. Acima da maior coluna continua `BOOM_LENGTH_ABOVE_CHART_MAX`;
- **raio**: segue a interpolação linear do ADR-030, só dentro da coluna escolhida.

A marca `LINEAR_INTERPOLATION_PROVISIONAL` e o campo `interpolated_points` continuam iguais; os
pontos usados passam a ser 1 ou 2, todos da mesma coluna.

## Consequências

- Entre colunas, a capacidade nunca passa da coluna mais longa.
- A utilização continua variando de forma contínua com o raio. Ao trocar de coluna (passar por um
  comprimento tabelado), a capacidade muda em degrau, como na leitura conservadora.
- Entre dois raios a reta ainda pode ficar um pouco acima da curva real (convexa): continua
  provisório até a PEND-001.
- Testes da estratégia em `backend/tests/domain/test_linear_interpolation_lookup.py`.
