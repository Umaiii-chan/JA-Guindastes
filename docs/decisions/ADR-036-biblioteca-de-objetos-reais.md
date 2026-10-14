# ADR-036 — biblioteca de objetos reais no editor 3D

| Campo                  | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Status**             | Aceito                                                       |
| **Data**               | 2026-10-14                                                   |
| **Autor**              | agente Claude Code, registrando pedido da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                       |
| **Tarefa relacionada** | TASK-072                                                     |
| **Complementa**        | ADR-023 (cenários), ADR-028 (colisões) e ADR-032 (editor 3D) |

## Contexto

Os obstáculos do editor eram só caixas e cilindros. Para simular obras de verdade faltavam árvores,
casas, caminhões, carros e, principalmente, um barracão de onde a carga possa sair, com paredes,
teto e porta.

## Decisão

1. **Biblioteca em escala real** (`frontend/src/domain/environment/objectLibrary.ts`): cada objeto
   tem `id`, nome, categoria (`vegetacao`, `edificacao`, `veiculo`, `guindaste`, `outro`), o GLB, o
   tamanho `baseSize` em metros e as caixas de colisão no referencial do objeto (origem no centro da
   planta, base em y = 0, frente em +Z; cada caixa é `{ x, z, y, w, d, h }`: centro no plano, base
   em `y` e tamanhos). São 18 objetos: 6 de vegetação, 4 construções, 6 veículos, um contêiner e um
   guindaste estacionado.
2. **Obstáculo do tipo `model`**: `Obstacle.kind` ganha `'model'`, com `modelId` (id da biblioteca).
   `widthM`, `depthM` e `heightM` são o tamanho já escalado; a escala de cada eixo é esse tamanho
   dividido pelo `baseSize`, e as caixas escalam junto. O editor move, gira e redimensiona como os
   demais obstáculos. Contrato aditivo no backend dos cenários (`kind: "model"` exige `model_id`
   de 1 a 64 caracteres; os outros tipos não aceitam `model_id`). O backend só guarda o id: a
   biblioteca é do frontend. Um `modelId` desconhecido (cenário de outra versão) volta a ser uma
   caixa do tamanho do obstáculo.
3. **Modelos**: kits CC0 da Kenney (Nature, Suburban, Industrial e Car Kit), baixados antes e
   mantidos fora do Git (`assets/source/kenney/`). `frontend/scripts/build-object-library.mjs`
   escala cada um até o tamanho real (árvores de 7,7 a 9 m, casa de 7 m, galpão de 8,4 m, caminhão de
   8 m, carro de 4,5 m), assenta a base em y = 0, centra a planta, solda e quantiza; os arquivos
   ficam em `frontend/public/models/objetos/` (cerca de 660 KB no total) com créditos em `CREDITS.md`. O
   "guindaste estacionado" usa o próprio `guindaste-80t.glb`, na pose de repouso, com as caixas
   medidas nos nós do arquivo.
4. **Barracão aberto gerado por código**: os galpões da Kenney são maciços, com o portão só pintado.
   O script gera um barracão de 14 × 18 × 8,8 m com porta de 8 × 6 m na frente (+Z), piso e
   telhado de duas águas translúcido (para ver a carga lá dentro de cima). As caixas de colisão são
   o fundo, as duas laterais, dois pilares e a verga da porta e o forro/telhado em degraus (sólido
   de 7 m, o beiral, até a água). Assim a carga e o gancho entram pela porta, e o teto os barra de
   cima para baixo. Um teste confere o tamanho de cada GLB com o `baseSize`.
5. **Colisão** (`domain/collision`): `obstacleObbs` devolve uma caixa orientada por caixa da
   biblioteca, girada com o objeto em torno do centro da planta e com a base na altura do terreno no
   centro. Caixa e cilindro seguem com uma só (`obstacleObb`). A carga e o gancho colidem com cada
   caixa (RN-012: o comando é barrado no último estado seguro); cabo e lança só avisam, uma vez por
   objeto e segmento, como antes (ADR-028). A avaliação continua mandando o id do objeto em
   `obstacle_conflicts`, do mesmo jeito.
6. **Cena** (`three/scene`): `ObjectModels` carrega cada GLB uma vez e dá cópias que dividem
   geometria e materiais (20 árvores custam um arquivo); `ObstacleMeshes` assenta a base no
   terreno, aplica a escala e as sombras, e põe um bloco translúcido até o arquivo chegar. A
   seleção no editor é um contorno à parte (o modelo é compartilhado, então não se pinta). As
   miniaturas da paleta saem dos próprios modelos, desenhadas uma vez por página com um renderer
   descartável; sem WebGL, vale o ícone da categoria.
7. **Interface**: a ferramenta "Biblioteca" da faixa do editor abre a paleta, com abas por categoria
   e cartões com miniatura. Escolher um objeto e clicar no chão o coloca (a ferramenta volta a
   "Selecionar", com o objeto selecionado); a escolha fica lembrada. Excluir, desfazer e os campos
   numéricos do painel "Ambiente" valem para ele.

## Consequências

- As caixas são aproximações (a copa de uma árvore, a cabine de um caminhão): servem à
  pré-visualização, e capacidade e segurança continuam sendo do backend (RN-008).
- O cabo (e os estropos entre o gancho e a carga) não colidem: só alertam, como no ADR-028. A carga
  não passa por um teto porque a caixa dela e a do gancho o encontram.
- O backend Docker já em execução precisa da versão nova para salvar cenários com objetos
  (`kind: "model"`); sem ela, o salvamento responde 422 e o resto do simulador funciona.
- Os kits da Kenney são CC0 e dispensam crédito; o crédito foi registrado por cortesia.
