# Handoff — TASK-043 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-043-modelo-3d-guindaste.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree isolada, disparado pelo orquestrador da leva D |
| **Branch** | `task/TASK-043-modelo-3d-guindaste` @ commit deste handoff (base `4ddd6a3`) |
| **Duração aproximada** | 2 h |

---

## 1. Objetivo desta etapa

Converter o FBX do guindaste sobre caminhão (CGTrader) num GLB em metros, com peças móveis em nós,
pivôs nas articulações e pose de repouso do ADR-013, mais o carregador, o teste e as capturas de
conferência.

## 2. O que foi feito

- Copiei o FBX para `assets/source/cgtrader_optimized_prop_crane.fbx` (SHA-256
  `81f0b6b4…380321a1`, 2 541 792 bytes) e pus `assets/source/` no `.gitignore`. **O FBX não foi
  versionado.**
- Inspecionei o FBX com o `FBXLoader` em Node e verifiquei que:
  - as malhas estão com Y para cima e a cabine do caminhão em +Z no referencial local; a rotação de
    −37,44° e a escala 0,457 da raiz só posicionam o prop, e a conversão as ignora;
  - a lança está a 38,45° (e não 45°), com três seções telescópicas estendidas;
  - o cabo é uma malha fixa, do guincho até a polia, e desce até o moitão;
  - a malha "White" usa um material chamado `BlackPlastic`, então o material vem do nome da malha.
- Criei `frontend/scripts/convert-crane-model.mjs` (roda com `node`, só com o `three`):
  - separa os componentes conexos: 158 peças;
  - classifica as peças pelas regras R1–R9 escritas no cabeçalho do script;
  - confere a contagem por papel e o SHA-256 da entrada, e falha se algo mudar;
  - desfaz a inclinação da lança, recolhe as seções, estica os tubos e escala para metros;
  - junta as peças por papel e por material e exporta o GLB;
  - `--listar` imprime a classificação peça a peça.
- Gerei `frontend/public/models/guindaste-caminhao.glb`:
  - **1 897 804 bytes (1,81 MiB)** e **102 926 triângulos**: 102 894 do FBX, sem os 196 do cabo
    original, mais 32 do cabo sintetizado;
  - SHA-256 `cd7bf259…5296696a`, idêntico em duas execuções (determinístico).
- Criei `frontend/src/three/loaders/loadTruckCraneModel.ts`, um arquivo novo. Nenhum outro arquivo de
  `src/three/` foi alterado. Ele exporta:
  - `loadTruckCraneModel(url?, options?)` e `parseTruckCraneModel(buffer)`, que usam
    `loadGltf`/`parseGltf` e devolvem `{ gltf, scene, nodeNames, updateLuffingCylinder }`;
  - `mapTruckCraneKinematics(model, config)`, que chama `mapCraneKinematics` com os nós e os nomes do
    arquivo;
  - as constantes `TRUCK_CRANE_MODEL_URL`, `TRUCK_CRANE_NODE_NAMES` (os mesmos de
    `CRANE_NODE_NAMES`), `TRUCK_CRANE_LUFFING_NODE_NAMES` e `TRUCK_CRANE_MODEL_MEASUREMENTS`.
- Escrevi `frontend/tests/three/loaders/truckCraneModel.test.ts`, com 9 testes: cabeçalho e tamanho,
  nós únicos, `extras`, hierarquia aceita, calibração sem aviso com as medidas do modelo, avisos
  esperados com a ficha de demo, P/T/G e gancho na vertical com o `CraneController` em 5 estados,
  cilindro e `fetch` injetado.
- Fiz as capturas com Playwright (chromium + SwiftShader) numa página temporária
  (`frontend/tmp-visual/`) servida pelo Vite em **127.0.0.1:5201**. Depois encerrei o servidor
  (conferi que a porta ficou livre) e apaguei a página, que não foi versionada. Olhei as capturas e
  verifiquei que:
  - a torre gira com a lança;
  - a lança inclina no pino;
  - a 2ª seção desliza para fora da base;
  - o gancho fica pendurado na vertical;
  - o cilindro acompanha a lança.

