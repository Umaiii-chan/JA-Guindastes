# Handoff — TASK-041 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-041-cena-3d-enriquecida.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão; a revisão deve ser outra) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-041-cena-3d-enriquecida` @ commit deste handoff (código em `a0060a7`), a partir de `0229d49` |
| **Duração aproximada** | 1 h 30 min |

---

## 1. Objetivo desta etapa

Dar à cena 3D aparência de software 3D escuro e profissional e feedback visual da operação (anel de
raio, carga, cores de situação, câmera), sem mudar a cinemática nem o cálculo (ADR-013 C-7).

## 2. O que foi feito

- **Ambiente (CA-1)** — `src/three/scene/addEnvironment.ts`:
  - céu em gradiente (domo com shader, acompanha a câmera) e névoa com a cor do horizonte;
  - chão grafite `MeshLambertMaterial` (sem reflexo rasante, que clareava o horizonte);
  - grade técnica em shader (`fwidth`, largura constante em pixels): secundárias a cada 1 m e
    principais a cada 5 m, esmaecendo com a distância da câmera; névoa e esmaecimento acompanham o
    zoom (`atmosphereRange`);
  - luz hemisférica + sol direcional com sombra `PCFShadowMap` 2048², `radius` 3 (o
    `PCFSoftShadowMap` foi removido no three r186 e só gera aviso) + luz de recorte fria sem sombra;
    a caixa de sombra se ajusta ao alcance máximo (`fitShadowToReach`);
  - renderer com `ACESFilmicToneMapping` e `SRGBColorSpace` (`mountCraneScene.ts`); o céu também
    passa pelo tone mapping, para não haver faixa no horizonte;
  - as peças do guindaste projetam e recebem sombra (`buildCraneScene` só liga as flags; nenhum nó
    do rig muda).
- **Anel de raio (CA-2)** — `RadiusIndicator.ts` + `radiusGeometry.ts` (puro, sem Three.js):
  - faixa de 0,14 m no raio de trabalho da pré-visualização, centrada no eixo de giro, com faixa de
    brilho suave de 0,9 m, linha radial do eixo até o gancho e marca no pé do gancho;
  - rótulo `R 8,63 m` (pt-BR, 2 casas, como o painel de geometria) em HTML via `CSS2DRenderer`
    (`three/addons`), nítido em qualquer zoom e sem capturar o mouse (`aria-hidden`, o valor já
    está no painel);
  - arcos tênues dos raios mínimo e máximo, pela fórmula (1) do ADR-013 nas pontas das faixas de θ
    e L (limitados a ≥ 0, C-5), na faixa de giro da torre (fecha o setor se o giro não cobre 360°);
  - com R < 0 (raio `null`), o anel e o rótulo somem;
  - o anel lê `crane.getOperationalGeometry()` a cada quadro e só refaz a geometria quando o raio
    muda; não escreve nada no controller.
- **Situação (CA-3)** — `palette.ts` (sem Three.js): tipo `EvaluationStatus`, cores
  `STATUS_COLORS` (`ok` 0x22c55e, `warning` 0xf5a524, `over` 0xef4444, `unknown` 0x8b95a3) e as do
  ambiente (`SCENE_COLORS`), com `statusCssColor()` para a TASK-039 alinhar os tokens. A situação
  pinta anel, linha radial, marca, borda do rótulo e o halo (brilho de borda fresnel, aditivo,
  intensidade 0,35; 0,15 em `unknown`).
- **Carga (CA-4)** — `HookLoad.ts` + `loadBox.ts` (puro): caixa filha do nó do gancho (acompanha o
  cabo sem tocar na cinemática), presa por 4 lingas até os cantos de cima; largura em X, altura em Y,
  comprimento na direção da lança (Z local); com carga, o halo vira elipsoide em volta da caixa. Sem
  carga ou com medidas inválidas, fica só o gancho.
- **Câmera (CA-5)** — `cameraPresets.ts` e `cameraTransition.ts` (puros):
  - `perspectiva` (vista da PoC, afastada se o alcance passar de 20 m), `lateral` (perpendicular ao
    plano da lança), `topo` (de cima, com o arco máximo no quadro), `operador` (olho acima da cabine
    da torre, girando com ψ, olhando para G);
  - transição de 700 ms com suavização cúbica, imediata com `prefers-reduced-motion: reduce`;
    arrastar a câmera interrompe a transição;
  - limites: distância 4 a 160 m; alvo nunca abaixo do chão; ângulo polar calculado a cada quadro
    para a câmera ficar ≥ 0,4 m acima do chão (`maxPolarAngleAboveGround`), o que deixa olhar um
    pouco para cima na vista do operador, mais uma rede de segurança depois do `controls.update()`.
