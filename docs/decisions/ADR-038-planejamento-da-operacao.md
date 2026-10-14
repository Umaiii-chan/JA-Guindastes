# ADR-038 — planejamento da operação: guindaste, posição e trajetória

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Status**             | Aceito                                                        |
| **Data**               | 2026-10-14                                                    |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, pedido em chat em 2026-10-14                 |
| **Tarefa relacionada** | TASK-075                                                      |
| **Regras**             | RN-004, RN-008, RN-011 a RN-015                               |

## Contexto

A pessoa pediu que o simulador, dada a carga, recomende o modelo de guindaste (ou dois, se for
preciso), sugira onde posicioná-lo, planeje a trajetória (pegar no ponto de coleta e levar à entrega)
e tenha um modo passo a passo. A capacidade e a segurança só podem vir do cálculo determinístico
(tabela, limites e RN-011 a RN-015), nunca de IA nem de heurística sem tabela.

## Decisão

- **Onde fica.** O planejador é serviço de domínio puro em `backend/app/domain/services/planning/`
  (terreno, solo, cena, corpo do guindaste, tandem, trajetória e busca). A capacidade entra por um
  `StateEvaluator` injetado; o caso de uso `RecommendLiftPlan` (aplicação) o liga ao `EvaluateOperation`,
  então cada estado do caminho passa pela mesma avaliação da tela (tabela, limite do modelo,
  inclinação, vento, solo, obstáculos e risco). `POST /api/v1/planning/recommend` (mesma autorização
  da avaliação) só traduz o JSON.
- **Busca.** Para cada configuração com ficha técnica e tabela ativa: grade de posições de 2 m ao
  redor da coleta e da entrega, até o maior raio da tabela; descarta posições com o corpo do guindaste
  sobre obstáculo ou sobre a coleta e a entrega, inclinação acima do limite do modelo e solo que não
  suporta a sapata. Em cada posição, testa o rumo do chassi centrado no giro e girado de 90° em 90°
  (giro livre) e fica com o de menor tempo.
- **Caminho.** O giro é amostrado da coleta à entrega (12 trechos), com o raio interpolado. Vale o
  sentido de menor tempo estimado: giro mais subida e descida extras para passar sobre obstáculos.
  Assim o sentido curto vence mesmo cruzando um obstáculo baixo, e o longo só vence se o obstáculo do
  curto é alto demais. (O pedido dizia "o mais curto que não cruze obstáculo"; como a carga viaja a
  topo do mais alto + 1 m, cruzar um obstáculo baixo passou a custar só a subida.) A base da carga
  viaja 1 m acima do topo do obstáculo mais alto do caminho, do terreno e do corpo do guindaste.
- **Lança.** Entre os comprimentos das tabelas, o que minimiza a utilização máxima ao longo do
  caminho; o ângulo sai do raio (R = a + L·cos θ) e precisa caber na ficha técnica, assim como o cabo
  na altura de transporte. O comprimento escolhido é testado por estados reais (coleta, meio e
  entrega; depois todas as amostras dos melhores).
- **Ranking.** Válidas primeiro (utilização até 100 % do limite e sem risco alto), depois menor
  utilização máxima (a 0,1 %) e menor risco. Sem configuração única válida, tenta o tandem; sem nenhuma
  opção válida, devolve as melhores, marcadas como não atendem.
- **Tandem.** Dois guindastes, cada um com no máximo 75 % da capacidade dele, com a carga dividida
  pela alavanca dos pontos de içamento (a 40 % do comprimento, para cada lado) em relação ao centro de
  gravidade (`tandem.py`, o mesmo cálculo do contrato da TASK-074). Cada lado é planejado como um
  guindaste com metade do peso; os pares precisam de 8 m entre os eixos, e as duas trajetórias têm
  os mesmos instantes por fase.
- **Trajetória.** Quadros-chave `aproximar → engatar → levantar → girar → baixar → soltar` com os
  estados L, θ, ψ e c; ψ é contínuo (pode passar de ±180°). Velocidades de animação FICTÍCIAS.
- **Corpo do guindaste.** As medidas do modelo 80 t (X ±3,10 m, Z de -5,13 a 9,22 m, 4,6 m de
  altura, medidas no GLB) entram no cálculo para a carga não pousar nem passar por dentro dele
  (`crane_body.py`). A tela manda `hook_attach_m` (medido no gancho do modelo) para o gancho descer
  até a carga sem a guarda de colisão cortar o movimento.
- **Tela.** Painel "Planejar operação": coleta e entrega (campos numéricos), recomendações, "Aplicar"
  (escolhe a configuração, posiciona o guindaste, estende as patolas e assume o estado inicial),
  "Executar trajetória" (anima os estados na cena, 1×, 2× ou 4×) e "Passo a passo" (próxima ação por
  fase, conferida com tolerância). Marcadores no chão para a coleta e a entrega.
- **Cenário.** O cenário ganha `cargo` e `delivery` (opcionais; contrato da TASK-073).

## Consequências

- Todos os números de terreno, corpo do guindaste, velocidades e tolerâncias são FICTÍCIOS (ADR-012).
- O tandem usa uma aproximação: cada guindaste segue a própria trajetória entre os pontos de içamento
  dele; a rigidez da carga não é verificada, e o simulador anima só o primeiro guindaste (o contrato
  `cranes` da TASK-074 mostrará os dois).
- O planejamento assume patolas estendidas e apoiadas (como a tabela).
- O corpo do guindaste é o do modelo 3D 80 t; com outro modelo, as medidas passam a vir da ficha.
- Terreno, solo e sapatas têm uma cópia em Python (`terrain.py`) do código do frontend; os testes de
  paridade (`test_terrain.py` e `terrainParity.test.ts`) conferem os mesmos números.
- A busca é limitada (30 posições por configuração e 2,5 s); em cenários grandes, a resposta usa o
  que já foi achado.
