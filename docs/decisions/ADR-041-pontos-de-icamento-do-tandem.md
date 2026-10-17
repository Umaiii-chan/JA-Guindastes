# ADR-041 — pontos de içamento do tandem a 1/4 e 3/4 do comprimento

| Campo                  | Valor                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| **Status**             | Aceito                                                                |
| **Data**               | 2026-10-16                                                            |
| **Autor**              | agente Claude Code (Opus 5.5), registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-16                                |
| **Tarefa relacionada** | TASK-089                                                              |
| **Confirma**           | ADR-037 § 4 (pontos a 1/4 e 3/4 do comprimento)                       |
| **Substitui**          | só a frase "(a 40 % do comprimento, para cada lado)" do ADR-038 § Decisão, "Tandem" |

## Contexto

A auditoria AUD-01 (achado F-03) viu que o tandem usava pontos de içamento diferentes em cada lugar:
a cena (ADR-037 § 4, `frontend/src/domain/tandem/tandem.ts`) põe os pontos a 1/4 e 3/4 do
comprimento da carga, e o planejador (ADR-038, `backend/app/domain/services/planning/tandem.py`) a
40 % do comprimento para cada lado do centro (10 % e 90 %). A divisão da carga pela alavanca do
centro de gravidade (RN-016) muda com a posição dos pontos, então o plano e a cena dividiam a carga
de jeitos diferentes.

## Decisão

Os pontos de içamento do tandem ficam a **1/4 e 3/4 do comprimento** da carga, nos dois lados: no
planejador, `HOIST_POINT_FRACTION = 0,25` (25 % do comprimento para cada lado do centro), igual à
cena. Isso confirma o ADR-037 § 4 e substitui só a frase dos 40 % do ADR-038; o resto do ADR-038
continua valendo.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| 1/4 e 3/4 nos dois lados (escolhida) | igual à cena e ao ADR-037 | os pontos ficam mais perto um do outro que a 10 % e 90 % | — |
| 10 % e 90 % nos dois lados | pontos mais afastados, carga mais estável | muda a cena e o ADR-037 | a pessoa responsável escolheu 1/4 e 3/4 |
| Manter os dois valores | nada muda | plano e cena dividem a carga de jeitos diferentes | é o bug F-03 |

## Consequências

**Positivas:**
- O planejador e a cena dividem a carga do mesmo jeito.

**Negativas / custos:**
- Com os pontos mais perto um do outro, o CG fora do trecho entre eles (o tandem é recusado) passa a
  acontecer com um deslocamento menor do CG: 1/4 do comprimento, em vez de 40 %.

**Riscos e como mitigar:**
- Nenhum risco novo: os números da tabela e da ficha continuam FICTÍCIOS (ADR-012).

## Impacto na documentação

- [ ] `docs/architecture.md` atualizado — não descreve os pontos de içamento
- [ ] `docs/development-guide.md` atualizado — comandos não mudaram
- [ ] `docs/known-gaps.md` atualizado — sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Verificado: `frontend/src/domain/tandem/tandem.ts` (`DEFAULT_LIFT_FRACTION = 0.25`) e o teste
  `test_pontos_de_icamento_a_um_quarto_e_tres_quartos_do_comprimento` em
  `backend/tests/application/test_recommend_lift_plan_zonas_tandem.py` (raio de coleta de cada
  guindaste medido até o ponto a 1/4 do comprimento).
- Decisão confirmada pela pessoa responsável em chat em 2026-10-16, repassada pelo coordenador.
