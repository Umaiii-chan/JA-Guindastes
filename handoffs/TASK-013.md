# Handoff — TASK-013 — implementação

> Handoff próprio da TASK-013 (tarefas em paralelo, regra da TASK-006). `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:20 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-013-poc-threejs-guindaste.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só sessão; a revisão deve ser de outra sessão/ferramenta) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-013-poc-threejs-guindaste` @ `c4a023c` (+ o commit deste handoff) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Entregar a PoC visual do guindaste no navegador (RF-012..014 só no nível visual): cena Three.js,
`CraneController` com comandos estáveis e limites, guindaste provisório procedural, viewport e painel
de sliders em React, e testes Vitest sem WebGL.

## 2. O que foi feito

- Verifiquei que o HEAD inicial do worktree era `f7570d7`, pai de `ae2ec66`. Como `ae2ec66` existia
  localmente, criei a branch a partir dele, como pedido.
- Criei `frontend/src/three/crane/types.ts`: tipos sem Three.js (`CraneLimits`, `CraneState`,
  `CraneCommands`), para a UI usar com `import type`.
- Criei `frontend/src/three/crane/CraneController.ts`: `setTurretRotation(deg)`, `setBoomAngle(deg)`,
  `setBoomLength(m)` e `setCableLength(m)` limitam (clamp) o valor aos limites recebidos na construção,
  aplicam a transformação no nó e devolvem o valor aplicado. Também tem `getState()` e `limits`
  (cópia congelada). O construtor valida as faixas (finitas, mín. ≤ máx., cabo mín. ≥ 0, lança mín. ≥
  lança recolhida do modelo), e os `set*` rejeitam valor não finito com `RangeError`. **Não** há
  `getOperationalGeometry()` nem fórmula.
  - torre: `rotation.y`; lança: `rotation.x` negativa (a ponta sobe com ângulo positivo); extensão:
    `position.z = L − lança recolhida`; cabo: `rotation.x` oposta à da lança (fica na vertical), linha
    com `scale.y = c` e gancho com `position.y = −c`.
- Criei `frontend/src/three/crane/createProvisionalCrane.ts`: guindaste de caixas e cilindros, com
  hierarquia base → torre → lança → extensão → ponta → cabo (→ linha) → gancho, nomes de nó estáveis
  (`CRANE_NODE_NAMES`), e dimensões, limites e pose inicial rotulados **FICTÍCIO**.
- Criei em `frontend/src/three/`: `scene/addEnvironment.ts` (fundo, luz hemisférica, luz direcional,
  chão em y = 0, grade de 2 m), `camera/createCamera.ts`, `controls/createOrbitControls.ts` (importado
  de `three/addons/controls/OrbitControls.js`, tipos do `@types/three`), `scene/buildCraneScene.ts`
  (cena sem renderer, testável), `scene/mountCraneScene.ts` (renderer WebGL, ResizeObserver, laço de
  renderização e `dispose()` idempotente) e `scene/disposeObject3D.ts`.
- Criei `frontend/src/presentation/components/CraneViewport.tsx` (monta e desmonta a cena num efeito,
  sem importar `three`), `SceneErrorBoundary.tsx` (mensagem se não houver WebGL) e
  `presentation/panels/CraneControlPanel.tsx` (4 sliders com limites e valor aplicado, formatado em
  pt-BR, e o aviso "FICTÍCIOS / só visual").
- Alterei `frontend/src/app/App.tsx` para compor viewport e painel, e criei `frontend/src/app/App.css`.
  Em `frontend/src/three/scene/createScene.ts` mudei só o comentário.
- Escrevi 57 testes novos em `frontend/tests/three/{crane,scene,camera}/` (58 no total com o já
  existente).
- Rodei os gates e o check-structure (§ 4). Rodei também `vite preview` e `vite` (dev) e fiz a
  verificação visual no painel de navegador do Claude Code (§ 4, "Teste manual").
- Criei `tasks/in-progress/TASK-013-poc-threejs-guindaste.md` e este handoff.

## 3. Arquivos modificados

`git diff --stat ae2ec66...HEAD` (antes do commit deste handoff; a base é `ae2ec66`, e não o
`development` local, que está em `f7570d7`):

```text
 frontend/src/app/App.css                           | 110 ++++++++
 frontend/src/app/App.tsx                           |  63 ++++-
 .../src/presentation/components/CraneViewport.tsx  |  36 +++
 .../presentation/components/SceneErrorBoundary.tsx |  26 ++
 .../src/presentation/panels/CraneControlPanel.tsx  |  82 ++++++
 frontend/src/three/camera/createCamera.ts          |  19 ++
 frontend/src/three/controls/createOrbitControls.ts |  18 ++
 frontend/src/three/crane/CraneController.ts        | 154 ++++++++++++
 frontend/src/three/crane/createProvisionalCrane.ts | 182 ++++++++++++++
 frontend/src/three/crane/types.ts                  |  38 +++
 frontend/src/three/scene/addEnvironment.ts         |  43 ++++
 frontend/src/three/scene/buildCraneScene.ts        |  29 +++
 frontend/src/three/scene/createScene.ts            |   2 +-
 frontend/src/three/scene/disposeObject3D.ts        |  23 ++
 frontend/src/three/scene/mountCraneScene.ts        |  67 +++++
 frontend/tests/three/camera/createCamera.test.ts   |  34 +++
 frontend/tests/three/crane/CraneController.test.ts | 278 +++++++++++++++++++++
 .../three/crane/createProvisionalCrane.test.ts     |  66 +++++
 frontend/tests/three/scene/buildCraneScene.test.ts |  39 +++
 frontend/tests/three/scene/disposeObject3D.test.ts |  84 +++++++
 .../in-progress/TASK-013-poc-threejs-guindaste.md  | 159 ++++++++++++
 21 files changed, 1547 insertions(+), 5 deletions(-)
```