### Hierarquia do GLB (pose de repouso: ψ = 0, θ = 0, lança recolhida, c = 0)

```text
crane-base                    chassi; origem no chão, sob o eixo de giro; extras (origem/aviso)
└── crane-turret              (0; 1,559; 0) m — eixo de giro no centro do anel de giro
    ├── crane-luffing-cylinder   camisa do cilindro, origem no pino de baixo (nó extra)
    └── crane-boom            P = (0; 3,300; −1,559) m na base, sem rotação
        ├── crane-luffing-rod    haste do cilindro, origem no pino de cima (nó extra)
        └── crane-boom-extension (0, 0, 0): 2ª e 3ª seções e colares
            └── crane-boom-tip   (0, 0, 12): T = eixo da polia projetado no eixo da lança
                └── crane-cable
                    ├── crane-cable-line  cilindro de altura 1, topo na origem (sintetizado)
                    └── crane-hook        topo do moitão = ponto de suspensão
```

Os nós não têm escala, e os papéis não têm rotação. As malhas ficam agrupadas por papel e por
material (ex.: `chassi-amarelo`, `lanca-extensao-branco`). Os materiais são PBR:
- `amarelo`: #f2b705;
- `preto`: fosco;
- `branco`: cinza metálico claro;
- `vidro`: escuro, opacidade 0,55;
- `cabo`: aço escuro.

### Escala e medidas resultantes

| Medida | Ficha FICTÍCIA de demo | Modelo (GLB) | Situação |
|--------|-----------------------|--------------|----------|
| Escala FBX → m | — | 3,172376 (pela altura do pino) | — |
| h (altura do pino P) | 3,3 m | 3,300 m | bate |
| L_min (lança recolhida, P→T) | 12 m | 12,000 m | bate, com a lança esticada (abaixo) |
| a (pino atrás do eixo de giro) | −1,2 m | −1,559 m | **diverge 0,359 m** |
| Caminhão (comprimento × largura) | — | ≈ 9,3 m × 2,9 m | — |

Com uma escala única, o FBX não chega às três medidas. A escala que dá h = 3,3 m deixa a lança toda
recolhida com **6,04 m**. Priorizei h e L_min:
- os **tubos** da lança foram esticados ao longo do próprio eixo em **5,956 m**;
- colares, cabeça, polias, suportes e o olhal do cilindro não se deformam;
- o `a` ficou o do modelo.

A 2ª seção, recolhida, vai de 0,15 m a 10,79 m de P. Em 22 m (L_max de demo), ela ainda sobrepõe
**0,64 m** dentro da base.

Com a ficha de demo e tolerância de 1 mm, o mapeamento dá exatamente dois avisos `position`:
- `boom-pivot`: esperado (0; 3,3; −1,2) m, encontrado (0; 3,3; −1,559) m;
- `boom-tip`: esperado (0; 3,3; 10,8) m, encontrado (0; 3,3; 10,441) m.

Os dois têm desvio de 0,359 m. É erro só visual: o gancho desenhado fica 0,36 m mais perto do eixo
que o G calculado (bolinha vermelha nas capturas). O teste fixa esses dois avisos. Com as medidas do
próprio modelo (`TRUCK_CRANE_MODEL_MEASUREMENTS`), não há aviso.

### Capturas (`docs/assets/screenshots/modelo-3d/`)

Todas com a ficha de demo (a = −1,2 m, h = 3,3 m). A bolinha vermelha é o G calculado pelas fórmulas
do ADR-013.

