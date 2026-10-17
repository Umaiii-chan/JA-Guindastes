# ADR-052 — entrega sobre contêiner, carreta prancha e qualquer objeto com superfície de apoio declarada

| Campo                  | Valor                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Status**             | Proposto                                                                           |
| **Data**               | 2026-10-17                                                                         |
| **Autor**              | agente Claude Code, implementador da TASK-108                                      |
| **Decisores**          | Anderson Sehnem (pendente de confirmação)                                          |
| **Tarefa relacionada** | TASK-108                                                                           |
| **Substitui**          | a Decisão 1 do ADR-049 (apoio só no caminhão plataforma) e a pendência "outros objetos de topo plano" do ADR-046 |
| **Complementa**        | ADR-046 (critério do centro da pegada), ADR-047 (a carga acompanha o objeto), ADR-049 (cabine bloqueia, cabo isento), ADR-036 (biblioteca de objetos) |

## Contexto

Até o ADR-049 só o caminhão plataforma da biblioteca recebia a carga por cima, e o planejador e a cena
tinham o número dele escrito à mão (`caminhao-plataforma`, 0,53 da altura). O pedido da TASK-108 é cobrir
qualquer simulação "o mais próximo do real": a carga também pode ser entregue (e coletada) sobre um
**contêiner** (20 e 40 pés), uma **carreta/prancha** e qualquer objeto que declare uma superfície de
apoio, pelo mesmo critério do centro da pegada, acompanhando o objeto movido, na cena e no planejador e
no layout da IA, com paridade entre os dois lados.

## Decisão

1. **Superfície de apoio declarada.** Recebe carga por cima todo objeto da biblioteca que declara um
   `loadBed` (`objectLibrary.ts`): uma das caixas de colisão dele, cujo topo (`y + h`) é a altura de
   apoio. Hoje declaram: `caminhao-plataforma` (a carroceria, 0,53 da altura, como antes), `carreta-prancha`
   (o convés inteiro, a 1,5 m), `conteiner` (genérico) e os contêineres ISO `conteiner-20`, `conteiner-40` e
   `conteiner-40hc` (o teto inteiro). Objeto novo passa a receber carga declarando o seu `loadBed`.
   Uma **caixa** comum (mesmo chamada "carreta") continua sem apoio (ADR-049, Decisão 1, só ampliada).
2. **Critério e acompanhamento: os de sempre.** O apoio vale quando o **centro da pegada** cai dentro da
   superfície de apoio (retângulo girado e escalado com o objeto; borda conta); senão vale o terreno e o
   objeto é obstáculo comum (ADR-046). A carga solta acompanha o objeto movido, girado ou redimensionado
   no editor, e fica onde está se ele some ou vira outro modelo (ADR-047; `cargoFollow.ts`, já genérico).
3. **Medidas reais dos contêineres (ISO 668, externas).** 20 pés: 6,058 × 2,438 × 2,591 m; 40 pés:
   12,192 × 2,438 × 2,591 m; 40 pés *high cube*: 12,192 × 2,438 × 2,896 m (altura de 8,5 pé, 9,5 pé no *high
   cube*). Entram na paleta (`defaultSize`) com essa medida; o modelo 3D é o mesmo GLB do contêiner genérico
   (Kenney, 2,72 × 6 × 2,54 m), esticado por eixo até ela: o teto é plano, só o visual das ondulações e das
   portas é aproximado. O contêiner genérico (`conteiner`) continua com a medida do modelo, para os
   cenários já salvos não mudarem; a IA recebe os contêineres ISO com a medida fixa (`keepLibraryProportions`).
4. **Carreta prancha.** Objeto novo, `carreta-prancha`: semirreboque plano de 3 eixos, convés de 2,6 × 13 m a
   1,5 m do chão, com o pino-rei em +Z. As medidas são típicas e **FICTÍCIAS** (não são de um fabricante). O GLB é
   desenhado por código (`scripts/build-carreta-prancha.mjs`), sem kit de terceiros e sem textura.
5. **Capacidade de carga do apoio: se há dado, vale; se não há, FICTÍCIO.** `LoadBedInfo.capacityKg`
   (frontend) e `SupportSpec.capacity_kg` (backend). **Com** capacidade conhecida: o planejador não entrega
   carga mais pesada que ela (o apoio vira obstáculo comum e a recusa diz os números) e a dica da soltura na
   cena avisa; na coleta o peso não se confere (a carga já está lá). **Sem** capacidade conhecida, o apoio é
   rotulado **FICTÍCIO** (`NO_CAPACITY_SOURCE`): o peso não é limitado e o plano e a dica dizem, em texto,
   que o peso apoiado não foi conferido. **Hoje nenhum apoio tem capacidade conhecida**, então todos são
   FICTÍCIOS e o comportamento antigo do caminhão (sem limite de peso) não muda.