Mais `handoffs/TASK-013.md` (este arquivo). `frontend/package.json` e `frontend/package-lock.json`
não mudaram: nenhuma dependência nova.

Fora do escopo: nenhum.

## 4. Comandos executados e resultados

Todos em `frontend/`, exceto o check-structure (na raiz), com Node v24.19.0 e npm 11.17.0.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ passou | `added 185 packages, and audited 186 packages in 5s` · `found 0 vulnerabilities` |
| `npm run lint` | ✅ passou | `eslint .` sem nenhum problema (exit 0) |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b` sem erros (exit 0) |
| `npm test` | ✅ passou | `Test Files  6 passed (6)` · `Tests  58 passed (58)` |
| `npm run build` | ✅ passou, com aviso | `dist/assets/index-*.js 788.06 kB │ gzip: 210.13 kB` · `✓ built` · aviso `(!) Some chunks are larger than 500 kB after minification` (Pendência 3) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)` · `4 commit(s) desta branch sem co-autoria de IA` |
| ESLint via stdin: `import { Scene } from 'three'` como `src/presentation/components/Probe.tsx` | ✅ barrado | `'three' import is restricted from being used. Importe Three.js só dentro de src/three/ (ADR-005)` |
| `npx vite preview --port 4613 --strictPort` | ✅ subiu | `Local: http://localhost:4613/`; `curl` devolveu `200` e o `index.html` do build |

**Teste manual (§ 7 da tarefa), feito pelo agente no painel de navegador do Claude Code:**

- build de produção (`vite preview`): cena com chão, grade, luzes e guindaste na pose inicial (0°,
  35°, 12,0 m, 5,0 m); sem mensagens no console. Com os sliders em 120°, 65°, 22,0 m e 12 m, o
  guindaste girou, levantou, estendeu e baixou o gancho, e os valores mostrados bateram com os inputs
  (`120°`, `65°`, `22,0 m`, `12,0 m`, lidos no DOM).
- modo dev (`vite`, com StrictMode): `document.querySelectorAll('canvas').length` = `1` depois da
  montagem dupla, 4 sliders habilitados e nenhum erro no console. Isso mostra que a primeira cena foi
  desmontada e o canvas dela removido.
- não verificado por mim: arrastar com o mouse para orbitar e o fallback sem WebGL. O clique simulado
  nos sliders não moveu o valor, então usei preenchimento de formulário; o arraste real fica para a
  pessoa conferir.

## 5. Decisões tomadas

- **Branch a partir de `ae2ec66`**, e não do HEAD do worktree (`f7570d7`), como pedido.
- **Pose de repouso só visual:** com os comandos em zero, a lança fica horizontal ao longo do +Z local
  da torre, e ângulo positivo levanta a ponta. Isso foi preciso para desenhar algo. **Não** é
  convenção do ADR-013: coincide com a proposta dele, mas o mapeamento graus → rotação está isolado
  em `CraneController` (`apply*`), para mudar num lugar só se o ADR-013 for aceito com outro zero ou
  sentido (Pendência 1).
- **Clamp, sem normalizar o giro:** o giro é limitado a [mín., máx.] como os demais comandos. Não
  implementei a normalização em [0°, 360°) do ADR-013 C-2, porque ele está Proposto.
- **Valor não finito lança `RangeError`** e não muda o estado. Clamp de `NaN` daria `NaN` nas
  transformações; um slider nunca manda isso, então é erro de programação.
- **Estado inicial padrão = valor permitido mais próximo de zero** em cada comando. A PoC passa uma
  pose inicial FICTÍCIA explícita.
- **Limites FICTÍCIOS** (giro −180..180°, inclinação 0..80°, lança 12..22 m, cabo 1..15 m) ficam em
  `createProvisionalCrane.ts`, junto das dimensões do modelo provisório, e chegam à UI por
  `controller.limits`. A UI não conhece os valores.
- **Uma seção telescópica só**, que desliza ao longo do +Z da lança; a ponta é filha da extensão. O
  controller exige lança mín. ≥ lança recolhida do modelo, para a extensão nunca entrar para trás.
- **Erro de WebGL com error boundary**, e não com `setState` no efeito: a regra
  `react-hooks/set-state-in-effect` (plugin 7.x) barra `setState` síncrono dentro de efeito, e o React
  entrega a um error boundary os erros lançados em efeitos.
