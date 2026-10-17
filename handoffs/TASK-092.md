# Handoff — TASK-092 — trajetória varrida e giro contínuo (implementação)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-16 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-092-trajetoria-giro.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (sem revisão independente) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), subagente na worktree `C:\dev\JA-Guindastes-wt\trajetoria` |
| **Branch** | `task/TASK-092-trajetoria-giro`, a partir de `development` @ `784a9e1` |

## 1. Objetivo desta etapa

Corrigir os achados F-08, F-11 e F-22 da auditoria (seção 2): a carga atravessando obstáculo fino
num quadro longo da trajetória, o salto para o outro lado do obstáculo perto de ±180° e o giro
contínuo que travava no slider.

## 2. O que foi feito

- `SwitchableCrane`: o `setState` guardado e o comando de um eixo passaram a usar a mesma rotina
  (`guardedMove`), que varre o caminho do estado anterior ao pedido com os passos de `SWEEP_STEP`
  (teto de 400 amostras, como antes no comando de um eixo), para no primeiro ponto inseguro e faz a
  busca binária entre o último passo seguro e ele. Todos os campos andam juntos.
- `pathBetween` (no `SwitchableCrane`): com giro contínuo, ψ anda pelo menor ângulo
  (`shortestAngleDeltaDeg`, de `application/recording/playback.ts`) e cada ponto só depois volta à
  faixa; com limites de giro, ψ anda pela diferença direta, dentro da faixa.
- `types.ts`: novo `TurretRange` (`NumericRange` + `continuous?`). `CONTINUOUS_TURRET_RANGE`
  (ficha sem ψ_min/ψ_max) e `PROVISIONAL_CRANE_LIMITS` (sem ficha) ficaram com `continuous: true`.
- `three/crane/turretRotation.ts` (novo, sem Three.js): `fitTurretToRange` (volta no contínuo, clamp
  com limites) e `turretTravelDeg` (menor ângulo no contínuo; meia volta exata segue o sentido pedido).
- `CraneController.clampTo`: o giro usa `fitTurretToRange` (181° vira −179° no contínuo; com limites,
  clamp como antes).
- `usePlanPlayback`: `MAX_FRAME_DT_S = 0,1` s de tempo real por quadro (como `OutriggerController`).
- `Slider`: prop `wraps`; nas pontas, as setas mandam `max + step` ou `min − step`. `CraneControlPanel`
  liga `wraps` só no "Giro da torre" e só com giro contínuo. Rótulo e nome acessível sem mudança.
- Sondas da auditoria viraram testes de regressão:
  - `tests/three/crane/guardedSetState.test.ts` (novo): poste de 0,2 m em 12° (`audit3`), salto
    0° → 15° com faixa proibida entre 5° e 7° (`fe/probe/setstate`), poste em 184° perto de ±180°
    (`audit1`), recuo de todos os campos juntos, teto de amostras e `guarded: false`;
  - `tests/three/crane/continuousTurret.test.ts` (novo): faixa, volta, menor ângulo, guarda nos dois
    sentidos, limites com clamp e a reprodução de gravação igual à de antes;
  - `tests/presentation/panels/CraneControlPanel.test.tsx` (novo) e um caso novo em
    `tests/presentation/ui/controls.test.tsx`: setas nas pontas;
  - `tests/app/usePlanPlayback.test.tsx`: caso novo do quadro longo; os dois casos antigos passaram
    de 8 quadros de 800 ms para 60 de 100 ms (com o limite, 800 ms andariam só 0,1 s).

Valores medidos depois da correção (sonda temporária, apagada em seguida):

| Cenário | Antes (auditoria) | Depois |
|---|---|---|
| Poste 0,2 m em ψ = 12°, R = 10,29 m, `setState` 4° → 20° | 20° (atravessa) | 9,963° (= `setTurretRotation`) |
| Poste 0,5 m em 184°, `setState` 179,5° → −178° | −173,1° (= 186,9°, do outro lado) | −178,804° (= 181,2°, antes do poste; = `setTurretRotation`) |
| Pior caso, 400 amostras com a cena provisória (Node) | — | ~3 ms |

## 3. Arquivos modificados

