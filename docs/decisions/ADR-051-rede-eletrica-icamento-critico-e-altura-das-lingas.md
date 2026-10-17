# ADR-051 — distância mínima de rede elétrica, içamento crítico e altura única das lingas

| Campo                  | Valor                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Status**             | Aceito                                                                             |
| **Data**               | 2026-10-17                                                                         |
| **Autor**              | agente Claude Code, implementador da TASK-107                                      |
| **Decisores**          | Anderson Sehnem (D4 e F-19, delegadas: "decida por mim, quanto mais real melhor")  |
| **Tarefa relacionada** | TASK-107                                                                           |
| **Complementa**        | ADR-042 (colisão do planejador), ADR-041 (tandem), ADR-050 (estabilidade por física) |

## Contexto

**D4.** O simulador não conhecia rede elétrica aérea. **F-19.** A altura das lingas tinha quatro
definições: o planejador (metade do maior lado, 0,6 a 3 m), a cena do guindaste único (a mesma conta
no frontend), o tandem (1,5 m fixos) e a cena depois de engatar (a folga medida no instante do engate).
O plano e a cena discordavam, e a carga planejada não pousava onde o plano dizia.

## Decisão

### D4 — rede elétrica e içamento crítico

1. **Cenário:** lista opcional `power_lines` (`id`, `label`, `x1_m`, `z1_m`, `x2_m`, `z2_m`,
   `height_m`, `voltage_kv`). Trecho reto horizontal, altura de 0,5 a 200 m, tensão de 0 (exclusive) a
   1000 kV, até 20 trechos. **A tensão é entrada do ambiente**: o editor oferece uma lista (0,38 a
   1000 kV) e aceita outro valor.
2. **Distância mínima** (`domain/services/power_line.py`): a **Tabela A do OSHA 29 CFR 1926.1408**, conferida em
   osha.gov — até 50 kV, 10 pés (3,05 m); acima de 50 até 200 kV, 15 pés (4,57 m); acima de 200 até 350,
   20 pés (6,10 m); acima de 350 até 500, 25 pés (7,62 m); acima de 500 até 750, 35 pés (10,67 m); acima de 750
   até 1000, 45 pés (13,72 m). O limite da faixa pertence a ela. Fora de 0–1000 kV, recusa. (A versão inicial
   usava a fórmula antiga "10 pés + 0,4 pol por kV", passada de memória; foi trocada pela Tabela A.)
3. **Conferência:** distância 3D mínima entre o cabo e a lança (pino→ponta), o cabo de aço
   (ponta→gancho) e a carga pendurada (cilindro com a meia-diagonal da pegada; no tandem, o alcance até o canto mais afastado da metade içada), **agora e com o giro
   varrido de 0° a 360°** (passo de 1°). Abaixo da mínima: alerta CRÍTICO
   (`POWER_LINE_CLEARANCE_VIOLATION`, ou `POWER_LINE_SWEPT_VIOLATION` se só o giro viola); abaixo de
   1,5× a mínima: atenção.
4. **Planejamento:** cada trecho vira um sólido elevado (zona: a caixa do trecho crescida da distância
   mínima em todas as direções), tratado como obstáculo. A varredura do ADR-042 já engrossa lança, cabo
   e carga e confere o caminho inteiro, então a regra vale para as três partes em qualquer posição do
   plano. Teste independente: sem a rede o plano chega a 2,25 m do cabo (< 3,05 m); com ela, nunca fica
   abaixo da mínima.
5. **Içamento CRÍTICO** (`domain/services/critical_lift.py`), qualquer gatilho: carga ≥ 75 % da
   capacidade efetiva; tandem; carga sobre pessoas ou estruturas ocupadas (informado pelo usuário);
   distância à rede abaixo de 1,5× a mínima (varrida pelo giro); vento acima de 70 % da velocidade
   máxima de rajada da carga (`wind_limit_ms`, EN 13000, ADR-050); solo em atenção ou inclinação a 70 %
   ou mais do máximo do modelo. O alerta `CRITICAL_LIFT` (severidade atenção: crítico não é proibido)
   traz **a razão e o plano de içamento exigido** (responsável técnico, memória de cálculo, supervisor e
   sinaleiro, análise de risco e permissão de trabalho, mais itens por gatilho: rede/NR-10, tandem,
   evacuação, vento, solo).
