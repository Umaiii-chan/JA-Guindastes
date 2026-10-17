# Handoff — TASK-103 (carga na carroceria: textos e acompanhar o caminhão)

- **Agente/papel:** Claude Code (Sonnet), implementador. Sem revisão independente ainda.

## O que foi feito
- Textos: `cargoGuidance.ts` ("rente ao apoio (chão ou carroceria)"; "baixe-a até 0,20 m do apoio, no
  chão ou na carroceria") e `SimulatorRoute.tsx` ("baixe-a até perto do chão ou da carroceria"). Os
  textos do tandem (só chão) ficaram como estavam. "Toque em Soltar" e o botão "Soltar" não mudaram.
- Acompanhar o caminhão: `domain/cargo/cargoFollow.ts` (`followLoadBed`), chamado por
  `three/scene/CargoOperation.ts#setScenario` quando só os obstáculos mudam. `loadBeds.ts` ganhou
  `loadBedUnder` (a carroceria mais alta sob a pegada; `loadBedTopUnder` passou a usá-la).
- ADR-047 (Proposto) e TASK-103.

## Acréscimo da revisão do PR #55 (Coruja)
- **Carga que flutua:** `loadBeds.ts` (`pointInRect`, `loadBedUnder(center, …)`): a carga só se apoia
  na carroceria se o **centro da pegada** cai no retângulo girado dela (borda conta); senão, terreno.
  `cargoOperation.ts` ganhou `cargoSupport` ({ baseY, onBed }); `cargoBaseY` o usa. O critério (igual
  ao do backend, TASK-102) está no ADR-046 (Proposto, editado). `rectsOverlap` saiu.
- **Colisão da carga solta:** `Obstacle.baseElevationM` (opcional, só a carga sobre carroceria; não vem
  do editor) e `obstacleObb` o soma; `groundObstacle` (agora exportada) usa base na carroceria e
  altura só da carga quando `onBed`. Teste sem WebGL: `tests/three/scene/cargoOnTruckBed.test.ts`.
- Textos 'do apoio': já feitos no primeiro commit.

## Opção escolhida (e por quê)
**Acompanhar**, não só reassentar. Era pequeno: a altura já é recalculada a cada desenho
(`cargoBaseY`), então só faltava a transformação rígida de x, z e giro em relação ao centro do
caminhão. Caminhão removido ou trocado por outro modelo: a carga fica onde está e reassenta no apoio
do lugar. O afastamento do centro acompanha a escala (largura/profundidade) do mesmo modelo.

## Verificação (saída real, em `frontend/`)
- `npm ci`: ok. `npm run lint`, `npm run format:check`, `npm run typecheck`: sem erros.
- `npm test`: 133 arquivos, 1199 passam, 1 ignorado (antes do teste de textos; o arquivo novo
  `cargoGuidance.test.ts` passa sozinho, 7 testes).
- `npm run build`: ok (só o aviso de chunk grande).
- `E2E_PREVIEW_PORT=5395 npx playwright test e2e/tests/cargoDelivery.spec.ts`: 1 passed (2,1 min).

## Pendências
- Sem teste de cena (Three.js) para `setScenario` com caminhão movido: o domínio está coberto, a
  ligação é uma chamada.
- Outros objetos de topo plano seguem sem receber carga (ADR-046).
