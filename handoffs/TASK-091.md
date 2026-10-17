# Handoff — TASK-091 (colisões completas)

Papel exercido: implementador (código, testes, ADR-044 Proposto e este handoff), com o agente Claude
Code (Opus 5.5) em 2026-10-16/17, na worktree `C:\dev\JA-Guindastes-wt\colisoes`. Revisão
independente: não feita (AGENTS.md § 3).

## O que foi feito

- **F-17** — `domain/collision/terrainSampling.ts` (novo): face de baixo da caixa com passo fixo de
  0,5 m, teto de 1 024 pontos no total (`gridCounts` em `obb.ts`) e picos analíticos das feições
  (elevação, platô, aplainamento, rampa). `obbSurfacePoints` também passou a ter teto no total.
- **F-10** — `collisions.ts`: caixa da cadeia de acessórios (`chain`, sujeito `accessories`), de
  G − `currentAttachOffsetM` até G − amarração − `currentAccessoriesDropM` (getters de `HookLoad`, sem
  editá-lo), com 0,3 m de lado FICTÍCIO. `SceneCollisions` passa a cadeia; `mountCraneScene`
  reavalia ao trocar acessórios.
- **F-07** — `multiCraneCollisions.ts`: carga, gancho e cadeia de cada guindaste contra o corpo dos
  outros e o cabo (caixa fina de 0,1 m, FICTÍCIA) contra a lança dos outros, com ou sem tandem;
  `CollisionHit.owner` diz de quem é. `MultiCrane.crossReport` passa `SceneCollisions.payload()`; só
  a carga do dono fica vermelha (`setOwnerLabel`).
- **F-23** — carga do tandem contra `obstacleObbs`.
- **F-24** — confirmado no histórico: `cdc573b` (TASK-078) passou a renderizar sempre o grupo, para a
  altura não mudar, e `dc9aaa6` (TASK-082) o pôs sobreposto à cena. Corrigidos os testes
  (`collision.spec.ts`, `objetosReais.spec.ts`: zero `listitem` no grupo) e o comentário.
- **F-30** — `obb.test.ts`: caso de fato só de aresta (o antigo virou "eixo de face Y já separa");
  `objectCollisions.test.ts`: giro a 90° e a 30° comparado com `rotation.y` do Three.js.

Commits: `0ad38f8` (F-17), `6841101` (F-10), `c9a7b78` (F-07), `6466c41` (F-23), `ba25fd5` (F-30),
`e25063b` (F-24), merge `ae9034b` de `anderson/development` (`a1c7754`, TASK-097), e o de docs.

## Arquivos

`frontend/src/domain/collision/{collisions,multiCraneCollisions,obb,terrainSampling}.ts`,
`frontend/src/three/scene/{SceneCollisions,MultiCrane,mountCraneScene}.ts`,
`frontend/src/presentation/simulator/CollisionAlerts.tsx`, `frontend/e2e/tests/{collision,objetosReais}.spec.ts`;
testes: `frontend/tests/domain/collision/{collisions,multiCraneCollisions,obb,objectCollisions,terrainSampling}.test.ts`,
`frontend/tests/three/scene/{MultiCrane,SceneCollisions,cargoOperationScene}.test.ts`,
`frontend/tests/presentation/simulator/collisionAlerts.test.tsx`; docs: esta tarefa, este handoff e
`docs/decisions/ADR-044-colisoes-entre-guindastes-acessorios-e-terreno.md`.

## Comandos e saída (em `frontend/`, depois do merge)

- `npm ci`: 261 pacotes, 1 vulnerabilidade alta já existente (não mexi).
- `npm run lint`: sem erros. `npm run format:check`: "All matched files use Prettier code style!"
  (antes do merge da TASK-097, falhava só em 6 CSS da TASK-078 que não toquei).
- `npm run typecheck`: sem erros. `npm run build`: "built", com o aviso de chunk > 500 kB que já existia.
- `npm test`: 123 arquivos, 1100 passaram, 1 pulado (antes: 121 arquivos, 1066 passaram, 1 pulado;
  a primeira rodada da linha de base teve 1 falha intermitente no `tests/setup.ts`, a segunda passou).
- `E2E_PREVIEW_PORT=5293 npx playwright test e2e/tests/collision.spec.ts e2e/tests/objetosReais.spec.ts
  --config e2e/playwright.config.ts`: `collision.spec.ts` 2 passaram; `objetosReais.spec.ts` falha em
  `placeFromLibrary` (linha 54, o galpão não é colocado), antes da linha alterada. A mesma falha
  aparece no código de `784a9e1` (rodei com as mudanças guardadas): é anterior a esta tarefa.
- `bash scripts/check-structure.sh` (raiz, depois do merge): "OK: 0 erros, 1 aviso(s)" (o aviso: 2
  tarefas em `tasks/in-progress/`, esta e a TASK-097). Antes do merge: 2 erros já existentes (17
  tarefas em andamento; TASK-080 sem handoff).
- Mutação (revertida): sem os 9 eixos de aresta no SAT, 2 testes de `obb.test.ts` falham; com
  `rotY(-rotationYDeg)` nos obstáculos, 3 de `objectCollisions.test.ts` falham; com a caixa envolvente
  no tandem, o teste do galpão falha.
- Sondas da auditoria rodadas antes/depois: monte sob a viga 0 → 1,5 m; carga do tandem no galpão
  `['obstacle']` → `[]`; carga do 1 na lança do 2: 1,18 m de penetração, agora bloqueada pela cena.

## Tempo da avaliação de colisão

Mesmo cenário da auditoria (30 objetos, 210 caixas, 10 montes, carga 12 × 3 × 3, 430 avaliações),
rodado 3 vezes alternando antes e depois, com a máquina dividida com outras frentes (ruído grande):
antes 0,44 / 0,69 / 0,64 ms por avaliação, depois 0,29 / 0,55 / 0,30 ms (a auditoria mediu 0,31 ms).
Com a cadeia na conta, medianas de 0,33–0,43 ms antes e 0,30–0,54 ms depois. Cruzamento entre dois
guindastes com carga, gancho e cadeia: 0,008 → 0,04 ms. Mesma ordem de grandeza.

## Decisões (ADR-044, Proposto)

- Cabo contra a lança de outro guindaste **bloqueia** (contra obstáculo segue só alerta, ADR-028).
- Larguras FICTÍCIAS: cadeia 0,3 m, cabo 0,1 m. Cadeia e gancho não testam a lança de onde pendem.
- Carga contra carga de dois guindastes ficou de fora (no tandem os ganchos ficam juntos).
- Número 044 para não colidir com o ADR-043 da TASK-096; o índice `docs/decisions/README.md` não foi
  mexido (fica para quem integrar, como no ADR-028).

## O que NÃO foi feito

- `HookLoad.ts` intocado: com moitão na cadeia (`replacesHook`), a amarração lida ainda é a do gancho
  escondido (F-09); a caixa da cadeia fica certa quando a TASK-093 corrigir os getters.
- `cargoBaseY` (carga no chão) segue com 9 pontos: sobre um monte estreito no meio da pegada, a carga
  pendurada para no monte e "Soltar" pode dizer que está no ar. Não alterei `docs/known-gaps.md`
  (frentes paralelas): fica para a pessoa responsável.
- E2E de `objetosReais.spec.ts`: falha anterior, não investigada (fora do escopo).

## Próximo passo

**Papel:** revisor (outra ferramenta/sessão), depois a pessoa responsável: aceitar ou não o ADR-044 e
mergear. **Ler primeiro:** este handoff, a tarefa e o ADR-044.