```text
$ git diff --stat 784a9e1...HEAD   (antes do commit deste handoff)
 frontend/src/app/craneSetup.ts                     |  11 +-
 frontend/src/app/planning/usePlanPlayback.ts       |  14 +-
 .../src/presentation/panels/CraneControlPanel.tsx  |   8 +-
 frontend/src/presentation/ui/Slider.tsx            |  22 ++-
 frontend/src/three/crane/CraneController.ts        |   3 +
 frontend/src/three/crane/SwitchableCrane.ts        | 161 ++++++++--------
 frontend/src/three/crane/provisionalCraneSpec.ts   |   7 +-
 frontend/src/three/crane/turretRotation.ts         |  31 ++++
 frontend/src/three/crane/types.ts                  |  22 ++-
 frontend/tests/app/usePlanPlayback.test.tsx        |  44 ++++-
 .../presentation/panels/CraneControlPanel.test.tsx |  67 +++++++
 frontend/tests/presentation/ui/controls.test.tsx   |  26 +++
 .../tests/three/crane/continuousTurret.test.ts     | 182 ++++++++++++++++++
 frontend/tests/three/crane/guardedSetState.test.ts | 205 +++++++++++++++++++++
 tasks/in-progress/TASK-092-trajetoria-giro.md      |  26 +++
 15 files changed, 740 insertions(+), 89 deletions(-)
```

Fora do escopo: nada. Não toquei em `HookLoad.ts`, `mountCraneScene.ts`, `OutriggerController.ts`,
`domain/collision/**`, `MultiCrane.ts`, `domain/tandem/**`, `SimulatorRoute.tsx` nem no backend.

## 4. Comandos executados e resultados

Em `frontend/`, depois de `npm ci` (exit 0; "1 high severity vulnerability" já existente no
`package-lock.json`, não mexi).

| Comando | Resultado | Saída (resumo) |
|---|---|---|
| `npm run lint` | passou | exit 0, sem avisos |
| `npm run format:check` | falhou, pré-existente | só 6 CSS de base sem quebra de linha no fim: `SimulatorPage.module.css`, `BackendEvaluationPanel.module.css`, `panels.module.css`, `CargoOperationPanel.module.css`, `RecordingPanel.module.css`, `TandemHud.module.css` (commits da TASK-078 e da TASK-082). Os arquivos desta tarefa: `npx prettier --check <arquivos>` → "All matched files use Prettier code style!" |
| `npm run typecheck` | passou | `tsc -b && tsc -p e2e`, exit 0 |
| `npm test` | passou | 124 arquivos, 1091 passed, 1 skipped |
| `npm run build` | passou | built in 1,06 s, só o aviso de chunk acima de 500 kB |
| testes novos antes da correção | falharam (esperado) | 5 de 9 em `guardedSetState.test.ts`, ex.: "expected 186.88753682933748 to be less than 184"; o caso do quadro longo no hook antigo: "expected [ 'aproximar', 'engatar', …(4) ] to deeply equal [ 'aproximar' ]" |
| `E2E_PREVIEW_PORT=5292 npx playwright test … collision rotationZones cargoDelivery objetosReais scene` | 10 passed, 3 failed, 2 skipped | as 3 falhas são pré-existentes, ver abaixo |
| as mesmas specs com falha no código da base (`git stash -u`, depois `git stash pop`) | falharam igual | `collision.spec.ts:34` e `rotationZones.spec.ts:98` com a mesma mensagem; `objetosReais.spec.ts:65` falha ainda antes (linha 54) |
| `bash scripts/check-structure.sh` | falhou, pré-existente | "há 17 tarefas em tasks/in-progress/ (máximo: 15)" (agora 18 com esta) e "TASK-080 sem handoff"; o mesmo erro de estrutura derruba o CI de `development` desde o PR #39 |

Falhas E2E pré-existentes, iguais na base:

- `collision.spec.ts:34` e `objetosReais.spec.ts:65`: `getByRole('group', { name: 'Colisões' })`
  esperado 0, recebido 1. É o F-24 da auditoria (o grupo sempre aparece desde a TASK-078).
- `rotationZones.spec.ts:98`: depois de `End` no giro, a zona continua "Frontal FICTÍCIA". Igual na
  base; não investiguei a causa (fora do escopo).
- Passaram os que exercitam o giro: `collision.spec.ts:68` (TASK-063: `Home`, `PageUp`, `End` no
  giro sem colisão), `rotationZones.spec.ts:135` (`Home` leva a −180°, "o mesmo giro que 180°") e
  `cargoDelivery.spec.ts:63`.
- Para rodar, foi preciso `npx playwright install chromium` (havia a revisão 1234; o Playwright 1.63
  pede a 1243).

## 5. Decisões tomadas

- **Mudança na TASK-077 CA-1:** o `setState` guardado deixou de conferir só o estado final e passou a
  varrer o caminho (pedido desta tarefa). O recuo continua com todos os campos juntos.
