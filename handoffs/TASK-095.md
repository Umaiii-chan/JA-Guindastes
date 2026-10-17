# Handoff — TASK-095 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-095-tela-simulador.md` |
| **Etapa concluída** | implementação (com testes e capturas) |
| **Papel exercido** | Implementador, com olho de designer de interface; escreveu também os testes (Engenheiro de testes). A revisão fica para outra sessão/ferramenta (AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), worktree `C:\dev\JA-Guindastes-wt\tela` |
| **Branch** | `task/TASK-095-tela-simulador`, de `anderson/development` @ `784a9e1`, com merge de `anderson/development` @ `d493879` |

## 1. Objetivo

Pedido da pessoa responsável: menus do simulador mais simples, sem remover nada, e a cena (canvas)
como prioridade, ocupando o máximo da tela. Desenho no
[ADR-045](../docs/decisions/ADR-045-tela-do-simulador-com-a-cena-como-prioridade.md) (Proposto).

## 2. O que foi feito

- **Palco inteiro** (`SimulatorPage.tsx` + `.module.css`): a cena fica atrás de tudo e os painéis
  flutuam numa grade (`.hud`, camada `--z-overlay-panel`) que não pega o mouse entre eles. O
  `CraneViewport` não mudou de lugar na árvore.
- **Trilho recolhido no simulador** (`AppShell.tsx`): páginas `fullBleed` começam com o trilho em
  64 px, com a preferência à parte em `ja-guindastes.rail-collapsed.stage`.
- **Componentes de layout novos** em `frontend/src/presentation/simulator/layout/`:
  `SimulatorToolbar` (barra vertical), `SimulatorSheet` (folha não modal que fica `hidden` quando
  fechada), `ContextChip`, `ResultCard`, e os contextos `sheetContext` (painel sabe que está numa
  folha e quando ela abre), `simulatorLayout` (abrir uma folha de fora dela) e `resultDetails`.
- **Folhas que escondem sem desmontar (F-20)**: Configurar, Acessórios, Ambiente, Tandem, Planejar e
  Gravações salvas. `CollapsibleSection`, `GuidedStepsPanel` e `AccessoryPanel` detectam a folha e
  deixam o título com ela (sem repetir "Acessórios de içamento"); o `onOpen` do Ambiente (recarregar
  cenários) passou a rodar quando a folha abre. Com passos 01/02 pendentes, Configurar abre sozinha.
- **Cartão de resultado** (`BackendEvaluationPanel.tsx` reorganizado): primeiro nível com situação,
  régua (`Gauge compact`), capacidade, peso comparado, raio, risco de tombamento, "avaliado", os
  motivos do "não avaliável" e o alerta mais grave; **Detalhes** (no HTML mesmo fechado) com a conta
  do peso, zona, limite e capacidade efetiva, todos os alertas e a consulta; a geometria e o
  relatório entram no fim do cartão. `TandemHud` ganhou o mesmo botão.
- **Barra de comando**: `CraneControlPanel variant="bar"` (sliders compactos com rótulo curto à vista —
  Giro, Inclinação, Lança, Cabo — e o nome completo como nome acessível), seletor de guindaste,
  `OutriggerQuickControl` (estado alcançado das patolas e "Apoiar e nivelar"; o botão de estado abre o
  passo Posição) e `RecordingControls` (Gravar/Parar; nome e Salvar abrem por cima da barra).
- **Gravação em três partes** (`RecordingPanel.tsx`): `RecordingControls`, `RecordingLibrary` (folha;
  carrega a lista quando a folha abre, como antes no primeiro clique) e `RecordingPlayer` (faixa
  sobre a cena).
- **Coleta e entrega** numa linha logo acima da barra de comando (desvio do desenho proposto, que a
  punha no topo: a dica "faltam X m" e Engatar/Soltar ficam junto dos controles). Editor 3D e
  colisões no topo, no meio.
- **Barra de vistas**: `ConnectionStatusBar compact` (conexão como ponto, texto para leitor de tela),
  `CameraPresetButtons shortcuts` (teclas 1–4, fora de campos e sem janela modal), área de operação,
  editar ambiente, assistente, **Ocultar painéis** (substitui "Ocultar painel") e Tela cheia.
- **Tela cheia (F-21)**: `ui/portalTarget.ts` (`PortalTargetContext`); `Dialog` e `Drawer` montam o
  portal no alvo do contexto; o simulador passa o palco enquanto a tela cheia está ligada. A janela
  "Adicionar guindaste" passou a ser montada dentro do palco (prop `dialogs`).
