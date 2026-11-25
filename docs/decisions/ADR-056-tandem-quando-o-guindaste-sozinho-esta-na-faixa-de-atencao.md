# ADR-056 — tentar o tandem quando o melhor guindaste sozinho está na faixa de atenção

| Campo                  | Valor                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| **Status**             | Proposto                                                           |
| **Data**               | 2026-11-25                                                         |
| **Autor**              | agente Claude Code, implementador da TASK-123                      |
| **Decisores**          | Anderson Sehnem (escolheu o gatilho e a ordem da lista em 2026-11-25) |
| **Tarefa relacionada** | TASK-123                                                           |
| **Regras**             | RN-011 (faixa de atenção), RN-016 (tandem); sem mudança de cálculo |
| **Complementa**        | ADR-038, ADR-054                                                   |

## Contexto

O "Planejar operação" só tentava dois guindastes quando nenhum guindaste sozinho ficava dentro de
100 % do limite (ADR-038). Numa simulação gravada em 2026-11-25, a recomendação de um guindaste só
trabalhou a 89 % do limite, já na faixa de atenção (RN-011) e acima do corte de içamento crítico, e o
tandem não foi oferecido. A pessoa responsável pediu que, nesse caso, o planejamento recomende o tandem.

## Decisão

1. **Gatilho:** se o melhor guindaste sozinho válido usa, no pior ponto do caminho, uma utilização do
   limite igual ou maior que a faixa de atenção do próprio modelo (`warning_band_percent`, RN-011;
   padrão 90 %, configurável por guindaste), o planejamento também procura o tandem.
2. **Ordem:** havendo tandem válido, ele vem primeiro na lista (até 3) e as opções de um guindaste
   continuam depois, para a pessoa poder escolher. Sem tandem válido, a resposta é a de antes.
3. **Aviso:** a resposta leva uma nota com a utilização do guindaste sozinho e a faixa; a tela mostra
   "Recomendamos operar com 2 guindastes" explicando que um guindaste atende, mas em atenção.

O cálculo do tandem não muda (RN-016: cada guindaste com no máximo 75 % da capacidade). Um tandem
válido é listado primeiro mesmo que a utilização dele também esteja alta.

## Alternativas consideradas

- Gatilho no corte de içamento crítico (75 % da capacidade efetiva, RN-019): descartada pela pessoa
  responsável em favor da faixa de atenção.
- Mostrar só o tandem, ou o tandem depois do guindaste sozinho: descartadas pela pessoa responsável.

## Consequências

- Operações em faixa de atenção passam a custar uma busca a mais dentro do mesmo orçamento de tempo
  (`TIME_BUDGET_S`); se ele acabar, vale o que foi achado e a resposta sai com `timed_out`.
- A regra ainda não está em `docs/business-rules.md` (arquivo protegido): registrar lá é da pessoa
  responsável.