6. **Paridade frontend ↔ backend por dourado.** `backend/tests/fixtures/support_surfaces.golden.json` guarda,
   por objeto, o tamanho do modelo, as caixas de colisão, o `loadBed` e a capacidade. É conferido pelo teste
   do backend contra `LOAD_SUPPORTS` (`library_boxes.py`) e pelo do frontend contra `OBJECT_LIBRARY`
   (`supportSurfaces.parity.test.ts`): mudar um número de um lado só quebra um deles.
7. **Planejador e layout da IA.** `library_boxes.LOAD_SUPPORTS` generaliza o que era do caminhão: `bed_contains`,
   `support_top_y` e as partes mais altas que o apoio (a cabine do caminhão; contêiner e prancha não têm) vêm
   do registro. O layout seguro da IA deixa qualquer apoio ficar no ponto de entrega (`scenario_layout.py`), o
   assistente conhece os ids novos (`ai_prompts.LIBRARY_MODELS`) e as notas do plano falam do apoio: texto da
   dica por tipo, rótulo FICTÍCIO ou a capacidade conferida.
8. **Cabo e lança.** Como no ADR-049: o cabo não é conferido contra o objeto que apoia a carga (coleta e
   entrega); a lança continua conferida; a carga apoiada não invade as partes mais altas do apoio.

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Tratar qualquer caixa/objeto "de topo plano" como apoio | a cena só sabe a altura de apoio de quem declara; um objeto sem `loadBed` (sedan, caminhão baú) teria a carga flutuando ou afundando |
| Um campo de apoio em cada obstáculo do cenário (qualquer caixa vira apoio) | muda o esquema do cenário (API, banco, editor) e reabre o ADR-049; fica como pendência |
| Capacidade FICTÍCIA com número (por exemplo 12 t no caminhão) | um número inventado passaria a **recusar** planos que hoje funcionam; só dado conhecido limita |
| Um GLB próprio para cada contêiner (20, 40, 40 HC) | só há um modelo livre (Kenney); esticar o mesmo GLB dá a medida ISO e o teto plano certos, com visual aproximado |
| Usar a carga útil ISO (cerca de 28 t) como capacidade do teto | a carga útil é a de dentro; o teto de um contêiner não é dimensionado para carga içada (ver abaixo) |

## Consequências

- Carga sobre o teto de um contêiner **não é uma operação normal na realidade**. HIPÓTESE, não verificada nesta
  tarefa: o ensaio de resistência do teto da ISO 1496-1 cobre uma carga pontual de pessoa (da ordem de 300 kg
  numa área de 600 × 300 mm), não carga içada; o empilhamento real se apoia nos cantos (fundições). Por isso o
  teto é FICTÍCIO (sem dado de capacidade): a cena e o plano permitem a simulação e **dizem** que o apoio é
  fictício. Quem tiver a capacidade real de cada apoio informa em `capacityKg`/`capacity_kg` (e no dourado).
- O teto do contêiner fica a 2,59 m (2,90 m no *high cube*): o plano precisa de lança e raio para erguer a carga
  a essa altura; com a ficha FICTÍCIA da fixture o plano fecha para o contêiner de 20 pés e para a prancha
  (`test_recommend_lift_plan_apoios.py`); os de 40 pés têm o apoio coberto nos testes de apoio, não num plano completo.
- Cenários salvos com `conteiner` (genérico) agora recebem carga em cima dele, a 2,54 m (a altura do modelo).
- Carga solta sobre um contêiner acompanha-o se ele for movido, e fica no terreno se ele for trocado por outro
  modelo (inclusive de 20 para 40 pés, outro `modelId`).
- A recusa do planejador para uma caixa comum no ponto de entrega agora lista os apoios aceitos (caminhão
  plataforma, carreta prancha e contêiner).
- Fica como pendência: carga empilhada sobre carga e objetos do usuário com apoio declarado no cenário.

## Impacto na documentação

- [x] `docs/known-gaps.md` (L-016) atualizado
- [x] índice em `docs/decisions/README.md` atualizado
- [x] `frontend/public/models/objetos/CREDITS.md` (carreta prancha e contêineres esticados)

## Evidências

- Frontend: `tests/domain/cargo/loadSupports.test.ts` (medidas ISO, topo, centro da pegada, giro, acompanhar o
  objeto, capacidade e rótulo FICTÍCIO), `tests/domain/environment/supportSurfaces.parity.test.ts` (dourado) e o
  teste dos GLBs de `objectLibrary.test.ts` (inclui a prancha).
- Backend: `tests/domain/services/planning/test_support_surfaces.py` (dourado, registro, apoio, capacidade, layout)
  e `tests/application/test_recommend_lift_plan_apoios.py` (plano de ponta a ponta sobre contêiner e prancha, notas
  FICTÍCIO e capacidade).
