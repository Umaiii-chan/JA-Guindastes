# Handoff — TASK-104 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-104-ajustes-da-nova-tela.md` |
| **Etapa concluída** | implementação (com testes e capturas) |
| **Papel exercido** | Implementador (e testes). Revisão fica para outra sessão/ferramenta (AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code, worktree `C:\dev\JA-Guindastes-wt\pend-tela` |
| **Branch** | `task/TASK-104-ajustes-da-nova-tela`, de `anderson/development` @ `13da390` |

## 1. Objetivo

Pendências da TASK-095 (faixa de execução do planejamento, enquadramento da câmera) e achados da
revisão pós-merge do PR #54. Desenho no [ADR-048](../docs/decisions/ADR-048-faixa-de-execucao-e-enquadramento-na-area-livre.md) (Proposto).

## 2. O que foi feito

- **Faixa de execução** (`PlanningPanel.tsx`, `layout/runStrip.ts`, `SimulatorPage`): portal para um
  alvo acima da barra de comando; trajetória rodando (Parar, fase, progresso, velocidade) ou passo a
  passo ativo (próxima ação e botões), com a folha fechada. A lógica segue em `PlanningSection` e
  `usePlanPlayback` (não alterados). Com a faixa ativa o painel não repete "Parar", a barra e o passo
  a passo (sem nomes duplicados); fora do simulador tudo fica no painel como antes.
- **Enquadramento** (`cameraPresets.ts`: `freeFrame`; `mountCraneScene.ts`: `setFrameInsets`;
  `ui/frameInsets.ts`; `CraneViewport`): a página mede barra de ferramentas, cartão de resultado,
  linha do topo e faixa de baixo; a cena enquadra com a proporção e o campo de visão da área livre e
  desloca a imagem com `camera.setViewOffset`. `CraneViewport` não mudou de lugar.
- **Sliders compactos**: mín./máx. aparecem ao passar o mouse ou focar (flutuantes, `aria-hidden`);
  a observação (ex.: cabo máximo FICTÍCIO) virou botão `*` focável com `aria-describedby`, e o texto
  aparece no hover do botão e no foco do controle.
- **Ordem de foco**: bloco `.top` (chip e barra de vistas) agora antes da barra de ferramentas no DOM.
- **Janela e tela cheia**: o alvo do portal fica no palco enquanto houver janela aberta ao sair da
  tela cheia (não remonta, não perde o texto); `useModal` refaz o foco se o alvo mudar.
- **Conexão compacta**: um ícone por estado (Lucide) e "atualizando…" visível.
- **Selo do resultado**: `ResultSeal` (situação e risco de tombamento) fora do `.hideable`, só
  aparece com "Ocultar painéis". Mapas de cor/texto foram para `panels/evaluationPresentation.ts`.
- **Atalhos 1–4 de câmera (WCAG 2.1.4)**: registrados aqui; não mudam. São teclas de caractere
  únicas, ativas só fora de campos de texto e sem janela modal; o mesmo comando existe nos botões da
  barra de vistas. Pendência: se a pessoa responsável quiser, oferecer desligar ou remapear os atalhos.

## 3. Arquivos modificados

`git diff --stat anderson/development...HEAD`: ver o PR. Nada em `backend/`, `frontend/src/domain/cargo`
nem `e2e/tests/objetosReais.spec.ts`.

## 4. Comandos executados e resultados (em `frontend/`)

| Comando | Resultado | Saída (resumo) |
|---|---|---|
| `npm ci` | ✅ | instalado |
| `npm run lint` | ✅ | `eslint .` sem erros |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `135 passed`, `1208 passed, 1 skipped` |
| `npm run build` | ✅ | `built in 583ms` (aviso de chunk já existente) |
| `E2E_PREVIEW_PORT=5396 npx playwright test e2e/tests/scene.spec.ts` | ✅ | `7 passed (34.2s)` |
| Outros E2E | NÃO EXECUTADOS | pedido de rodar no máximo um arquivo |
| E2E com backend / execução real de trajetória | NÃO EXECUTADO | sem backend; a faixa foi coberta só por teste de componente |

Testes novos: `tests/presentation/simulator/planningRunStrip.test.tsx`,
`tests/presentation/simulator/leituraDaTela.test.tsx` e o bloco "área livre do quadro" em
`tests/three/camera/cameraPresets.test.ts` (projeta os pontos numa `PerspectiveCamera` real com o
view offset e confere que ficam dentro da área livre).

## 5. Capturas (1366×768, Playwright, sem backend)

`docs/assets/screenshots/task-104-{antes,depois}-1366x768-{perspectiva,lateral,topo,operador}.png`,
mais `task-104-depois-1366x768-limites-slider.png` e `…-paineis-ocultos.png`. "Antes" é a
`development` @ `13da390`. Não há captura da faixa de execução (exige backend para planejar).

## 6. Decisões

- Portal em vez de levantar o estado para a página: a lógica não sai do `PlanningPanel`.
- View offset em vez de mexer no tamanho do canvas: não remonta nem redimensiona a cena.
- Folga de 20 px no topo (cabeça da lança) e 8 px nos outros lados.
- ADR-048 (o 047 é da TASK-103).

## 7. Não foi feito / limites

- Folhas abertas não entram na área livre (passageiras): a lança pode ficar sob a folha aberta.
- O fim do enquadramento no Topo usa o alcance máximo, como antes (o guindaste fica pequeno).
- Faixa de execução não verificada com trajetória real (ver § 4).

## 8. Pendências / decisões

| # | Pergunta | Bloqueia? |
|---|----------|-----------|
| 1 | Aceitar o ADR-048 | não |
| 2 | Atalhos 1–4: manter como estão ou permitir desligar/remapear (WCAG 2.1.4)? | não |

## 10. Próximo passo

**Papel:** Revisor. Ler primeiro: este handoff, ADR-048, `PlanningPanel.tsx`, `SimulatorPage.tsx`,
`cameraPresets.ts` (`freeFrame`).
