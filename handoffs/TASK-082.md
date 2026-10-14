# Handoff — TASK-082 (cena mais alta)

Papel exercido: implementador (CSS/TSX), com verificação no navegador.

## O que foi feito

- `SimulatorPage.module.css`: `.result` com altura FIXA e compacta (222 px; 196 px abaixo de 800 px de
  altura); o que passar rola por dentro. Aparecer ou sumir aviso não muda a altura dela nem a da cena.
- `CollisionAlerts` saiu do fluxo: novo prop `sceneOverlay` em `SimulatorPage`, desenhado em
  `position: absolute` sobre a parte de baixo da cena (fundo semitransparente, `pointer-events` só
  nos itens).
- `BackendEvaluationPanel.module.css`: `.alertsBox` com `max-height: 56px`; sem `min-height: 88px` na
  utilização; paddings das células reduzidos.
- `SimulatorRoute.tsx`: botão "Gerar relatório de içamento" movido para a coluna da geometria.

## Medidas (getBoundingClientRect, estado "aguardando passos", dev server + backend Docker)

| Janela | Antes: canvas / .result | Depois: canvas / .result |
|---|---|---|
| 1440×900 | 377 px (42 %) / 300 px | 455 px (51 %) / 222 px |
| 1280×720 | 301 px (42 %) / 196 px | 301 px (42 %) / 196 px (rola por dentro) |
| 1920×1080 | 557 px (52 %) / 300 px | 635 px (59 %) / 222 px |

Sem rolagem horizontal nos três tamanhos.

## Verificação

- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `vitest run SimulatorRoute CollisionAlerts BackendEvaluationPanel SimulatorPage`: 21 testes passaram.
- Medida feita só no estado vazio; resultado real e alertas NÃO foram medidos.

## Pendências / riscos

- Meta de 55 % a 1440×900 não atingida: o cabeçalho da cena (abas, gravação e barra de operação)
  ocupa ~142 px. Próximo passo: compactá-lo ou dar à ficha um layout em uma só linha.
- Estabilidade (TASK-078), medida a 1440×900 com alerta real (carga de 300000 kg: "acima do limite",
  utilização 7.350 %): canvas 455 px sem alerta e com 2 ou 3 alertas; `.result` sempre 222 px (o
  conteúdo passa a 256 px e rola por dentro). O aviso de colisão foi medido com DOM simulado (não
  forcei uma colisão real): canvas 455 px com e sem o aviso, que fica sobreposto à cena.
- A 1280×720 o conteúdo (221 px) passa do teto de 196 px e rola por dentro, como antes.
- Observação do ambiente: o proxy do `vite` aponta para `localhost:8000`; nesta máquina isso resolveu
  para IPv6 e deu 502. Usei `127.0.0.1` só localmente e reverti; nada disso está no commit.