| Arquivo | Estado (ψ, θ, L, c) |
|---------|---------------------|
| [`01-repouso.png`](../docs/assets/screenshots/modelo-3d/01-repouso.png) | 0°, 0°, 12 m, 1 m |
| [`02-repouso-lateral.png`](../docs/assets/screenshots/modelo-3d/02-repouso-lateral.png) | idem, vista lateral |
| [`03-giro-90.png`](../docs/assets/screenshots/modelo-3d/03-giro-90.png) | 90°, 0°, 12 m, 1 m |
| [`04-lanca-45.png`](../docs/assets/screenshots/modelo-3d/04-lanca-45.png) | 0°, 45°, 12 m, 3 m |
| [`05-lanca-estendida.png`](../docs/assets/screenshots/modelo-3d/05-lanca-estendida.png) | 0°, 45°, 22 m, 3 m |
| [`06-cabo-longo.png`](../docs/assets/screenshots/modelo-3d/06-cabo-longo.png) | 90°, 45°, 12 m, 9 m |
| [`07-detalhe-pe-da-lanca-45.png`](../docs/assets/screenshots/modelo-3d/07-detalhe-pe-da-lanca-45.png) | pé da lança e cilindro a 45° |
| [`08-detalhe-pe-da-lanca-repouso.png`](../docs/assets/screenshots/modelo-3d/08-detalhe-pe-da-lanca-repouso.png) | pé da lança em repouso (cilindro recolhido, escondido) |

## 3. Arquivos modificados

```text
$ git diff --stat 4ddd6a3...HEAD   (antes deste handoff)
 .gitignore                                         |   4 +
 docs/assets/screenshots/modelo-3d/*.png (8)        | Bin (≈ 972 KB no total)
 frontend/public/models/guindaste-caminhao.glb      | Bin 0 -> 1897804 bytes
 frontend/scripts/convert-crane-model.mjs           | 906 +++++++++++++++++++++
 frontend/src/three/loaders/loadTruckCraneModel.ts  | 125 +++
 .../tests/three/loaders/truckCraneModel.test.ts    | 230 ++++++
 tasks/in-progress/TASK-043-modelo-3d-guindaste.md  | 100 +++
```

Mais este handoff. Nada fora do escopo: não mexi em `handoffs/current.md`, nos ADRs, em `backend/**`,
em outros arquivos de `src/three/` nem no `CraneViewport`.

## 4. Comandos executados e resultados

| Comando (em `frontend/`, salvo indicação) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `node scripts/convert-crane-model.mjs` (2×) | ✅ | mesmo SHA-256 `cd7bf259…` nas duas; 1 897 804 bytes |
| `npm run lint` | ✅ passou | sem mensagens |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ passou | `Test Files 28 passed (28)`, `Tests 318 passed \| 1 skipped (319)` |
| `npm run build` | ✅ passou | `built in 428ms`; `dist/models/guindaste-caminhao.glb` copiado |
| `node tmp-visual/capture.mjs 5201 …` (temporário) | ✅ | 8 capturas; avisos de calibração impressos pela página (os dois acima) |
| `bash scripts/check-structure.sh` (raiz) | ✅ passou | ver § 4.1 |

Saída do conversor:

```text
peças por papel: {"lancaPonta":5,"chassi":113,"lancaBase":4,"torre":24,"lancaSegunda":2,"lancaTerceira":2,"cilindroCamisa":1,"gancho":5,"cabo":1,"cilindroHaste":1}
triângulos no GLB (sem o cabo original, com o cabo sintetizado): 102926
escala FBX → m: 3.172376
P = (0, 3.300, -1.559) m; ficha de demo: (0, 3.3, -1.2)
lança recolhida: 12 m (sem esticar: 6.044 m; esticamento 5.956 m)
2ª seção: de 0.15 m a 10.791 m de P; sobreposição em 22 m: 0.641 m
```

### 4.1 check-structure

Rodado com este handoff já escrito, antes do commit dele:

```text
3. Tarefas
  ! há 4 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
  ✓ nenhum ID de tarefa duplicado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-043-modelo-3d-guindaste
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 5 commit(s) desta branch sem co-autoria de IA
OK: 0 erros, 1 aviso(s)
```

O aviso é esperado: há quatro tarefas paralelas (TASK-038, 039, 041 e 043). A TASK-043 só criou um
arquivo novo em `src/three/loaders/`.

## 5. Decisões tomadas

