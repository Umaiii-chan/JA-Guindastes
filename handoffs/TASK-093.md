# Handoff — TASK-093 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-16 23:55 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-093-moitao-patolas.md` |
| **Etapa concluída** | implementação (com os testes de regressão) |
| **Papel exercido** | Engenheiro de testes e Implementador (a mesma sessão; a revisão fica para outra ferramenta) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), em worktree `C:\dev\JA-Guindastes-wt\gancho` |
| **Branch** | `task/TASK-093-moitao-patolas`, a partir de `anderson/development` @ `784a9e1` |
| **Origem** | auditoria de 2026-10-16 (física, simulação e tela), achados F-09, F-25, F-26 e F-27 |

## 1. Objetivo

Fazer o engate, a colisão e o planejamento usarem o moitão da cadeia quando ele substitui o do
modelo (F-09), levar as sapatas até o terreno (F-25) e fazer a tela e a avaliação seguirem o que a
animação das patolas já alcançou (F-27), com o aviso de "modelo sem patolas" só quando for verdade (F-26).

## 2. O que foi feito

- **F-09 — moitão** (`frontend/src/three/scene/HookLoad.ts`, sem mudar assinatura pública):
  `currentAttachOffsetM` devolve `REPLACED_HOOK_ATTACH_M` (0,01 m, agora exportado; é o mesmo valor
  do backend em `recommend_lift_plan.py`) quando `hookReplaced`; `currentHookBox` devolve a caixa do
  moitão da cadeia: as malhas do acessório marcado (quando o modelo dele já chegou) ou, antes disso,
  a faixa vertical que ele ocupa (só a altura é conhecida: largura 0). Cadeia sem marcação conta
  inteira como o moitão. Os três consumidores (`CargoOperation.ts:205`, `SceneCollisions.ts:107`,
  `mountCraneScene.hookAttachOffsetM`) passam a receber o valor efetivo sem mudança neles.
  - `AccessoryChain.ts`: cada espaço da cadeia leva `userData.replacesHook`
    (`REPLACES_HOOK_USER_DATA`), para o `HookLoad` saber qual é o moitão.
  - `HookLoad.remeasureAccessories()` (método novo): a cena chama quando o modelo de um acessório
    chega (`onChange` da `AccessoryChain` em `mountCraneScene`), e então reavalia as colisões.
  - `mountCraneScene.setAccessories` chama `crane.revalidate()` depois de trocar a cadeia (o ponto
    de amarração e a caixa do gancho mudam; o engate é recalculado no `reportCollision`).
- **F-25 — sapatas no terreno** (`frontend/src/three/crane/OutriggerController.ts`):
  `terrainHeightInFrame(getFrame, worldHeightAt)` converte a altura do terreno do mundo para o
  referencial da base (três iterações de ponto fixo ao longo do −Y da base, para o chassi inclinado).
  - `mountCraneScene.ts`: o `OutriggerController` recebe
    `groundHeightAt: terrainHeightInFrame(() => contents.rig.base, environment.heightAt)` e
    `setScenario` chama `outriggers.reapply()`.
  - `ExtraCrane.ts`: guarda o terreno de `setPlacement`, passa `terrainHeightAt(this.terrain, …)` e
    reaplica as patolas em `setPlacement`.
  - O repouso das patolas passou a ser medido direto no referencial da base (`boxInFrameOf`), e não
    numa caixa do mundo, que sai torta se o chassi já estiver inclinado na primeira medição.
- **F-27 — estado alcançado**: `OutriggerController.reportedState` dá, campo a campo, o **menos pronto
  entre o comando e o desenho do último marco** (vigas chegam a 100 % ou saem dele, macacos apoiam ou
  sobem, fim da animação). "Pronta" só vale quando os macacos apoiam no desenho (~4,5 s depois de
  "Apoiar e nivelar" com as vigas recolhidas); recolher deixa de valer na hora; entre os marcos o
  valor não muda (nada de um estado novo por quadro). Com movimento reduzido, vale na hora.
  - `mountCraneScene.ts`: opção nova `onOutriggersChange(report)` com
    `OutriggerSceneReport { state, moving, modelAvailable }`, chamada na montagem, nos marcos e
    quando o GLB chega. A inclinação do chassi (`setLevelingDeg`) passou a seguir o nivelamento
    desenhado, e não o comando, e as sapatas são reaplicadas quando ela muda.
  - `CraneViewport.tsx`: prop `onOutriggersChange` repassada.
  - `OutriggerPanel.tsx`: props novas `reached` (estado alcançado; padrão = comando) e `moving`
    ("· em movimento" no texto dos macacos). O aviso de prontas e o texto usam `reached`; o controle
    deslizante e os botões continuam no comando.
