# ADR-048 — faixa de execução do planejamento e enquadramento da câmera na área livre

| Campo                  | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| **Status**             | Proposto                                                   |
| **Data**               | 2026-10-17                                                 |
| **Autor**              | agente Claude Code, implementador da TASK-104              |
| **Decisores**          | Anderson Sehnem                                            |
| **Tarefa relacionada** | TASK-104                                                   |
| **Complementa**        | ADR-045 (segue Proposto/Aceito como está), ADR-041         |

## Contexto

O ADR-045 pôs os painéis sobre a cena. Ficaram duas pendências (handoff da TASK-095): a execução da
trajetória e o passo a passo continuavam dentro da folha "Planejar", e as vistas da câmera enquadravam
o quadro inteiro, sem descontar os painéis (a lança saía pelo topo).

## Decisão

1. **Faixa de execução.** Com a trajetória rodando ou o passo a passo ativo, o `PlanningPanel` monta,
   por portal, uma faixa compacta no alvo `RunStripTargetContext` (acima da barra de comando), mesmo
   com a folha fechada: fase, progresso, velocidade e Parar; no passo a passo, a próxima ação e os
   botões. O estado e a lógica seguem em `PlanningSection`/`usePlanPlayback`. Sem o alvo (fora do
   simulador) tudo fica no painel como antes. Os nomes acessíveis são os mesmos e não se repetem
   enquanto a faixa está ativa.
2. **Área livre.** A página mede o que os painéis fixos cobrem (barra de ferramentas, cartão de
   resultado, linha do topo e faixa de baixo) e publica as margens em `FrameInsetsContext`; o
   `CraneViewport` as repassa à cena (`setFrameInsets`). As predefinições passam a enquadrar com a
   proporção e o campo de visão da área livre, e a câmera desloca a imagem (`setViewOffset`) para o
   centro do guindaste cair no centro dela. O tamanho do quadro não muda e o `CraneViewport` não muda
   de lugar. Com "Ocultar painéis", as margens são zero. Folhas abertas não contam (são passageiras).

## Consequências

- Sem dependência nova. `freeFrame` (`cameraPresets.ts`) é puro e testado, inclusive com a projeção de
  uma câmera Three.js real.
- Picking e rótulos CSS2D seguem corretos (usam a matriz de projeção, que inclui o deslocamento).
- A faixa de execução aumenta a faixa de baixo; a câmera se reenquadra sozinha (a faixa entra na medida).