- **Escala por h e lança esticada para L_min**, em vez de escalar por L_min, que deixaria h = 6,3 m e
  um caminhão de 18 m. Só os tubos esticam, entre o último suporte da seção base e o colar da frente;
  as peças com detalhe ficam rígidas. O `a` do modelo fica em −1,559 m e é avisado.
- **T = eixo da polia projetado no eixo estrutural da lança**, no ponto onde o cabo original deixa a
  polia (topo do trecho vertical do cabo). Com a lança horizontal, a linha do cabo sintetizada passa
  exatamente por esse ponto. Assim a lança em θ = 0 fica de fato horizontal (S-3 do ADR-013).
- **O gancho foi recentrado na vertical de T.** No FBX, o moitão ficava 0,19 unidade à frente do eixo
  da lança. A origem de `crane-hook` é o topo do moitão, como no provisório.
- **O cabo original foi descartado** e `crane-cable-line` foi sintetizado (raio 3,5 cm), como pede a
  tarefa. O trecho do cabo ao longo da lança, do guincho à ponta, também sumiu: ele não acompanharia
  o telescópio.
- **O cilindro de levantamento virou dois nós extras** (`crane-luffing-cylinder` e
  `crane-luffing-rod`), fora dos papéis. Rígido, ele atravessaria a lança em outros ângulos.
  `updateLuffingCylinder()` reaponta os dois só com rotação em X; no arquivo, eles já estão apontados
  para o repouso. O mapeamento tolera esses nós porque ficam fora da cadeia dos papéis.
- **A seção telescópica é uma só** (`crane-boom-extension` leva a 2ª e a 3ª seções juntas), porque o
  controller só move uma extensão. A 3ª seção fica sempre dentro da 2ª; quando a lança estende,
  aparece a 2ª seção cinza saindo da base amarela.
- **O eixo de giro em X ficou no eixo da lança** (−0,0346 no FBX), e não no centro do anel (−0,0097),
  para P ter x = 0. A diferença, 8 cm, não aparece.
- **Os `extras` ficam no nó `crane-base`**, com `ficticio`, `ilustrativo`, `aviso`, `origem` (arquivo,
  fonte, SHA-256, licença a conferir), `conversao` e `medidasDoModelo`.
- **A escala e as medidas vêm da ficha FICTÍCIA de demo** (ADR-012). Nenhuma medida de cálculo é lida
  do GLB (RN-003).

## 6. Regras de negócio aplicadas

- RN-003 / ADR-013 C-4, regra 1: o carregador e o mapeamento só comparam o GLB com a configuração. As
  medidas do modelo são documentadas, mas nunca usadas no cálculo.
- ADR-013 C-1, C-3 e C-4, regra 4: eixos, pontos P/T/G e pose de repouso, conferidos no teste.
- ADR-012: o GLB traz rótulo FICTÍCIO/ILUSTRATIVO no próprio arquivo.

## 7. O que NÃO foi feito e por quê

- **O modelo não foi ligado no `CraneViewport`/`buildCraneScene`**: fica para a integração (§ 10).
- As 3 seções não se movem de forma independente: o controller tem uma extensão só.
- O cilindro só acompanha a lança se a integração chamar `updateLuffingCylinder()`.
- Não há teste automático de imagem. As capturas são conferência manual, e os movimentos são cobertos
  pelo teste com o `CraneController`.
- O modelo não foi otimizado (Draco/meshopt/quantização): não há compressor no `three` instalado sem
  dependência nova. O arquivo tem 1,81 MiB, com vértices indexados e sem UVs.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | **Licença CGTrader:** a licença do `cgtrader_optimized_prop_crane.fbx` permite versionar o GLB derivado (repositório privado) e distribuí-lo embutido na aplicação web (servido publicamente em `/models/guindaste-caminhao.glb`)? Se não permitir, o GLB sai do repositório e passa a ser gerado localmente com o script. | sim, para o merge | | |