- **Escala gráfica** da cena sobe para cima da faixa de baixo (`--hud-bottom` medido por
  `ResizeObserver`).
- **Ajuda** (`HelpButton.tsx`): textos da barra de comando, das folhas, de "Ocultar painéis" e dos
  atalhos 1–4.
- **Docs**: ADR-045 (Proposto) e índice; `docs/architecture.md` (componentes); `docs/demo.md` § 5
  (onde ficam controles e resultado; tirei a frase da marca "PROVISÓRIO", que a tela não mostra desde
  a TASK-062).

### Onde ficou cada painel

| Antes | Depois |
|---|---|
| Coluna: Simulação guiada 01–03 | Folha **Configurar** (abre sozinha com passos pendentes) + chip "Operação" no topo |
| Passo 03: sliders do guindaste | **Barra de comando** embaixo (sempre à vista) |
| Passo 03: nota dos limites | Passo 03 (`CraneControlNotice`) |
| Passo 03: Patolas | Passo 03 (inteiro) + estado e "Apoiar e nivelar" na barra de comando |
| Passo 03: seletor de guindaste e nota do tandem | Barra de comando |
| Coluna: Içamento com dois guindastes | Folha **Tandem** |
| Coluna: Planejar operação | Folha **Planejar** (marca de execução no botão) |
| Coluna: Acessórios de içamento | Folha **Acessórios** |
| Coluna: Ambiente | Folha **Ambiente** |
| Faixa de título: conexão, vistas, área, editar, assistente, ocultar painel, tela cheia | **Barra de vistas** no topo à direita (conexão como ponto; "Ocultar painéis") |
| Faixa de gravação: Gravar/Parar/Salvar | Barra de comando |
| Faixa de gravação: Gravações salvas | Folha **Gravações** |
| Faixa de gravação: player | Faixa sobre a cena, acima da barra de comando |
| Faixa do editor do ambiente | Faixa no topo, no meio |
| Faixa de coleta e entrega | Linha acima da barra de comando |
| Aviso de colisão (pé da cena) | Topo, no meio (só com aviso) |
| Ficha do resultado (pé, 222 px) | **Cartão** no canto superior direito; "Detalhes" no próprio cartão |
| Geometria e relatório (pé, à direita) | "Detalhes" do cartão |

### Medidas do canvas (Playwright, `getBoundingClientRect`, sem backend)

| Tela | Antes | Depois | Área útil abaixo da barra superior, depois |
|---|---|---|---|
| 1280×720 | 834×301 (27,3 %) | 1216×664 (87,6 %) | 95,0 % |
| 1366×768 | 752×349 (25,0 %) | 1302×712 (88,4 %) | 95,3 % |
| 1920×1080 | 1306×635 (40,0 %) | 1856×1024 (91,7 %) | 96,7 % |

Sem rolagem horizontal nos três tamanhos (antes e depois). A medida não muda com folha ou Detalhes
abertos (os painéis ficam por cima).

### Capturas

`docs/assets/screenshots/task-095-antes-<tela>-{fechado,configurar,detalhes}.png` e
`task-095-depois-<tela>-{fechado,configurar,detalhes}.png`, para 1280x720, 1366x768 e 1920x1080; e
`task-095-depois-1280x720-{editor,folha-planejar,tela-cheia-janela}.png` (comprimidas em PNG de paleta com o `sharp`). Catálogo e avaliação
respondidos no navegador (dados de exemplo, sem backend). "Antes" usa `development` @ `784a9e1`.

## 3. Arquivos modificados

`git diff --stat anderson/development...HEAD` (resumo): 54 arquivos de código, testes e docs, mais
21 capturas. Novos: `frontend/src/presentation/simulator/layout/*`,
`frontend/src/presentation/simulator/OutriggerQuickControl.*`, `frontend/src/presentation/ui/portalTarget.ts`,
`frontend/tests/presentation/simulator/simulatorLayout.test.tsx`, ADR-045, esta tarefa e este handoff.

Fora do escopo (justificado):
- `frontend/e2e/tests/objetosReais.spec.ts:160` — `.first()` no aviso do galpão: desde a TASK-091 o
  cabo e a lança citam o galpão ao mesmo tempo (violação de modo estrito). Na `development` @ `d493879`
  o teste nem chega lá (falha na linha 54: a peça não é colocada no quadro pequeno).

**Conflito provável com outras frentes:** `SimulatorRoute.tsx` (passo 03, slots novos `commandBar`,
`recordings`, `playback`, `dialogs`, barra de vistas), `CraneControlPanel.tsx` e `Slider.tsx`
(variantes compactas), `BackendEvaluationPanel.*` (reorganizado), `RecordingPanel.*` (dividido),
`docs/decisions/README.md` (a linha do ADR-045 foi depois da do ADR-043, porque a do ADR-044 ainda não
está no índice da `development`).