- **Desempenho (CA-6)** — pixel ratio ≤ 2, antialias, uma sombra 2048²; o laço de renderização para
  com `visibilitychange` (aba oculta) e volta ao reaparecer; `dispose` também remove a camada dos
  rótulos, o ouvinte de visibilidade e o grupo da carga, e restaura o `position` do container.
- **Viewport** — `CraneViewport.tsx`: só props opcionais (ver § 2.1). Nenhuma prop existente mudou.

### 2.1 API nova do viewport (para a TASK-039)

```ts
import { CraneViewport, type CraneViewportHandle } from '../presentation/components/CraneViewport'
import type { EvaluationStatus } from '../three/scene/palette'        // 'ok' | 'warning' | 'over' | 'unknown'
import type { LoadDimensions } from '../three/scene/loadBox'          // { lengthM, widthM, heightM }
import type { CameraPreset } from '../three/camera/cameraPresets'     // 'perspectiva' | 'lateral' | 'topo' | 'operador'
```

| Prop | Tipo | Padrão | Efeito |
|------|------|--------|--------|
| `evaluationStatus` | `EvaluationStatus` | `'unknown'` | Cor do anel, da linha radial, da marca, da borda do rótulo e do halo. Não remonta a cena. |
| `load` | `LoadDimensions \| null` | `null` | Caixa pendurada no gancho. Medidas em metros, > 0 e finitas; senão, só o gancho. Pode ser objeto novo a cada render (o efeito depende dos três números). |
| `cameraPreset` | `CameraPreset` | — | Ao mudar, a câmera vai até a predefinição com transição (imediata com `prefers-reduced-motion`); na montagem, já começa nela. Repetir o mesmo valor não reenquadra. |
| `ref` | `Ref<CraneViewportHandle>` | — | `ref.current.setCameraPreset(preset, { animate?: boolean })`: reenquadra mesmo que seja a mesma predefinição (use nos botões de câmera). |

Tipos exportados: `CraneViewportHandle` (de `CraneViewport.tsx`), `CameraPresetOptions` e
`CraneSceneHandle` (de `three/scene/mountCraneScene.ts`, que ganhou `setEvaluationStatus`, `setLoad`
e `setCameraPreset`). Também úteis: `CAMERA_PRESETS` (lista para montar botões), `STATUS_COLORS`,
`SCENE_COLORS` e `statusCssColor()`.

Como ligar, na tela da simulação (exemplo; não implementado aqui):

```tsx
const viewportRef = useRef<CraneViewportHandle>(null)
<CraneViewport
  ref={viewportRef}
  setup={craneSetup.setup}
  onCraneChange={handleCraneChange}
  evaluationStatus={toSceneStatus(evaluation.result)}
  load={loadDimensions /* { lengthM, widthM, heightM } ou null */}
/>
<button onClick={() => viewportRef.current?.setCameraPreset('topo')}>Topo</button>
```

`toSceneStatus` é da TASK-039 e **não deve inventar regra** (RN-008; PEND-004): sem resultado ou
`NOT_EVALUABLE` → `'unknown'`; `EVALUATED` com utilização do backend acima de 100 % → `'over'`;
`EVALUATED` até 100 % → `'ok'`. Não existe hoje critério para `'warning'` (o nível de alerta está
pendente, PEND-004): enquanto a pessoa responsável não definir, não use `'warning'`. As medidas da
carga (`load`) também não têm campo na UI atual; ficam a cargo da TASK-039 (ou sem carga).

## 3. Arquivos modificados