| 2 | Aceita a lança esticada (5,96 m a mais nos tubos) e a divergência de a (−1,559 m contra −1,2 m) no modelo ilustrativo? Alternativa: mudar o `a` da ficha FICTÍCIA de demo para −1,56 m, o que zera os avisos (mas muda o roteiro de `docs/demo.md` e o seed). | não | | |

## 9. ⚠️ Segurança

Nada a registrar.

## 10. Próximo passo

**Papel:** Revisor; depois a integração (sessão principal).

**Como ligar o modelo no viewport (integração):**

1. Numa função assíncrona de montagem da cena, carregar o modelo:
   `const model = await loadTruckCraneModel()`. A URL padrão é
   `${import.meta.env.BASE_URL}models/guindaste-caminhao.glb`, e os erros são os `GltfLoadError` de
   `loadGltf`.
2. `scene.add(model.scene)`. `crane-base` fica na origem O, e a cena do GLB não tem transformação.
3. Mapear o modelo com a ficha da configuração, ou com `PROVISIONAL_CRANE_SETUP` sem ficha:
   `mapTruckCraneKinematics(model, { geometryParameters, boomRetractedLengthM:
   limits.boomLengthM.min, calibrationTolerance })`. Se `!result.ok`, voltar ao guindaste provisório
   e mostrar os `report.errors`. Os `report.warnings` são só visuais e podem ir para o log. Atenção:
   o modelo tem L_min = 12 m. Se a ficha tiver outro `boomLengthM.min`, o controller aceita (o
   mínimo precisa ser ≥ `boomRetractedLengthM`), mas a calibração avisa.
4. `new CraneController(result.rig, limits, geometryParameters, initialState)`, como no
   `buildCraneScene`, trocando `createProvisionalCrane(...)` pelo rig do modelo.
5. Depois de cada `setBoomAngle`/`setTurretRotation` (ou uma vez por quadro), chamar
   `model.updateLuffingCylinder()`.
6. No descarte, `disposeObject3D(model.scene)` como já é feito para o provisório. Os materiais são
   compartilhados entre as malhas do GLB.

**Regenerar o GLB:** pôr o FBX em `assets/source/` e rodar, em `frontend/`,
`node scripts/convert-crane-model.mjs`. `--listar` mostra a classificação. Depois,
`npx vitest run tests/three/loaders/truckCraneModel.test.ts`.

**Refazer as capturas** (página temporária, não versionar):
1. criar `frontend/tmp-visual/index.html` + `main.ts`, que monta a cena com `createScene` +
   `addEnvironment`, carrega o modelo, cria o `CraneController` e expõe `window.setPose(state, view)`;
2. rodar `npx vite --port 5201 --strictPort --host 127.0.0.1`;
3. capturar com `chromium` do `@playwright/test` (`--enable-unsafe-swiftshader`);
4. encerrar o servidor e apagar a pasta.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-043-modelo-3d-guindaste.md` § 3
4. `frontend/scripts/convert-crane-model.mjs`, cabeçalho e regras R1–R9
5. `frontend/src/three/loaders/loadTruckCraneModel.ts`
6. `frontend/tests/three/loaders/truckCraneModel.test.ts`

**Cuidado com:**
- As regras de classificação são calibradas para este FBX: o script recusa outro arquivo pelo
  SHA-256.
- `TRUCK_CRANE_MODEL_MEASUREMENTS.boomPivotOffsetM` (−1,5591) precisa acompanhar o
  `medidasDoModelo` do GLB. O teste confere os dois.

## 11. Como revisar este trabalho

- Comece pelas capturas e pela tabela de medidas (§ 2).
- No script, o mais arriscado é `computeLayout`: o recolhimento das seções, os mapas lineares por
  partes que esticam os tubos e a escolha de T.
- Tenho menos certeza sobre a aparência da lança esticada (proporção de "caminhão de brinquedo" com
  lança longa) e sobre o cilindro em ângulos baixos. Em θ = 0, a camisa fica escondida dentro da
  lança e da torre (captura 08).
- O teste cobre hierarquia, calibração, P/T/G e cilindro, mas não compara pixels.