- **F-26 — aviso do modelo**: o painel recebe `modelAvailable` real (`OutriggerController.hasModel()`
  depois da troca do modelo); a nota "o modelo 3D atual não traz as patolas" só aparece sem os nós
  `crane-outrigger-*` (ou sem cena).
- **`SimulatorRoute.tsx` — só o trecho das patolas** (linhas do arquivo final):
  - 89: `import type { OutriggerSceneReport }`;
  - 153–156: estado `outriggerScene` e `reachedOutriggers` (sem cena, vale o comando);
  - 241: `buildEvaluationInput` recebe `reachedOutriggers` em vez de `outriggers`;
  - 702: `onOutriggersChange={setOutriggerScene}` no `CraneViewport`;
  - 791–794: `reached`, `moving` e `modelAvailable` no `OutriggerPanel`.
  A gravação continua guardando o **comando** (`snapshot.outriggers`), para a reprodução animar igual.
- **E2E** `frontend/e2e/tests/outriggers.spec.ts`: as esperas que dependem da animação ganharam
  folga de 20 s (`ANIMATION_TIMEOUT_MS`): no SwiftShader cada quadro avança no máximo 0,1 s de
  animação, então os 3 s das vigas e os 1,5 s dos macacos podem levar mais tempo de relógio. Depois
  de "Apoiar e nivelar", o teste confere "em movimento" e "não prontas" antes de "Patolas prontas".
  O comentário do topo ("o modelo 3D atual não traz as patolas") estava desatualizado e saiu.
- **Testes novos** (cenários de prova da auditoria em `vt/audit1.test.ts` e `audit5.test.ts`):
  - `frontend/tests/three/scene/hookBlockReplacement.test.ts` (6): getters com e sem moitão; caixa só
    do moitão (não da manilha) e medida quando o modelo chega; guindaste provisório engata sem a
    carga saltar (antes, +1,09 m); GLB 80 t desce até a pose do planejador sem bloqueio, engata com
    folga de 0,2 m e para no topo da carga ao descer mais (antes, parava 0,56 m acima e a folga era
    −1,40 m); o ponto que vai ao planejamento é 0,01 m.
  - `frontend/tests/three/scene/outriggersOnTerrain.test.ts` (2): guindaste adicional com o GLB 80 t
    numa rampa de 3 %/6 %: as quatro sapatas a menos de 0,5 mm do terreno, também depois de mudar de
    lugar. **Sem a correção do `ExtraCrane` o teste falha** (conferido com `git stash`: sapatas a
    −0,22 m e +0,28 m do terreno).
  - `frontend/tests/three/crane/OutriggerController.test.ts` (+8): sapatas no terreno com o chassi
    deslocado, girado e inclinado; reaplicar com terreno novo; sem base; estado alcançado (marcos,
    recolher na hora, sem estado por quadro, movimento reduzido, nivelamento 0 sem macacos).
  - `frontend/tests/presentation/panels/OutriggerPanel.test.ts` (4): "não prontas" e "em movimento"
    com o comando pronto e a animação a caminho; "prontas" ao chegar; sem cena vale o comando; nota
    do modelo só com `modelAvailable` falso.

## 3. Arquivos modificados

`git diff --stat anderson/development...HEAD` (antes deste handoff):

```text
 frontend/e2e/tests/outriggers.spec.ts              |  24 ++-
 frontend/src/app/routes/SimulatorRoute.tsx         |  11 +-
 .../src/presentation/components/CraneViewport.tsx  |  13 ++
 .../src/presentation/panels/OutriggerPanel.tsx     |  20 ++-
 frontend/src/three/accessories/AccessoryChain.ts   |  12 +-
 frontend/src/three/crane/OutriggerController.ts    |  89 ++++++++++-
 frontend/src/three/scene/ExtraCrane.ts             |  24 ++-
 frontend/src/three/scene/HookLoad.ts               |  92 ++++++++---
 frontend/src/three/scene/mountCraneScene.ts        |  99 ++++++++++--
 .../presentation/panels/OutriggerPanel.test.ts     |  54 +++++++
 .../tests/three/crane/OutriggerController.test.ts  | 164 +++++++++++++++++++-
 .../tests/three/scene/hookBlockReplacement.test.ts | 172 +++++++++++++++++++++
 .../tests/three/scene/outriggersOnTerrain.test.ts  |  88 +++++++++++
 tasks/in-progress/TASK-093-moitao-patolas.md       |  16 ++
 14 files changed, 825 insertions(+), 53 deletions(-)
```

Fora do escopo: nenhum. Não toquei `SwitchableCrane.ts`, `usePlanPlayback.ts`, `CraneController.ts`,
`domain/collision/**`, `MultiCrane.ts`, `domain/tandem/**`, `TandemCargo.ts`, backend,
`handoffs/current.md`, `docs/business-rules.md` nem ADR. `AccessoryChain.ts` mudou só para marcar o
moitão (necessário ao F-09).