```text
$ git diff --stat 0229d49..a0060a7
 .../src/presentation/components/CraneViewport.tsx  |  95 ++++++-
 frontend/src/three/camera/cameraPresets.ts         | 156 +++++++++++
 frontend/src/three/camera/cameraTransition.ts      |  48 ++++
 frontend/src/three/camera/createCamera.ts          |   3 +-
 frontend/src/three/controls/createOrbitControls.ts |  34 ++-
 frontend/src/three/scene/HookLoad.ts               | 204 +++++++++++++++
 frontend/src/three/scene/RadiusIndicator.ts        | 290 +++++++++++++++++++++
 frontend/src/three/scene/addEnvironment.ts         | 223 ++++++++++++++--
 frontend/src/three/scene/buildCraneScene.ts        |  39 ++-
 frontend/src/three/scene/loadBox.ts                |  81 ++++++
 frontend/src/three/scene/mountCraneScene.ts        | 184 ++++++++++++-
 frontend/src/three/scene/palette.ts                |  65 +++++
 frontend/src/three/scene/radiusGeometry.ts         | 117 +++++++++
 frontend/tests/three/camera/cameraPresets.test.ts  | 119 +++++++++
 .../tests/three/camera/cameraTransition.test.ts    |  45 ++++
 frontend/tests/three/controls/cameraLimits.test.ts |  46 ++++
 frontend/tests/three/scene/HookLoad.test.ts        | 101 +++++++
 frontend/tests/three/scene/RadiusIndicator.test.ts | 138 ++++++++++
 frontend/tests/three/scene/addEnvironment.test.ts  |  76 ++++++
 frontend/tests/three/scene/buildCraneScene.test.ts |  43 ++-
 frontend/tests/three/scene/loadBox.test.ts         |  61 +++++
 frontend/tests/three/scene/palette.test.ts         |  54 ++++
 frontend/tests/three/scene/radiusGeometry.test.ts  |  92 +++++++
 23 files changed, 2272 insertions(+), 42 deletions(-)
```

Mais este handoff e os critérios marcados em `tasks/in-progress/TASK-041-cena-3d-enriquecida.md`.
Nada fora do escopo: `App.tsx`, páginas, painéis, CSS, `e2e/`, `backend/`, ADRs e
`handoffs/current.md` não foram tocados. **Sem dependência nova**: `CSS2DRenderer` e
`OrbitControls` vêm de `three/addons` (já instalado). `createCamera.ts`: só o `far` passou de 1000
para 2000 m (domo do céu).

## 4. Comandos executados e resultados