- **`renderer.forceContextLoss()` depois de `renderer.dispose()`:** libera o contexto WebGL na hora (o
  StrictMode monta a cena duas vezes em dev, e o navegador limita o número de contextos). O `dispose()`
  do Three r186 remove antes o listener de "context lost", então não aparece log.
- **Cena separada em `buildCraneScene` (sem renderer) e `mountCraneScene` (WebGL/DOM)**, para testar a
  montagem em ambiente node.
- **Câmera inicial** em (22, 13, 28), olhando para (0, 7, 3). Com lança de 22 m a 80°, a ponta pode
  sair de um viewport pequeno; a roda do mouse afasta a câmera.

## 6. Regras de negócio aplicadas

- RN-003 / RN-008: o `CraneController` só move a representação visual. Não calcula raio, altura nem
  capacidade, e não decide segurança (comentário na classe; painel avisa "só visual").
- Dados fictícios rotulados FICTÍCIO (ADR-012): constantes do modelo provisório, nomes dos `describe`
  e aviso no painel.
- Nenhuma regra não documentada foi implementada.

## 7. O que NÃO foi feito e por quê

- `getOperationalGeometry()`, posições de referência em coordenadas de mundo (doc-fonte § 12.2) e
  qualquer fórmula: dependem do aceite do ADR-013 (fora do escopo, por decisão da pessoa).
- Testes automatizados dos componentes React e de `mountCraneScene`: exigiriam jsdom/Testing Library
  e WebGL (dependência nova, vetada). Ficaram como teste manual (§ 7 da tarefa).
- Carregamento de GLB, integração com backend, capacidade e alertas: fora do escopo.
- Atualização de `docs/architecture.md` (§§ 2 e 9 ainda dizem "nada disso existe"),
  `docs/development-guide.md` (§ 4, "estrutura planejada") e `docs/known-gaps.md` (L-001): esses
  arquivos estão com as TASK-010/011, e esta tarefa só pode tocar `frontend/` (Pendência 2).
- Push e PR: não feitos, por instrução desta sessão.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Quando o ADR-013 for decidido: confirmar se o zero e o sentido do giro (+Z, anti-horário visto de cima) e da inclinação (0° horizontal, positivo para cima) usados na PoC valem, e se o giro deve ser normalizado em [0°, 360°) em vez de limitado. Depois disso, entra `getOperationalGeometry()` numa tarefa nova | não (para a PoC) | | |
| 2 | Depois do merge das TASK-010/011, atualizar `docs/architecture.md` §§ 2 e 9, `docs/development-guide.md` § 4 e `docs/known-gaps.md` L-001 para dizer que o frontend já tem cena, `CraneController` e guindaste provisório. Fazer numa tarefa curta de docs, ou deixar para a próxima tarefa de frontend? | não | | |
| 3 | O build avisa que o bundle tem 788 kB (Three.js inteiro), acima do limite de aviso de 500 kB do Vite. Tratar (code-splitting com `import()` da cena, ou subir `build.chunkSizeWarningLimit`) numa tarefa futura, ou aceitar o aviso na PoC? | não | | |
| 4 | Testes de componentes React (viewport, painel) precisam de jsdom e Testing Library como devDependencies. Autorizar numa tarefa futura? | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta), depois a pessoa responsável

**O que fazer, concretamente:**
1. Revisar o diff `git diff ae2ec66...task/TASK-013-poc-threejs-guindaste` com
   `docs/templates/code-review-template.md`.
2. Rodar o teste manual da tarefa (§ 7), principalmente orbitar com o mouse e mover os sliders.
3. Pessoa responsável: responder as Pendências 1–4; fazer push e abrir o PR (autorização permanente
   5 do `handoffs/current.md`) quando quiser.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-013-poc-threejs-guindaste.md` §§ 3 e 7
4. `frontend/src/three/crane/CraneController.ts` (a lógica principal)
5. `frontend/src/three/scene/mountCraneScene.ts` (montagem e dispose)
6. `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` C-2 (para ver o que **não** foi adotado como decisão)

**Cuidado com:**
- `rotation.x` da lança com ângulo 0 vale `-0` (negação de zero). É inofensivo; os testes usam
  `toBeCloseTo`.
- O cabo fica na vertical porque o nó `cable` recebe a rotação oposta à da lança. Se um dia a torre
  ou a lança ganharem outra rotação (por exemplo, inclinação do chassi), essa compensação muda.

## 11. Como revisar este trabalho (só quando a etapa for implementação/correções)

- Comece por `frontend/src/three/crane/CraneController.ts` e
  `frontend/tests/three/crane/CraneController.test.ts`.
- Depois veja `frontend/src/three/scene/mountCraneScene.ts`, onde está a liberação de recursos.
  Confira se falta liberar algo: a cena não tem texturas, e `disposeObject3D` cobre malhas, linhas e
  pontos.
- Tenho menos certeza sobre o dimensionamento: o canvas é esticado por CSS e só a resolução acompanha
  o `ResizeObserver`. Em telas com `devicePixelRatio` > 2, a resolução é limitada a 2×.
- `mountCraneScene` e os componentes React não têm teste automatizado (ver § 7); a evidência é o
  teste manual do § 4.