## 4. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída (resumo) |
|---|---|---|
| `npm ci` | ✅ | instalado (avisos de `npm audit` já existentes) |
| `npm run lint` | ✅ | `eslint .` sem erros |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `132 files passed`, `1180 passed, 1 skipped` (depois do merge) |
| `npm run build` | ✅ | `built` (aviso de chunk > 500 kB que já existia) |
| `npm run e2e` na base `784a9e1` | ❌ (pré-existente) | `16 passed, 11 skipped, 3 failed`: `collision:34` e `objetosReais:65` (grupo "Colisões" vazio) e `rotationZones:98` |
| `npm run e2e` nesta branch antes do merge | ❌ (as mesmas 3) | `16 passed, 11 skipped, 3 failed`, mesmas causas da base |
| `npm run e2e` depois do merge de `d493879` | ⚠️ | `18 passed, 11 skipped, 1 failed`: `objetosReais:160` (modo estrito, ver § 3) |
| `npx playwright test e2e/tests/objetosReais.spec.ts` (com o `.first()`) | ✅ | `1 passed (30.1s)` |
| `npx playwright test e2e/tests/objetosReais.spec.ts` na `development` @ `d493879` | ❌ (base) | falha na linha 54 (`Objeto … not found`) |
| Suíte E2E completa depois do `.first()` e da renumeração do ADR | ⚠️ NÃO EXECUTADO | pedido de fechar em 20 min e máquina sem memória; só o E2E alterado foi rodado de novo |
| E2E com backend (`E2E_BACKEND=1`) | ⚠️ NÃO EXECUTADO | sem Docker nesta máquina |
| `bash scripts/check-structure.sh` | ✅ depois do handoff | antes deste arquivo: 1 erro (TASK-095 sem handoff) |
| Tela cheia nativa + janela (script Playwright) | ✅ | `fullscreenElement` = palco, `contains(dialog)` = true, janela por cima |

## 5. Decisões tomadas

- Folhas escondem (`hidden`) em vez de desmontar: corrige o F-20 sem tocar no `PlanningSection`.
- Painéis sabem que estão numa folha por contexto (`useInSheet`), para o `SimulatorRoute` mudar pouco
  (tandem e ambiente seguem como estavam lá).
- Patolas ficaram no passo 03 (inteiras) + atalho na barra de comando, sem um botão "Patolas" na barra
  de ferramentas: o passo guiado continua mostrando tudo que é da posição.
- Coleta e entrega embaixo, junto da barra de comando (o desenho proposto a punha no topo).
- Rótulos curtos nos sliders da barra, com o nome completo como nome acessível (os E2E acham pelo
  nome completo).
- ADR-045 (Proposto); renumerado de 042 a pedido do coordenador (042 é da TASK-088).

## 7. O que NÃO foi feito e por quê

- **Faixa flutuante da execução/passo a passo do planejamento**: não feita para não mexer no
  `PlanningPanel`/`PlanningSection` (outra frente); a folha Planejar pode ficar aberta durante a
  execução e o botão "Planejar" ganha a marca de execução quando ela está fechada.
- Enquadramento da câmera que desconte os painéis (a lança sai pelo topo como antes): não mexi em
  `src/three/`.
- Suíte E2E completa depois dos últimos ajustes: NÃO EXECUTADA (ver § 4).
- Testes "a escrever depois" na tarefa (layout ≥ 85 % e tela cheia nativa no E2E).

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar ou não o ADR-045 (layout com a cena como prioridade) | não | | |
| 2 | Coleta e entrega embaixo (junto da barra de comando) ou no topo, como no desenho proposto? | não | | |

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois a pessoa responsável.

1. Rodar `npm run e2e` inteiro (sem backend) e conferir `objetosReais`, `cargoDelivery` e `scene`.
2. Abrir `/simulador` em 1280×720 e 1366×768 e conferir as folhas, "Detalhes" e a tela cheia.

**Ler primeiro:** `AGENTS.md`, este handoff, `docs/decisions/ADR-045-*`, `SimulatorPage.tsx`.

## 11. Como revisar

- Comece por `frontend/src/presentation/pages/SimulatorPage.tsx` e `.module.css` (grade do `.hud`).
- Mais risco: `BackendEvaluationPanel.tsx` (reorganizado; os testes de texto seguem passando porque
  os detalhes ficam no HTML) e o `RecordingPanel.tsx` dividido em três.