Commits: `57c8e21` chore(tasks), `8acc36e` fix(gancho) F-09, `b0b502d` fix(patolas) F-25, `d9f01a1`
fix(patolas) F-27/F-26, mais o deste handoff. Os dois intermediários foram conferidos numa worktree
destacada temporária: `tsc -b` limpo e `vitest run tests/three tests/presentation` com 520 e 525
testes passando.

## 4. Comandos executados e resultados

Em `frontend/`, no `HEAD` final (`npm ci` uma vez antes de tudo: `exit 0`).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npx vitest run` (antes de mudar, referência) | ✅ | `121 passed (121)`, `1066 passed \| 1 skipped` |
| `npm run lint` | ✅ | `eslint .` sem problemas, `exit=0` |
| `npm run format:check` | ❌ (pré-existente) | `Code style issues found in 6 files`: `SimulatorPage.module.css`, `BackendEvaluationPanel.module.css`, `panels.module.css`, `CargoOperationPanel.module.css`, `RecordingPanel.module.css`, `TandemHud.module.css` — nenhum foi tocado; os seis estão **sem quebra de linha no fim já em `784a9e1`** (`git show 784a9e1:<arquivo> \| tail -c 1` = `}`). Os arquivos desta tarefa passam (`prettier --check src tests e2e` só acusa esses seis) |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e`, `exit=0` |
| `npm test` | ✅ | `Test Files 124 passed (124)`, `Tests 1086 passed \| 1 skipped (1087)` (+20) |
| `npm run build` | ✅ | `✓ built in 1.79s` (aviso de chunk > 500 kB, já existente) |
| `E2E_PREVIEW_PORT=5293 npx playwright test --config e2e/playwright.config.ts outriggers.spec.ts cargoDelivery.spec.ts` | ✅ | `2 passed (1.7m)`: `cargoDelivery.spec.ts` (1,2 min) e `outriggers.spec.ts` (11,6 s). Os `ws proxy error … 127.0.0.1:8000` do log são esperados (sem backend, a avaliação cai no REST simulado) |
| `bash scripts/check-structure.sh` (raiz) | ❌ (pré-existente) | `FALHOU: 2 erro(s), 2 aviso(s)`: "há 18 tarefas em tasks/in-progress/ (máximo: 15)" (a base já tinha 17; esta tarefa soma uma) e "TASK-080 sem handoff"; avisos de formato só em TASK-072 e TASK-082. Branch, links, segredos e "124 commits sem co-autoria de IA" passam |
| Suíte E2E completa | ⚠️ NÃO EXECUTADO | rodei só os dois E2E ligados à tarefa (a suíte inteira no SwiftShader leva muito tempo e as outras frentes usam a máquina) |
| E2E com backend (`E2E_BACKEND=1`) | ⚠️ NÃO EXECUTADO | o Docker não sobe nesta máquina (pendência 6 do `current.md`) |

## 5. Decisões tomadas

- **Caixa do moitão sem modelo 3D = faixa vertical, largura 0.** Só a altura (`rigging_height_m`) é
  conhecida; inventar a largura seria criar medida. Uma caixa sem largura ainda bate no terreno, na
  carga no chão e nos obstáculos. Quando o modelo do acessório chega, vale a caixa medida.
- **Estado das patolas que vale = o menos pronto entre comando e desenho**, campo a campo. Subindo
  (estender, apoiar, nivelar), vale o que o desenho já alcançou nos marcos; descendo (recolher,
  reduzir a extensão), vale o comando na hora, porque é o lado seguro: o guindaste deixa de estar
  "pronto" assim que a pessoa manda recolher. Sem cena (WebGL indisponível), vale o comando.
- **Marcos, não quadros**: o estado só muda quando as vigas chegam a 100 % ou saem dele, quando os
  macacos apoiam ou sobem e quando a animação termina; extensão e nivelamento arredondados para baixo
  nos marcos. Evita um envio ao backend por quadro e uma mensagem "Patolas a 37 %".
- **A inclinação do chassi segue o nivelamento desenhado** (antes mudava no comando). É o "estado
  mostrado" do F-27; só desenho (a colisão segue o guindaste na vertical, ADR-032/035).
- Não criei ADR: é comportamento de tela e avaliação pedido no F-27, sem decisão de arquitetura. Se a
  pessoa responsável quiser registrar a regra "menos pronto entre comando e desenho" como ADR, ver § 8.

## 6. Regras de negócio aplicadas

- RN-013 — "prontas" continua sendo vigas a 100 % e macacos apoiados (`outriggersReady`); mudou só
  **de onde** vem o estado (o alcançado pela animação). Testes em `OutriggerController.test.ts` e
  `OutriggerPanel.test.ts`.