- Giro contínuo = faixa com `continuous: true`, não "largura de 360°": uma ficha que traga
  ψ_min = −180° e ψ_max = 180° continua sendo batente (ADR-013 C-4: só a ausência de ψ_min/ψ_max é
  giro contínuo).
- Com limites de giro, o caminho não vai pelo menor ângulo: quando o menor ângulo passa pelo batente
  (ex.: faixa −170°..170°, de 160° para −160°), o guindaste só pode ir por dentro da faixa.
- Meia volta exata (0° → −180° com `Home`) segue o sentido pedido; −180° e 180° são o mesmo giro e
  ficam como vieram (o E2E `rotationZones.spec.ts:135` depende de −180° continuar −180°).
- Quando o comando passa sem bloqueio, fica o valor pedido trazido à faixa; fora dela, a volta cai em
  [mín, mín + 360°) (540° vira −180°).
- `turretRotation.ts` fica em `three/crane/` (sem Three.js) e importa `shortestAngleDeltaDeg` de
  `application/recording/playback.ts`, como pedido, em vez de duplicar a função. `three/` já importa
  de `application/` (`SceneEditor.ts`).
- Sem ADR novo: não há decisão de arquitetura (o giro contínuo já está no ADR-013 C-4 e o bloqueio no
  último estado seguro é a RN-012). O ADR-028 § 4 (Aceito) fala só em "busca binária entre o valor
  anterior e o pedido"; a varredura do comando de um eixo (TASK-063) e agora a do lote não estão em
  ADR nenhum. Ver § 8, item 2.
- Docs: nenhum arquivo de `docs/` descreve a guarda nem o comando em lote (verifiquei com grep), então
  só a documentação no código mudou (`types.ts`, `SwitchableCrane.ts`, `usePlanPlayback.ts`).

## 6. Regras de negócio aplicadas

- RN-012: o lote da trajetória e o comando de um eixo param no último estado seguro do caminho, não só
  do fim. Testes em `guardedSetState.test.ts` e `continuousTurret.test.ts`.
- Nenhuma regra nova. Valores dos testes FICTÍCIOS e rotulados (ADR-012).

## 7. O que NÃO foi feito e por quê

- CA-6 (validação no navegador da trajetória com a aba em segundo plano e do giro contínuo pelo
  slider): NÃO EXECUTADO. Os E2E existentes não executam trajetória planejada, e o backend de
  planejamento não estava no ar.
- E2E com backend (`E2E_BACKEND=1`): NÃO EXECUTADO (sem a stack Docker nesta máquina).
- Não corrigi os 6 CSS do `format:check`, nem o F-24, nem `rotationZones.spec.ts:98`: são
  pré-existentes e de outras frentes, e mexer aqui criaria conflito com as branches paralelas.
- Não toquei em `fitTurretRotation` (`application/planning/trajectoryPlayback.ts`). Observação, não
  verificada no navegador: com uma ficha com limites mais largos que 360° (ex.: −200°..200°), ele
  escolhe o representante perto do meio da faixa, e de 179,5° para 182° pode pedir −178°; aí o caminho
  "por dentro da faixa" dá 357,5°. Não acontece com as faixas de hoje (giro contínuo ou faixas menores
  que uma volta).

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? |
|---|---|---|
| 1 | Revisão independente do diff (AGENTS.md § 3) | não |
| 2 | Registrar num ADR novo (complementando o ADR-028 § 4) que a guarda varre o caminho em passos pequenos, no comando de um eixo (TASK-063) e no lote (TASK-092)? | não |
| 3 | Os erros do `check-structure.sh` (17 tarefas em andamento, máximo 15; TASK-080 sem handoff) derrubam o CI de `development` antes do job de frontend: mover tarefas mergeadas para `tasks/completed/` é decisão da pessoa | não, mas o CI deste PR também vai falhar nesse passo |

## 9. Próximo passo

**Papel:** Revisor (outra ferramenta).

1. Conferir `git diff 784a9e1...task/TASK-092-trajetoria-giro`.
2. No navegador: executar uma trajetória, trocar de aba por alguns segundos e voltar (a execução
   continua de onde estava, sem saltos); no giro contínuo, levar o slider a 180° e apertar a seta
   para a direita (vai a −179°).

**Ler primeiro:** esta nota, `tasks/in-progress/TASK-092-trajetoria-giro.md`,
`frontend/src/three/crane/SwitchableCrane.ts` e `frontend/src/three/crane/turretRotation.ts`.
