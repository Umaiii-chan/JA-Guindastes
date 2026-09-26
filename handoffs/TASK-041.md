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