6. **Contrato:** `site` opcional no `POST /evaluations` e no WebSocket (rede, posição do guindaste,
   medidas da carga, ângulo das lingas, tandem, carga sobre ocupados). Sem `site`, a avaliação é a de
   antes. Com ele, a resposta traz `power_lines` e `critical_lift`. Os alertas novos entram **depois**
   do `assess_safety` e **não mudam o `tipping_risk`**. A tela manda o `site` sempre.
7. **NR-10 e NR-11** são o contexto normativo brasileiro (instalações elétricas; movimentação de
   materiais). Nenhuma traz tabela própria de distância de guindaste: vale o valor do item 2, e as
   normas ficam citadas no plano exigido.

### F-19 — uma só fonte da altura das lingas

1. **Geometria real de rigging** (`domain/services/rigging.py`;
   `frontend/src/domain/rigging/slingGeometry.ts`): amarração em ponte, do fim do gancho (ou da cadeia
   de acessórios) até os cantos do topo da carga. `r` = meia-diagonal da pegada (no tandem, a da metade
   que cada guindaste ergue); `α` = ângulo da linga com a **horizontal**; `L = r / cos α`;
   **queda = r · tan α**, piso de 0,3 m.
2. **Padrão** α = 60°; se a linga passar de 8 m, 45°; se ainda passar, 45° e o aparelho real pediria
   balancim (`needs_spreader`). Ângulo informado: de 30° (ASME B30.9) a 85° (perto de 90° a queda explode); fora disso, 422.
3. **Planejador e cena usam a mesma conta.** O plano devolve `sling_length_m`, `sling_angle_deg` e
   `sling_drop_m` por guindaste e aceita `sling_angle_deg`. O gancho de coleta do plano fica a `queda`
   acima do topo da carga (lingas esticadas).
4. **Engate da cena** passa a ser o das lingas esticadas: vale com o fim do gancho de −0,1 m a +0,5 m
   em torno de `queda` acima do topo. A altura gravada é a da geometria, **não** a folga medida: ao engatar, a carga pode subir até 0,5 m ou
   afundar até 0,1 m (o ajuste ao ponto em que as lingas esticam). O
   tandem usa `tandemSlingDropM` (a constante de 1,5 m saiu).
5. **Paridade provada** por uma tabela de casos única,
   `backend/tests/fixtures/sling_geometry_cases.json`, lida pelo pytest e pelo vitest. A tabela de
   distância de rede tem a sua, `power_line_clearance_cases.json`.

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Conferir só a ponta da lança | a lança, o cabo e a carga também podem encostar; o giro muda a posição |
| Regra nova só para a rede no planejador | a varredura existente já cobre as três partes; a zona elevada a reaproveita e tem teste independente |
| Manter a altura heurística e só alinhar os dois lados | continuaria sem relação com o ângulo real da linga |
| Esfera exata nas pontas da zona | a caixa em quina é um pouco mais conservadora e usa a colisão existente |

## Consequências

- Cargas pequenas e compridas têm lingas mais altas que antes (a 60°): o gancho sobe, e planos com
  pouco vão (sob arco, galpão) podem fechar só com ângulo menor (`sling_angle_deg`). Testes de cena e
  colisão foram ajustados a isso.
- A zona do planejador tem pontas em quina e altura inteira; o terreno sob a rede é tratado como plano na
  avaliação (apoio em y = 0).
- A UI não tem controle do ângulo da linga (backend e cliente aceitam); fica o padrão.
- A altura de amarração medida na cena (`hook_attach_m`) ainda não vai no `site` da avaliação: vale o
  padrão de 1,05 m (diferença de decímetros na distância da carga).

## Impacto na documentação

- [x] `docs/known-gaps.md` (L-018 e L-019)
- [x] índice em `docs/decisions/README.md`
- [ ] `docs/business-rules.md` não foi alterado por agente: as regras de rede elétrica e de içamento
  crítico precisam ser registradas pela pessoa responsável (RN a numerar).

## Evidências

Backend: `tests/domain/services/test_power_line.py`, `test_rigging.py`,
`tests/application/test_evaluate_operation_site.py`, `tests/domain/services/planning/test_planner.py`
(rede e plano), `tests/presentation/` (REST, WebSocket, planejamento). Frontend: `tests/domain/rigging`,
`tests/domain/environment/powerLine.test.ts`, `tests/infrastructure/api/evaluationSiteContract.test.ts`,
`tests/three/scene/powerLineMeshes.test.ts`, `tests/presentation/panels/PowerLinePanels.test.ts`.
