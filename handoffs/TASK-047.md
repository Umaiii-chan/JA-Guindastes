# Handoff — TASK-047 — visual de manual técnico (ADR-019)

> **Tarefa em partes paralelas.** Este handoff tem uma seção por parte. `handoffs/current.md` **não**
> foi editado. A parte "Telas" não tocou `frontend/src/three/**`, `backend/**`, ADRs nem
> `docs/business-rules.md`, e não leu `dados-oficiais/`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-27 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-047-visual-manual-tecnico.md` |
| **Etapa concluída** | implementação da parte "Telas" (CA-1, CA-2, CA-3, CA-4, CA-6, CA-7 e CA-8 nas páginas Início e Simulador) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-047-visual-telas`, a partir de `6f86fff` |

---

## Telas (tokens, componentes, casca, identidade, Início e Simulador)

### 1. O que foi feito

- **Fontes (CA-1):** saem `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono`;
  entram `@fontsource-variable/ibm-plex-sans` (um arquivo com os eixos de peso e largura, 65 kB, para
  o wordmark condensado) e `@fontsource/ibm-plex-mono` (só 400 e 500, 15 kB cada). A família da mono
  é registrada como **`'IBM Plex Mono'`**, o nome que os rótulos da cena usam. `font-synthesis-weight:
  none` evita negrito falso na mono.
- **Tokens (CA-1):** `src/presentation/theme/tokens.css` com a paleta do ADR-019 (papel `#F4F1EA`,
  folha `#FBFAF6`, tinta `#1F1F1C`, tinta 2 `#5C5A53`, linha `#CFCAB9`, acento `#D9480F`, situação
  `#2F6B3A` / `#B42318` / `#B7791F` / `#77756D`), raios de no máximo 2 px, sem sombras (só um
  deslocamento seco em tinta nas sobreposições), movimento curto e sem elasticidade. Os nomes antigos
  (`--color-surface-*`, `--color-text-*`) continuam, agora em papel e tinta.
- **Componentes (CA-2):** `Panel` virou folha com carimbo (`stamp`); `Button` primário em laranja,
  secundário em contorno de 1 px, hover sublinhado ou 1 px acima; `Gauge` virou **régua linear
  graduada** (0–100 %, marcas a cada 10 %, zona de "excede" em vermelho acima de 100 %); `Stepper`
  virou procedimento 01/02/03 com traço vertical e check em tinta; `Slider` virou escala graduada;
  `Tabs`, `Table`, `Field`, `Dialog`, `Drawer`, `Toast`, `Badge`, `Notice`, `EmptyState`,
  `Dropzone`, `Skeleton` e `IconButton` em linha fina e cantos retos. A API pública continua: `icon` e
  `variant` do `Panel`, `icon` do `Slider` e do `StepItem`, `size` do `Gauge` e `variant="glass"` do
  `IconButton` seguem aceitos (marcados `@deprecated`).
- **Identidade (CA-6):** `layout/Wordmark.tsx` ("TABELA DE CARGA" condensado e bold, "SIMULADOR"
  espaçado), `layout/BrandMark.tsx` (triângulo de lança sobre a base, em `currentColor`) e
  `public/favicon.svg` com o mesmo desenho. Sai o nome "JA Guindastes" da casca e do login. Nenhuma
  marca real.
- **Casca:** trilho como índice numerado (01–04, A1; recolhido mostra só os números), barra superior
  como carimbo de prancha (número, título, FOLHA 02/04, REV. 0.1). `navigation.ts` ganhou `sheet`
  no lugar de `icon`.
- **Início (CA-3):** folha em grade 8/4. Coluna larga arejada: abertura em duas colunas, Fig. 1 cotada
  (R, θ, L) com o carimbo inclinado "FICTÍCIO" e o índice do manual (1.0, 2.0, 3.0 com "Fl. 02").
  Coluna estreita densa: resumo do catálogo em tabela com filetes e as notas de rodapé numeradas
  (dados FICTÍCIOS, estratégia PROVISÓRIA, o backend decide).
- **Simulador (CA-4):** colunas, nada flutua. Coluna de procedimento à esquerda; à direita a prancha:
  faixa de título (vista 3D, conexão, vistas da câmera como texto), quadro de papel `#F4F1EA` com
  filete interno e esquadros de canto, e no pé a ficha do resultado (utilização em mono grande ao lado
  da régua, valores em tabela, notas com o carimbo PROVISÓRIO) e a geometria de pré-visualização. Em
  telas baixas (< 800 px) a ficha rola por dentro.
- **Login, 404 e 403:** folha de acesso sobre papel milimetrado (SVG, sem degradê); 404 e 403 como
  folhas com carimbo.
- **Testes (CA-1, CA-7):** `tests/presentation/theme/noGradients.test.ts` (nenhum `linear-gradient`,
  `radial-gradient`, `conic-gradient`, `backdrop-filter` nem degradê SVG em `src/`, fora de
  `src/three/**`) e `tests/presentation/theme/contrast.test.ts` (paleta exata do ADR-019; texto ≥ 4,5:1
  e elementos gráficos ≥ 3:1, lidos do `tokens.css`).