| Comando (em `frontend/`, salvo indicação) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ | `found 0 vulnerabilities` |
| `npm run lint` | ✅ | sem apontamentos |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `Test Files 36 passed (36)` · `Tests 378 passed \| 1 skipped (379)` |
| `npm run build` | ✅ | maior chunk `three-*.js` 352,33 kB; `three-addons` 22,34 kB (era 19,85 kB, entrou o `CSS2DRenderer`); sem aviso de 500 kB |
| `npm run e2e` (vite preview, sem backend) | ✅ | `5 passed · 2 skipped` (os 2 pulados precisam de backend) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` — o aviso é "há 3 tarefas em tasks/in-progress/" (leva D em paralelo) |
| Capturas com Playwright (script temporário fora do repositório, `vite` na porta 5190) | ✅ | cena montada via `import('/src/three/scene/mountCraneScene.ts')` com as 4 situações, carga e as 4 predefinições; nenhum erro de shader nem `pageerror` (só os 404/WebSocket do backend ausente) |

O servidor `vite` da porta 5190 foi encerrado no fim. O `vite preview` da 4173 é o do `webServer` do
Playwright e é derrubado por ele.

## 5. Decisões tomadas

- **Rótulo em HTML (`CSS2DRenderer`) em vez de sprite com textura**: texto nítido em qualquer zoom e
  estilizável como o resto da UI; custa uma camada `div` por cima do canvas (sem eventos de mouse).
  O `canvas` continua único (o E2E conta 1).
- **Tipos públicos sem Three.js** (`palette.ts`, `loadBox.ts`, `cameraPresets.ts`): a UI importa
  com `import type` sem violar o ADR-005.
- **Limite polar dinâmico** em vez do `maxPolarAngle` fixo em 90°: fixo, a vista do operador (que
  olha para cima, para o gancho) seria impossível; dinâmico, a câmera nunca desce abaixo de 0,4 m.
- **Olho do operador fixo no modelo provisório** (`OPERATOR_EYE_LOCAL`, acima da cabine da torre):
  com o GLB real deve vir de um nó do modelo (pendência 2).
- **Halo em fresnel aditivo** com intensidade baixa, sem pós-processamento (bloom): pedido de "halo
  sutil, sem neon" e 60 fps.
- **Arco de alcance só com as pontas das faixas** (fórmula (1) com L e θ extremos): suficiente para
  uma linha tênue de referência; não é envelope de capacidade.
- Nenhuma decisão arquitetural nova: sem ADR.

## 6. Regras de negócio aplicadas

- ADR-013 C-7 / RN-008: o anel, o rótulo e os arcos são pré-visualização; a cena não decide a
  situação, só pinta o que receber. Teste `buildCraneScene.test.ts` confirma que carga e situação
  não alteram `getOperationalGeometry()`.
- ADR-013 C-5: com R < 0 o raio é `null` e o anel some (não vira |R|).
- ADR-013 C-1/C-2: anel no plano y = 0, centrado no eixo de giro, direção u(ψ) = (sin ψ, 0, cos ψ).

## 7. O que NÃO foi feito e por quê

- **CA-6, 60 fps num notebook comum: não medido** em hardware real. Aqui só há SwiftShader (CPU), que
  não serve de referência. Deixei o CA-6 sem marcar; sugestão de conferência: abrir a tela num
  notebook com GPU integrada, DevTools → Performance → FPS meter, girando a câmera.
- **Ligação na tela** (passar `evaluationStatus`, `load` e os botões de câmera): é da TASK-039
  (`App.tsx`/páginas fora do escopo). Hoje a tela mostra o anel cinza e sem carga.
- **Teste E2E novo** para o anel/rótulo: `frontend/e2e/` está fora do escopo desta tarefa; os
  existentes passam. Seletor estável para um teste futuro: `[data-scene-label="working-radius"]`.
- Não editei `docs/*.md` nem `handoffs/current.md`. Para a documentação final: `docs/architecture.md`
  (módulos novos em `src/three/scene` e `src/three/camera`) e `docs/known-gaps.md` (olho do operador
  e ponto das lingas amarrados ao modelo provisório).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Qual critério define `'warning'` (atenção)? Depende do nível de alerta (PEND-004); até lá, a TASK-039 só deve usar `ok`/`over`/`unknown`. | não | | |
| 2 | Com o GLB real: o modelo terá nós para o olho do operador e o ponto de amarração das lingas? Hoje são constantes do modelo provisório (`OPERATOR_EYE_LOCAL`, `HOOK_ATTACH_OFFSET_M`). | não | | |
| 3 | A carga deve ter medidas informadas na tela (comprimento, largura, altura)? O contrato atual da avaliação só tem o peso. | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar.

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois, a TASK-039 liga as props.

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-041-cena-3d-enriquecida`.
2. Rodar `npm run dev` e conferir o teste manual da tarefa (§ 7): anel e rótulo acompanhando os
   sliders; para ver cores, carga e câmeras sem a TASK-039, no console do navegador (dev):
   `const m = await import('/src/three/scene/mountCraneScene.ts')` e montar num `div` de teste, ou
   passar as props temporariamente no `App.tsx` local (sem commitar).
3. Medir o FPS em hardware real (§ 7) e marcar o CA-6.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 2.1 é o contrato com a TASK-039)
3. `tasks/in-progress/TASK-041-cena-3d-enriquecida.md` § 3
4. `frontend/src/three/scene/mountCraneScene.ts` e `frontend/src/presentation/components/CraneViewport.tsx`

**Cuidado com:**
- O `mountCraneScene` passou a pôr `position: relative` inline no container do canvas
  (`.crane-viewport__canvas`) quando ele é `static` (para a camada dos rótulos); é restaurado no `dispose`. Se a TASK-039 der
  `position: absolute/fixed` a esse container, nada muda.
- Conflito provável com a TASK-039 só em `CraneViewport.tsx` (se ela também o editar): as mudanças
  aqui são aditivas.

## 11. Como revisar este trabalho

- Comece pelos módulos puros (`radiusGeometry.ts`, `loadBox.ts`, `cameraPresets.ts`), que têm a
  lógica e os testes; depois `mountCraneScene.ts` (laço, visibilidade, dispose).

---

## 12. Continuação: modelo GLB na cena e ficha FICTÍCIA com a = −1,56 m (2026-09-26)

| Campo | Valor |
|-------|-------|
| **Pedido** | sessão principal, via orquestrador: ligar o GLB da TASK-043 à cena e alinhar a ficha fictícia do frontend |
| **Papel** | Planejador, Engenheiro de testes e Implementador (mesma sessão; a revisão deve ser outra) |
| **Ferramenta** | Claude Code (Opus 5.5), agente em worktree isolado |
| **Branch** | `task/TASK-041-modelo-glb-na-cena`, a partir de `0061422` (integração da leva D) |

### 12.1 Como a cena liga o modelo

- **Carregamento em dois tempos.** A cena monta na hora com o guindaste provisório, como antes, e
  baixa o GLB em segundo plano (`upgradeCraneModel`). Quando o modelo chega, ele substitui o
  provisório na mesma pose. Escolhi isso em vez de um indicador de carregamento porque:
  - a cena nunca fica vazia;
  - os sliders funcionam desde o início;
  - não precisa de UI nova (páginas e componentes são da TASK-039).
- **Comandos estáveis.** A UI recebe um `SwitchableCrane` (`src/three/crane/SwitchableCrane.ts`).
  Ele implementa `CraneCommands` e repassa os comandos ao `CraneController` do rig atual. Na troca, o
  controller novo nasce com os mesmos limites e o mesmo a/h de `setup` (ficha técnica ou FICTÍCIOS,
  nunca do GLB; RN-003) e com o estado atual. O `onCraneChange` não é chamado de novo: a UI continua
  com o mesmo objeto.
- **Mapeamento.** Usa `mapTruckCraneKinematics(model, { geometryParameters, boomRetractedLengthM:
  limits.boomLengthM.min, calibrationTolerance: SCENE_CALIBRATION_TOLERANCE })`. A tolerância é de
  1 cm e 0,5°, e só decide o que vira aviso no console: a tolerância de engenharia continua em aberto
  (ADR-013, G-7).
- **Queda segura.** A cena fica no provisório, com um `console.warn` e sem erro para a UI, em três
  casos:
  - o download ou o parse falha (`GltfLoadError`);
  - o mapeamento recusa o modelo;
  - o controller não aceita os limites.

  Se a cena desmontar antes do fim, o `AbortController` cancela e o GLB é liberado sem entrar na
  cena.
- **Cilindro de levantamento.** `model.updateLuffingCylinder()` roda depois de cada comando, pelo
  `afterCommand` do `SwitchableCrane`.
- **Integração com a TASK-041.**
  - Sombras: as malhas do GLB projetam e recebem sombra. O vidro, que é transparente, só recebe.
  - Carga e halo: `HookLoad.attachTo(rig.hook)` leva a carga e o halo para o gancho novo, com a
    situação e a carga atuais.
  - Medida do gancho: o ponto das lingas e o tamanho do halo agora saem da caixa das malhas do gancho
    em uso (`measureHookExtent`). O provisório desce 1,1 m abaixo de G, e o moitão do GLB, cerca de
    2,4 m.
  - Olho do operador: fica 0,5 m acima do vidro da cabine da torre (`findOperatorEye`, malhas
    `*vidro*`). Por dentro da cabine, o painel tapava a vista, como mostrou a captura. Sem vidro, vale
    `OPERATOR_EYE_LOCAL`.
  - O anel não mudou: continua lendo a geometria do controller.
- **Descarte.** `disposeObject3D(scene)` já cobre o GLB, que fica dentro da cena. O provisório é
  liberado na troca.
- **Desempenho.**
  - O laço agora **desenha sob demanda**: só renderiza quando mudam a câmera, o estado do guindaste,
    os ajustes visuais, o tamanho, a visibilidade ou o modelo. Sem isso, a malha de 103 mil
    triângulos, com sombra, travou 3 testes E2E no SwiftShader (timeout de 30 s).
  - Os bytes do GLB são baixados uma vez por página (`loadDefaultCraneModel`), porque trocar a
    configuração remonta a cena.
- **API.** A API do viewport não mudou. `mountCraneScene(container, setup?, options?)` ganhou duas
  opções:
  - `loadModel`: carregador injetável; `null` desliga o GLB;
  - `onModelResult`.

  O `CraneViewport` não foi alterado e usa o padrão, que é carregar o GLB.

### 12.2 Ficha FICTÍCIA do frontend: a = −1,56 m

- `PROVISIONAL_CRANE_GEOMETRY.boomPivotOffsetM` passou de −1,2 para −1,56 m, igual à ficha de demo
  do backend e ao GLB.
- O GLB de exemplo foi regenerado (`UPDATE_EXAMPLE_GLB=1 npx vitest run
  tests/three/loaders/exampleModel.test.ts`, 63 560 → 63 564 bytes) e o
  `assets/example-models/README.md` foi atualizado.
- Testes ajustados:
  - `craneKinematics.test.ts`: aviso de P com h diferente; o desvio continua 0,2 m;
  - `createProvisionalCrane.test.ts`;
  - `catalogForms.test.ts`: só o valor de entrada do parser;
  - `buildCraneScene.test.ts`: R inicial 8,269825 m (awk);
  - `radiusGeometry.test.ts` e `RadiusIndicator.test.ts`: R_min 0,523778 m, R_max 20,44 m.
- `truckCraneModel.test.ts`: com o padrão do frontend, a calibração agora dá **zero avisos**. O teste
  que fixava os dois avisos de 0,359 m foi trocado por um que exige o relatório vazio.
- Pose inicial sem ficha: R = 8,27 m (antes 8,63 m).

### 12.3 Capturas (Playwright + SwiftShader; vite nas portas 5190 e 5191, encerrados; script fora do repositório)

- `docs/assets/screenshots/modelo-3d/01..08` foram refeitas na cena escura, com a ficha nova e as
  mesmas poses da TASK-043. A bolinha vermelha é o G calculado pelas fórmulas do ADR-013 e agora
  coincide com o topo do moitão. A distância medida no script, `|G − gancho|`, foi de **0,9 mm** em
  todas as poses: é o a do GLB, −1,5591 m, contra −1,56 m da ficha.
- `docs/assets/screenshots/cena-3d/` é nova e mostra a cena escura com o GLB:
  - `ok-perspectiva`: carga e anel verde;
  - `warning-lateral`: âmbar;
  - `over-topo`: vermelho, vista de topo, lança em 22 m;
  - `unknown-operador`: vista do operador;
  - `over-perspectiva-sem-carga`: só o halo no gancho.
- As capturas da TASK-043 estão descritas no `handoffs/TASK-043.md` § 2 como "antes da mudança da
  ficha". Não editei o handoff dela; o texto dela ficou desatualizado nesse ponto.

### 12.4 Gates (em `frontend/`, salvo indicação)

| Comando | Resultado |
|---------|-----------|
| `npm ci` | ✅ necessário: a integração trouxe dependências da TASK-039 (`lucide-react` etc.) |
| `npm run lint` | ✅ sem apontamentos |
| `npm run format:check` | ✅ |
| `npm run typecheck` | ✅ |
| `npm test` | ✅ `Test Files 46 passed (46)` · `Tests 459 passed \| 1 skipped (460)` |
| `npm run build` | ✅ sem aviso de 500 kB. `three-addons` subiu para 67,57 kB porque o `GLTFLoader` passou a entrar no app |
| `npm run e2e` (3 execuções) | ✅ `7 passed · 2 skipped`, cerca de 25 s cada, depois do desenho sob demanda. Antes dele: 3 timeouts |
| `bash scripts/check-structure.sh` (raiz) | ✅ ver saída no relatório final |

### 12.5 Limitações e pendências

- **A troca é visível.** O provisório aparece por uma fração de segundo antes do GLB. Se a pessoa
  responsável preferir, dá para esconder o guindaste até o GLB chegar ou falhar (decisão de UX).
- **SwiftShader.** O GLB pesa na renderização por software, mas com o desenho sob demanda os E2E
  ficaram em cerca de 3,5 s por teste. O CA-6 (60 fps num notebook com GPU) continua **sem medição
  em hardware real**.
- **Ficha diferente do modelo.** Com a ficha de outra configuração (a, h e L_min diferentes do
  modelo), o GLB é usado mesmo assim, com aviso de calibração no console. O erro é só visual (ADR-013
  C-4, regra 3). Não há critério para recusar o modelo por desvio grande: isso depende da G-7.
- **Olho do operador por nome de malha.** A busca por `vidro`/`glass` é uma convenção do GLB da
  TASK-043. Um modelo sem essa malha cai no olho do provisório.
- **Carga e moitão.** A carga pende do fundo do moitão do GLB, cerca de 2,4 m abaixo de G, e não do
  topo. Com c pequeno, a caixa pode entrar no chão; é só desenho.
