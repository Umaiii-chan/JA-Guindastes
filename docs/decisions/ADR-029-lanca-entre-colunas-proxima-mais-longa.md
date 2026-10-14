# ADR-029 — lança entre colunas da tabela: próxima lança mais longa

| Campo                  | Valor                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| **Status**             | Aceito                                                             |
| **Data**               | 2026-10-14                                                         |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável      |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14 ("quero trazer uma simulação real") |
| **Tarefa relacionada** | TASK-050                                                           |
| **Substitui**          | ADR-015 item 1 (comprimento de lança exato)                        |

## Contexto

A consulta conservadora (ADR-015) só avaliava comprimentos de lança iguais a uma coluna da tabela.
Como o slider anda de 0,1 em 0,1 m, a simulação mostrava "não avaliável" quase o tempo todo. Uma
primeira correção encaixava o slider nas colunas, mas a pessoa responsável rejeitou: a lança
telescópica real se move continuamente.

## Decisão

Para um comprimento de lança entre colunas (ou abaixo da menor), a consulta usa a coluna da
**próxima lança mais longa**. Essa é a nota padrão das tabelas de carga de fabricante: para
comprimentos entre os listados, vale a capacidade da próxima lança mais longa. Dentro da coluna, o
raio segue o ADR-015: menor capacidade dos dois raios vizinhos. Acima da maior coluna, o resultado
é "não avaliável" com o motivo `BOOM_LENGTH_ABOVE_CHART_MAX`. Nenhum comprimento é interpolado.

A regra continua **PROVISÓRIA** até a Guindastes Ribas confirmar as notas da tabela oficial
(PEND-001..003).

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Encaixar o slider nas colunas | rejeitada pela pessoa: não é como o guindaste opera |
| Interpolar entre colunas | cria valores que não estão na tabela (PEND-001 aberta) |
| Menor capacidade das duas colunas vizinhas | não é a leitura de tabela usada na operação real |

## Consequências

- O slider da lança é livre e a avaliação responde em todo o curso coberto pela tabela.
- O resultado informa o ponto tabelado usado, inclusive o comprimento da coluna, no "Detalhes da
  consulta".
- O cenário D da demo (`docs/demo.md`) passou a ser avaliado.