- **Capturas (CA-8), em 1440×900 e 1280×720:** `docs/assets/screenshots/inicio-1440x900.png`,
  `inicio-1280x720.png`, `simulador-1440x900.png`, `simulador-1280x720.png`,
  `simulador-inicio-1440x900.png` e `simulador-acima-da-capacidade-1440x900.png`. As do simulador
  foram feitas com a cena clara da parte "Cena 3D" (os arquivos de `src/three/**` da branch
  `task/TASK-047-visual-manual-tecnico` trazidos só para o build das capturas e devolvidos em seguida;
  nada foi mesclado nem commitado deles aqui).

### 2. Decisões

1. **Duas cores do ADR-019 ganham variante para texto:** o laranja `#D9480F` tem 3,8:1 sobre o papel
   (passa para foco e marcas, não para texto pequeno), então texto e o preenchimento do botão primário
   usam `--color-accent-ink` `#B93D0C` (5,4:1; papel sobre ele, 5,6:1). O âmbar e o cinza de situação
   usam `--color-status-warning-text` `#8A5A12` e a tinta 2 como texto.
2. **Laranja só na ação primária, foco, seleção e passo atual.** Tabelas de carga, selos "info" e o
   diagrama de zonas saíram do acento para densidades de tinta; a zona atual continua em laranja.
3. **Primário desabilitado perde o laranja** (papel e tinta 2): o acento não marca o que não se pode
   fazer.
4. **Vistas da câmera como texto** ("Perspectiva", "Lateral", "Topo", "Operador"), com o nome
   acessível completo ("Câmera lateral") contendo o texto à vista.
5. **Revisão do carimbo = versão da aplicação (0.1)**, para não inventar número de revisão.

### 3. Comandos executados

| Comando (em `frontend/`) | Resultado |
|--------------------------|-----------|
| `npm ci` | ✅ `found 0 vulnerabilities` |
| `npm run lint` | ✅ sem saída |
| `npm run format:check` | ✅ `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ sem saída |
| `npm test` | ✅ `Test Files 67 passed (67)` · `Tests 690 passed \| 1 skipped (691)` |
| `npm run build` | ✅ `built in 761ms`; CSS 95,7 kB (17,1 kB gzip); fontes 65,5 + 14,7 + 14,9 kB |
| `E2E_BASE_URL=http://127.0.0.1:5253 npm run e2e` | ✅ `11 passed` · `11 skipped` (os que exigem `E2E_BACKEND=1`) |
| `bash scripts/check-structure.sh` (raiz) | ✅ `OK: 0 erros, 1 aviso(s)` (tarefas paralelas) |

O E2E rodou contra um `vite preview` (porta 5253) com uma config temporária fora do repositório, com
o `/api` apontando para uma porta fechada: há um backend Docker da pessoa responsável em
`localhost:8000`, que não foi tocado. Servidores abertos (5251, 5252, 5253) foram encerrados; a 5173
não foi usada.

### 4. Arquivos fora da parte "Telas" que foram mexidos

Antes da divisão do escopo com o segundo agente, os commits `20a449e`–`2af1217` também mexeram em
arquivos que agora são dele: `presentation/catalog/{CatalogColumn.tsx, ConfigurationDetail.tsx,
catalog.module.css, RotationZoneDiagram.module.css}`, `presentation/tables/{ChartImportPanel.tsx,
VersionTimeline.tsx, LoadChartMatrix.module.css, tables.module.css}`,
`presentation/users/UserFormDrawer.module.css` e `pages/{CatalogPage.tsx, TablesPage.tsx,
UsersPage.tsx, UsersPage.module.css}` (troca de `icon` por `stamp` no `Panel`, filetes, escala de
tinta na matriz). Depois do aviso, nada mais nesses arquivos.

### 5. Próximo passo

**Papel:** integração (sessão principal), depois Revisor.

1. Mesclar esta branch com a da cena e a do segundo agente. Conflitos esperados só se o segundo agente
   também mexer nos arquivos listados em § 4.
2. Na integração, acrescentar ao `contrast.test.ts` a comparação com `PAPER_INK` e `STATUS_COLORS` de
   `src/three/scene/palette.ts` (nesta branch o `palette.ts` ainda é o escuro).
3. `docs/architecture.md`, `development-guide.md` e `known-gaps.md` não foram tocados: registrar o
   ADR-019 como visual vigente na consolidação.

---

## Cena 3D

Branches `task/TASK-047-visual-cena` e `task/TASK-047-visual-cena-2`, integradas pela sessão principal.
Só mexem em `src/three/**` e `tests/three/**`; a API do `CraneViewport` não mudou.

- **Ambiente** (`addEnvironment.ts`):
  - saíram o domo do céu, a névoa e o `sky`;
  - fundo e chão em papel `#f4f1ea`: o chão é `MeshBasicMaterial` sem tone mapping, e um `ShadowMaterial` recebe a sombra;
  - grade milimetrada (1 m `#cfcab9`, 5 m `#b3ac98`) que acompanha a câmera e vai até perto do horizonte;
  - eixos em traço e ponto.
