# Handoff — TASK-112 — e2e da entrega

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-17 |
| **Tarefa** | `tasks/in-progress/TASK-112-e2e-entrega-defasado.md` |
| **Papel exercido** | Implementador |
| **Branch** | `task/TASK-112-e2e-entrega-defasado` (base `anderson/development` @ `65e3784`) |

## Suíte E2E local sem backend, na `development` pura (antes da correção)

Passam: auth (modo sem autenticação), collision (2), loadChartImport (navegador), objetosReais, outriggers,
rotationZones (navegador, 2), scene (7), simulatorEvaluation (navegador), tipoDeCarga (2). **Falha: só
`cargoDelivery`** (Engatar desabilitado). Pulados (exigem backend): auth com servidor (4), catalogEdit (2),
evaluation (2), loadChartImport com backend, rotationZones com backend (2). Dos testes de navegador pulados no
CI (outriggers, rotationZones, simulatorEvaluation), todos passam localmente.

## O que mudou (`frontend/e2e/tests/cargoDelivery.spec.ts`)

- Engate: desce o cabo de 0,2 em 0,2 m até o Engatar liberar (a janela é de −0,1 a +0,5 m em torno da
  altura das lingas) e confere a dica "Toque em Engatar".
- Engatada com a folga do engate, a base fica ~0,4 m acima do chão: a dica agora é "Carga engatada: leve a
  carga até o ponto de entrega…" e o Soltar fica desabilitado (antes: "Toque em Soltar"). Assertiva trocada pela
  real e reforçada com o Soltar desabilitado.
- Sem `test.skip(hasBackend)`: com a stack, o navegador avalia por WebSocket, então o spec responde ao
  WebSocket (`routeWebSocket`) além do REST.

## Verificação

`playwright cargoDelivery`: passa sem backend (vite preview) e com a stack Docker (`E2E_BACKEND=1`, projeto
`e2e112`, derrubado). Suíte completa com a stack: 26 passam, 3 pulados (os de navegador, por design). `vitest`
1355, `tsc`, `eslint`, `prettier`, `check-structure` OK.

## CI: o spec estourou os 180 s (run 39054530944) e foi encurtado

No runner o `cargoDelivery` (agora sem skip) levou >180 s e morreu num `fill` do segundo `approach()`: não era
campo ausente, era lentidão (cada passo é um comando na cena e uma avaliação; no runner as telas interativas
levam de 2,2× a 4× o tempo local). Local, com a stack: 72 s. Correção sem tocar timeout nem asserção: a entrega
é a imagem espelhada da carga, então a segunda aproximação usa o giro oposto e a mesma lança com um só refino
(antes repetia a busca inteira), e o refino ficou menor (giro ±3, lança ±0,6, 2 rodadas na primeira). Local com
a stack no modo do CI (`npm run e2e`): 35 s; estimativa no runner 77 a 140 s, abaixo dos 180 s.