- RN-012 — o moitão da cadeia é o gancho que colide (`hookBlockReplacement.test.ts`).
- RN-014 / ADR-026 — a cadeia parte do fim do cabo com moitão; o peso dos acessórios não mudou.
- RN-008 — nada é calculado na cena; o backend recebe o estado alcançado.

## 7. O que NÃO foi feito e por quê

- A fiação em `mountCraneScene.ts` (sapatas do guindaste principal no terreno, inclinação seguindo a
  animação, `onOutriggersChange`, remedição do moitão) **não tem teste unitário**: a função cria um
  `WebGLRenderer` e não há teste dela no projeto. Está coberta pelo E2E das patolas (estado e aviso)
  e, para as sapatas, pelo teste do `ExtraCrane`, que usa o mesmo `terrainHeightInFrame`.
- O halo do gancho sem carga continua em volta do moitão escondido do modelo quando há moitão na
  cadeia (só desenho; fora do F-09).
- A cadeia de acessórios inteira na colisão (F-10) é de outra frente (TASK-091). Ela monta a caixa
  da cadeia a partir de `currentAttachOffsetM`, que agora devolve 0,01 m com moitão: as duas
  correções se somam sem conflito de lógica.
- A gravação guarda o comando das patolas, não o alcançado; a reprodução anima a partir dele.
- O tandem continua sem estado de patolas na avaliação (F-05, outra frente).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Integração com a TASK-094 (nivelamento na avaliação): ela calcula `residualGroundSlopeDeg(scenario.groundSlopeDeg, outriggers)` com o **comando**. Depois de mergear as duas, trocar `outriggers` por `reachedOutriggers` ali e na dependência `outriggers.levelingDeg` do efeito da sessão, para o nivelamento também valer só quando desenhado. Sem conflito textual: `git merge-tree --write-tree HEAD 742370d` (TASK-094) mescla limpo, como também contra `6964153` (TASK-090) e `d47c84c` (TASK-092), conferido em 2026-10-16 | não | | |
| 2 | `format:check` falha em `development` @ `784a9e1` por 6 arquivos CSS sem quebra de linha no fim (lista no § 4). O job do frontend no CI deve falhar nesse passo independentemente desta tarefa. Corrigir numa tarefa à parte? | não | Corrigido à parte na TASK-097 (PR #46) | 2026-10-16 |
| 3 | Recolher as patolas deixa de valer **na hora** (lado seguro), embora o desenho leve até 3,5 s para tirar os macacos do chão. Está de acordo? A alternativa é seguir o desenho também na descida | não | Sim, recolher vale na hora (Anderson Sehnem, em chat) | 2026-10-16 |
| 4 | Registrar a regra do estado das patolas (menos pronto entre comando e desenho, por marcos) num ADR novo? | não | | |
| 5 | Durante a execução de uma trajetória planejada, "Estender patolas" dispara a animação e a avaliação mostra "patolas não prontas" nos primeiros ~4,5 s (antes era instantâneo). É o comportamento correto pelo F-27; avisar se preferir que o planejamento espere as patolas antes de começar a mover | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra ferramenta, AGENTS.md § 3), depois a pessoa responsável (merge).

**O que fazer, concretamente:**
1. Revisar o diff `anderson/development...task/TASK-093-moitao-patolas` com
   `docs/templates/code-review-template.md`.
2. Rodar `npm test` e o E2E `outriggers.spec.ts` (§ 4).
3. Ao integrar com a TASK-094, aplicar a pendência 1.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-093-moitao-patolas.md`
4. `frontend/src/three/scene/HookLoad.ts` (getters e `measureReplacedHook`)
5. `frontend/src/three/crane/OutriggerController.ts` (`reportedState`, `captureMilestone`, `terrainHeightInFrame`)
6. `frontend/src/three/scene/mountCraneScene.ts` (`reportOutriggers`, `syncLeveling`)

**Cuidado com:**
- `HookLoad` mede o moitão em `rebuild` e em `remeasureAccessories`; se outra parte da cena trocar a
  malha de um acessório, precisa chamar `remeasureAccessories`.
- `OutriggerController.reportedState` é diferente de `currentState` (desenho contínuo) e de
  `targetState` (comando): só ele vai para a tela e para a avaliação.

## 11. Como revisar este trabalho

- Comece por `HookLoad.ts` e `hookBlockReplacement.test.ts`: é a correção de maior impacto (engate e
  planejamento com o moitão do seed).
- Tenho menos certeza sobre a caixa sem largura do moitão antes do modelo chegar: funciona nos
  testes (terreno, carga no chão), mas um obstáculo fino ao lado do moitão só é detectado depois que
  o modelo dele carrega.
- O E2E das patolas depende do tempo da animação; as esperas de 20 s cobrem o SwiftShader. Se ficar
  instável no CI, a alternativa é rodar esse teste com `reducedMotion: 'reduce'` e conferir a espera
  da animação só no teste unitário.