- **Luz:** `NeutralToneMapping` no lugar do ACES. Hemisférica 0xffffff/0xe6e0d2 a 1,5; sol a 2,1 com sombra PCF 2048² e raio 5; preenchimento a 0,6. Sombra de tinta com opacidade 0,14.
- **Paleta** (`palette.ts`):
  - `PAPER_INK` novo;
  - `STATUS_COLORS` igual ao ADR-019;
  - `SCENE_COLORS`: carga `#e2dccd` e linha de 5 m `#b3ac98`, os dois únicos valores fora dos tokens;
  - `statusCssColor` e `toCssHex` com a mesma assinatura.
- **Anel e zonas:**
  - anel de 0,1 m na cor da situação;
  - linha radial e arcos de alcance tracejados em tinta;
  - setores com preenchimento de 0,02 (0,05 na zona atual) e arco de 0,55 (1 na atual), com a zona atual em laranja;
  - halo com mistura normal, sem aditiva.
- **Rótulos** (`sceneLabels.ts`): cota em Plex Mono (`LABEL_FONT_FAMILY = 'IBM Plex Mono'`) com sublinhado e linha de chamada. A zona atual tem sublinhado laranja e texto em tinta, porque o laranja em 10 px não passa no AA. `data-scene-label`, `data-active` e o texto continuam iguais.
- **Enquadramento** (`cameraPresets.ts`):
  - `fitDistance`/`fitCentered` pelo FOV e pela proporção;
  - o conjunto enquadrado é o chassi, o anel, a ponta da lança e o gancho;
  - perspectiva a 13° de inclinação e 40° de azimute; quadros em coluna (proporção < 1,1) sobem até +17°;
  - ao redimensionar, reenquadra enquanto a pessoa não mexe na órbita;
  - em 16:9, o anel ocupa cerca de 50 % da largura, porque a lança limita; a constante `PERSPECTIVE_FILL` controla isso.
- **Escala gráfica** (`scaleBar.ts`): 5 m no canto inferior esquerdo, medida no alvo da órbita; troca para 2 m ou 20 m fora de 40 a 220 px.
- **Constante aproximada:** `CARRIER_FOOTPRINT`, medida no GLB. Se o modelo trocar, é preciso rever.
- **Capturas:** `docs/assets/screenshots/cena-3d/*` em 1280×720 e `-900x900`.

### Verificação na integração (sessão principal)

- **Frontend na branch integrada:** lint, format, typecheck e build passaram; `npm test` deu 710 passed e 1 skipped.
- **E2E completo com backend real:** stack do Docker Compose com a imagem do frontend reconstruída desta branch, `E2E_BACKEND=1`, admin local e seed FICTÍCIO. Resultado: **21 passed, 1 skipped**.

## Refinamento de Catálogo, Tabelas e Usuários (branch `task/TASK-047-visual-paginas`, PR seguinte ao #43)

- **Catálogo:**
  - índice de fichas em colunas de 0,95, 0,8 e 1,3 fr, com o número de ordem por contador CSS, "QTD. 03" e o selecionado com traço laranja;
  - a ficha é uma folha de especificações com carimbo "FICHA / Rev." e a figura cotada `catalog/PivotFigure.tsx` (a e h, sem escala, `aria-hidden`);
  - `RotationZoneDiagram` como transferidor (marcas a cada 10°, hachura, só a zona destacada em laranja), com as props `legend` e `activeCode`.
- **Tabelas:**
  - duas colunas: seleção e importação na estreita; registro de revisões, relatório de erros e matriz na larga;
  - o relatório de erros é renderizado pela `TablesPage`, com o mesmo dado;
  - o registro continua `<ol>`/`<li>`, e a ativa leva o carimbo "EM VIGOR";
  - sem coluna DATA, porque a listagem não expõe a data de importação (P-020: ordem por versão);
  - matriz como tabela impressa, com mapa de calor em cinza-quente e legenda;
  - ativação no estilo de ordem de alteração.
- **Usuários:** tabela densa com a coluna Nº e sem avatar; selo ADMIN/OPERADOR; quadro "Perfis de acesso" só de leitura; Drawer em linhas.
- **Dependência frágil de estrutura:**
  - `tables.module.css` usa `.importBody .dropzone > button` (o botão como filho direto do `Dropzone`);
  - `.form .row > :first-child` supõe que o rótulo é o primeiro filho do `Field`;
  - quem mudar a estrutura desses componentes precisa rever os dois estilos.
- **Capturas novas:** `catalogo-1440x900`, `catalogo-ficha-zonas-1440x900`, `tabelas-1440x900`, `tabelas-ativacao-1440x900`, `tabelas-relatorio-de-erros-1440x900` e `usuarios-1440x900`. Também `zonas/catalogo-editor-zonas*.png` refeitas.
- **Gates do agente:** 710 testes passaram e 1 foi pulado; E2E sem backend com 11 passados e 11 pulados; nenhum teste mudou.
