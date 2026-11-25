# ADR-055 — busca do tandem: sentidos opostos medidos pela distância entre os ganchos

| Campo                  | Valor                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Status**             | Proposto                                                                |
| **Data**               | 2026-11-25                                                              |
| **Autor**              | agente Claude Code, implementador da TASK-121                           |
| **Decisores**          | Anderson Sehnem (pendente: muda o critério da TASK-089/F-04)            |
| **Tarefa relacionada** | TASK-121                                                                |
| **Regras**             | RN-016 (sem mudança); critério F-04 da TASK-089 (refinado)              |
| **Complementa**        | ADR-038, ADR-041, TASK-090 (tolerância do gancho no ponto)              |

## Contexto

No uso real o "Planejar operação" quase nunca recomenda dois guindastes. Diagnóstico (2026-11-25, viga
10 × 0,6 × 0,8 m, tabelas FICTÍCIAS): o planejador descartava **todo** par com um guindaste de cada
lado girando em sentidos opostos ("giros em sentidos opostos", TASK-089/F-04). A razão da regra: a
carga é rígida, e a distância entre os dois ganchos não pode mudar no caminho. Mas a regra era um
atalho do arco (azimute e raio em linha reta) — ela recusa também os pares em que a distância **não**
muda. Medi: com a regra desligada, 5 t a 3 m (nos dois eixos) fecham em tandem a 86 %; a distância entre
os ganchos varia só 0,01 a 0,27 m. Ampliar a busca (`keep` 6 → 40) **não** mudou nenhum resultado: o
limite não é a largura da busca, é o descarte.

## Decisão

1. **Passo 1 (implementado na TASK-121).** Par em sentidos opostos deixa de cair por ser de sentidos
   opostos; cai só se a distância horizontal entre os ganchos, nos 13 pontos do giro (os arcos da
   própria busca), se afasta da que tinha na coleta em mais que `TANDEM_HOOK_POINT_TOLERANCE_M`
   (0,5 m, FICTÍCIO, a mesma da TASK-090 — a pessoa responsável pode trocar). Sem pontos de içamento
   para medir, cai como antes. Mesmo sentido: sem mudança (continua aceito). Nenhuma regra física
   nova: continua valendo "a carga rígida acompanha os dois ganchos".
2. **Passo 2 (proposto, não implementado).** Translações laterais longas (medi 0,9 a 1,5 m de variação
   para 6 a 8 m) seguem recusadas, porque cada guindaste planeja o arco dele. A saída é planejar o par
   **em conjunto**: uma trajetória rígida da carga (translação e giro lineares entre a pose de coleta
   e a de entrega), da qual cada guindaste deriva raio e giro em cada amostra (R e ψ pela posição do
   gancho no mundo), e avaliar capacidade, obstáculos e colisões com esses estados. Assim a distância
   fica constante por construção e os lados opostos deixam de ser problema. É uma mudança no modelo da
   trajetória (`sweep.py`/`planner.py`), com a cena do tandem já seguindo os ganchos
   (`MultiCrane`); fica para uma tarefa própria depois da decisão desta.
3. **Fora do escopo:** o limite de capacidade (90 % → 80 %, pedido em outra sessão) não foi tocado; a RN-016
   (75 %, alavanca) não muda.

## Consequências

- Casos de 5 t a 3 m (lateral e axial) passam a recomendar tandem válido; os testes cobrem.
- Pares aceitos em sentidos opostos têm até 0,5 m de variação entre ganchos no pior ponto do arco; a
  conferência do tandem na tela (TASK-090) continua exigindo o gancho a até 0,5 m do ponto.
- Cargas pesadas demais para a tabela (ex.: 6 e 8 t na tabela fictícia) seguem sem opção válida: é
  capacidade, não busca.
- **A confirmar:** (a) refinar o critério da TASK-089 (o item que recusava sentidos opostos) como acima;
  (b) a tolerância de 0,5 m para a variação; (c) abrir a tarefa do passo 2.
