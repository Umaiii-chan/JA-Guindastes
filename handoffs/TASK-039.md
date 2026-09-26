# Handoff — TASK-039 — implementação (fundação do frontend: design system escuro, casca, páginas e simulador guiado)

> **Tarefas em paralelo (leva D):** este handoff fica em `handoffs/TASK-039.md` e
> `handoffs/current.md` **não** foi editado. Esta tarefa não tocou `frontend/src/three/**` (TASK-041),
> `frontend/src/presentation/components/CraneViewport.tsx`, `backend/**` nem os ADRs.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-039-fundacao-frontend.md` |
| **Etapa concluída** | implementação (com testes); o acréscimo "ligar a cena da TASK-041" ficou **parcial** (§ 7) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-039-fundacao-frontend`, a partir de `0229d49` (último commit de código: `12e0a61`) |
| **Duração aproximada** | ~2 h 30 min |

---

## 1. Objetivo desta etapa

Trocar a tela única crua por casca + páginas + design system escuro próprio (ADR-017), com o
simulador guiado (cena full-bleed, passos à esquerda, HUD do resultado à direita, barra de status),
sem regressão da avaliação (WebSocket com fallback REST).

## 2. O que foi feito

- **Dependências (CA-1):** runtime `react-router` 8.4, `lucide-react` 1.48,
  `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono` (5.3), todas MIT/OFL e locais.
  Dev (testes): `jsdom`, `@testing-library/react`, `@testing-library/dom` (MIT), para testes de
  componente com clique, teclado e foco (a tarefa limita só as de runtime).
- **Tema (CA-2):** `src/presentation/theme/tokens.css` (superfícies, vidro, bordas, texto, acento
  ciano, situação, tipografia, espaçamento 4 px, raios, sombras, movimento, camadas, casca),
  `fonts.css` (só o subconjunto latino, eixo de peso: 2 arquivos woff2, 88 kB) e `global.css` (reset,
  foco visível `:focus-visible`, barras de rolagem, `.visually-hidden`, `prefers-reduced-motion`, e o
  estilo de `.crane-viewport`, que o `CraneViewport` usa sem mudar). Vidro com
  `@supports not (backdrop-filter)` → fundo sólido. Contraste medido (tabela em § 5).
- **Componentes (CA-3)** em `src/presentation/ui/`, CSS Modules, barril em `index.ts`: Button (4
  variantes, `loading`), IconButton (nome acessível obrigatório + dica), Panel (vidro/sólido, região
  nomeada), Field + Input (unidade, ícone) + Select (seta própria), Badge e StatusPill (ponto com
  pulso), Tabs (WAI-ARIA, setas/Home/End), Dialog e Drawer (foco preso, Esc, clique fora, foco
  devolvido — `useModal`), Toast (`ToastProvider`/`useToast`, `status`/`alert`, pausa no hover), Table
  (cabeçalho fixo, números mono, skeleton, vazio), EmptyState, Skeleton/SkeletonText, Stepper
  (pendente/atual/completo, `aria-current="step"`), **Gauge** (arco de 270°, faixas, marcas a cada
  10 %, número animado por `requestAnimationFrame`, `role="meter"` com o valor real em
  `aria-valuetext` acima de 100 %), Slider (range nativo com trilha preenchida), Notice, Spinner.
- **Casca e rotas (CA-4):** `AppShell` (trilho recolhível com ícones, lembra a escolha em
  `localStorage` e começa recolhido abaixo de 1360 px; barra superior com título/descrição da
  página, botão de ajuda e o espaço do menu do usuário; "pular para o conteúdo"). Rotas do ADR-017 § 1
  em `src/app/AppRoutes.tsx`: `/login` (fora da casca, reservado), `/`, `/simulador`, `/catalogo`,
  `/tabelas`, `/usuarios` (reservado), `*` (não encontrada).
- **Início (CA-5):** boas-vindas com ilustração SVG, fluxo 1-2-3, atalhos (Simulador, Catálogo,
  Tabelas), resumo do catálogo (`application/catalog/catalogSummary.ts`: fabricantes, guindastes,
  configurações e quantas têm ficha) com skeleton, vazio (orienta cadastrar) e erro (alerta +
  "Tentar de novo"), e os avisos permanentes: dados FICTÍCIOS (ADR-012), estratégia PROVISÓRIA
  (ADR-015) e "o backend decide" (RN-008).
- **Simulador (CA-6):** `SimulatorPage` (cena ocupando a página, painéis de vidro por cima, vinheta),
  `GuidedStepsPanel` (progresso + Stepper; passos liberados em sequência por
  `application/simulator/guidedSteps.ts`; botão "Continuar para …"; resumo do passo concluído),
  HUD = `BackendEvaluationPanel` reescrito (situação com cor, Gauge de utilização, capacidade, carga,
  raio do backend, detalhes da consulta num `<details>`, motivos do "não avaliável", selo
  PROVISÓRIO), geometria de pré-visualização compacta, `ConnectionStatusBar` (WebSocket/REST,
  "atualizando…", dica de câmera ou botões). A lógica do antigo `App.tsx` foi para
  `app/routes/SimulatorRoute.tsx` sem mudar: mesma `EvaluationSession`, mesmo `buildEvaluationInput`.
- **Catálogo e Tabelas (CA-4, simples):** `CatalogPage` (seleção, ficha técnica da configuração em
  Table, cadastros em Tabs, notificação ao cadastrar) e `TablesPage` (seleção + importação/ativação
  restilizada; "Versões" como vazio). A seleção do catálogo é compartilhada entre as páginas
  (`app/catalog/CatalogProvider.tsx`) e a carga digitada sobrevive à navegação
  (`app/simulator/SimulatorDraftProvider.tsx`).
- **Painéis restilizados:** CatalogSelectionPanel (modo `embedded` para o passo 1, chips da ficha,
  "Tentar de novo"), CraneControlPanel (Slider), LoadPanel (Field/Input com unidade, CG num
  `<details>`, erro só depois de mexer no campo), TechnicalSheetFields, CatalogRegistrationPanel
  (Tabs), LoadChartImportPanel (Table, Badge de status), OperationalGeometryPanel. Removidos
  `App.css` e `LoadChartAndLoadPanels.tsx` (a carga passou a ser estado do rascunho do simulador).
- **Acréscimo pedido pela sessão principal (TASK-041):** cores de situação alinhadas à paleta da cena
  (§ 5, decisão 3); `evaluationStatus` passou a produzir só `ok`/`over`/`unknown`; criado
  `presentation/simulator/CameraPresetButtons.tsx` (4 IconButtons com dica, `aria-pressed`). **A
  mescla da branch da TASK-041 foi recusada pelo controle de permissões desta sessão** — ver § 7 e § 10.
- **Testes:** 94 novos Vitest (de 266 para 360): componentes do design system em jsdom
  (`tests/presentation/ui/*.test.tsx`), casca/rotas/Início com `fetch` falso
  (`tests/app/appRoutes.test.tsx`), passos/barra/câmera (`tests/presentation/simulator/`), passos,
  situação e resumo (`tests/application/simulator/guidedFlow.test.ts`). E2E reescritos para as
  páginas: `scene.spec.ts` (Início, navegação pelo trilho, 404, canvas full-bleed, passos em
  sequência, sliders mudando a geometria) com catálogo FICTÍCIO respondido no navegador
  (`e2e/tests/catalogMock.ts`); `evaluation.spec.ts` navega até `/simulador` e percorre os passos.
- **Capturas (CA-8):** Playwright com script temporário fora do repositório, contra o `vite preview`
  (porta 5183) do build final, com catálogo e avaliação FICTÍCIOS simulados no navegador
  (`page.route`/`routeWebSocket`: capacidade 2.000 kg, carga 1.500 kg → 75 %):
  - `docs/assets/screenshots/inicio-1440x900.png`
  - `docs/assets/screenshots/inicio-1280x720.png`
  - `docs/assets/screenshots/simulador-1440x900.png`
  - `docs/assets/screenshots/simulador-1280x720.png`
  - extras: `docs/assets/screenshots/simulador-inicio-1440x900.png` (passo 1, sem avaliação) e
    `docs/assets/screenshots/simulador-acima-da-capacidade-1440x900.png` (132,4 %, vermelho).
  A cena nessas capturas ainda é a antiga (sem a TASK-041): refazer depois da ligação (§ 10).

## 3. Arquivos modificados

`git diff --stat 0229d49..HEAD` (resumo; 128 arquivos, `+10142 −1035`):

```text
 docs/assets/screenshots/*.png                      | 6 capturas (2,3 MB)
 frontend/package.json, package-lock.json           | dependências (§ 2)
 frontend/vite.config.ts                            | testes .tsx + setup (jsdom por arquivo)
 frontend/index.html, public/favicon.svg            | lang pt-BR, theme-color, marca nova
 frontend/src/main.tsx, src/app/App.tsx             | tema + roteador
 frontend/src/app/{AppProviders,AppRoutes}.tsx      | provedores e rotas (novos)
 frontend/src/app/auth/*                            | AuthProvider falso (novo)
 frontend/src/app/catalog/*, simulator/*            | estado compartilhado (novo)
 frontend/src/app/routes/*                          | composição por página (novo)
 frontend/src/app/useCatalogSummary.ts              | resumo do Início (novo)
 frontend/src/app/App.css                           | removido
 frontend/src/application/catalog/catalogSummary.ts | novo
 frontend/src/application/evaluation/evaluationStatus.ts | novo
 frontend/src/application/simulator/guidedSteps.ts  | novo
 frontend/src/presentation/theme/*                  | novo
 frontend/src/presentation/ui/*                     | novo (design system)
 frontend/src/presentation/layout/*                 | novo (casca)
 frontend/src/presentation/pages/*                  | novo
 frontend/src/presentation/simulator/*              | novo
 frontend/src/presentation/panels/*                 | restilizados; LoadChartAndLoadPanels.tsx removido
 frontend/tests/**                                  | 7 arquivos novos, 2 ajustados, setup.ts
 frontend/e2e/tests/*                               | reescritos + catalogMock.ts
```

Mais `handoffs/TASK-039.md` e `tasks/in-progress/TASK-039-fundacao-frontend.md`. Nada em
`frontend/src/three/**`, `CraneViewport.tsx`, `backend/**`, ADRs, `docs/*.md` gerais nem
`handoffs/current.md`.

Fora do escopo aparente: nenhum. (`vite.config.ts` e `index.html` estão em `frontend/**`.)

## 4. Comandos executados e resultados

Em `frontend/`, no código final (`7a526af` + capturas), exceto o `check-structure.sh` (raiz).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` + `npm install …` | ✅ | `found 0 vulnerabilities` |
| `npm run lint` | ✅ passou | `eslint .` sem saída |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b && tsc -p e2e` sem saída |
| `npm test` | ✅ passou | `Test Files 33 passed (33)` · `Tests 360 passed \| 1 skipped (361)` |
| `npm run build` | ✅ passou | `✓ built in 515ms`; `index` 173 kB (55 kB gzip), CSS 67 kB (12,5 kB gzip), fontes 40 + 48 kB; sem aviso de chunk |
| `npm run e2e` (vite preview 4173, sem backend) | ✅ passou | `7 passed` · `2 skipped` (os dois de `evaluation.spec.ts`, que exigem `E2E_BACKEND=1`) |
| `bash scripts/check-structure.sh` | ✅ passou | ver § 4.1 |
| `git merge --no-ff task/TASK-041-cena-3d-enriquecida` | ❌ NÃO EXECUTADO | recusado pelo controle de permissões da sessão ("Modify Shared Resources") |

Servidores abertos durante o trabalho (dev 5181, preview 5182 e 5183) foram encerrados no fim; a
porta 5173 não foi usada.

### 4.1 check-structure

```text
3. Tarefas
  ! há 3 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
  ✓ nenhum ID de tarefa duplicado
6. Links Markdown internos quebrados ... ✓ nenhum link interno quebrado
7. Branches ✓ branch de tarefa: task/TASK-039-fundacao-frontend
8. Autoria dos commits ✓ 11 commit(s) desta branch sem co-autoria de IA
OK: 0 erros, 1 aviso(s)
```

O aviso é o das três tarefas paralelas da leva D (038, 039, 041), esperado.

## 5. Decisões tomadas

1. **Componentes com teste de interação real (jsdom + Testing Library, só em dev).** Os `.test.tsx`
   pedem `// @vitest-environment jsdom`; os testes antigos continuam em node. Sem isso, "comportamento
   e acessibilidade" (foco preso, setas nas abas, Esc) não seria testável.
2. **Camadas:** páginas em `presentation/pages` recebem dados por props; a composição com hooks e
   clientes fica em `app/routes/*` (como o antigo `App.tsx`). Presentation só importa `react-router`
   para `Link`/`NavLink`.
3. **Cores de situação = paleta da cena** (`STATUS_COLORS` da TASK-041): ok `#22c55e`, warning
   `#f5a524`, over→danger `#ef4444`, unknown→neutral `#8b95a3`; tabela de correspondência no topo de
   `tokens.css`. Como texto, o vermelho da paleta fica abaixo de 4,5:1 sobre as superfícies, então há
   `--color-status-danger-text` (`#f87171`) para mensagens e selos. Não gerei os tokens a partir de
   `palette.ts` porque o arquivo não está nesta branch (mescla recusada); depois da mescla dá para
   trocar por um teste que compara os dois (sugestão em § 10).
4. **Situação só `ok`/`over`/`unknown`** (`application/evaluation/evaluationStatus.ts`): utilização
   do backend > 100 % → `over`; até 100 % (inclusive igual) → `ok`; sem resultado, erro ou
   `NOT_EVALUABLE` → `unknown`. `warning` fica no tipo (para casar com a cena), mas sem uso: não há
   critério (PEND-004). Carga = capacidade como "dentro" é provisório (P-005). Mesmo contrato do
   `toSceneStatus` pedido no handoff da TASK-041 § 2.1.
5. **Passo 3 "concluído"** = há resultado do backend para o estado atual (sem erro). "Carga válida" =
   formulário inteiro válido (mesma regra que já alimentava a avaliação).
6. **O medidor vai de 0 a 100 %**; acima disso o arco fica cheio, pulsa e o texto mostra o valor real.
7. **Erros da carga só depois de mexer no campo** (ou em qualquer campo do CG), para o formulário
   vazio não abrir cheio de avisos. O status "Carga incompleta ou inválida" continua sempre visível.
8. **Contraste AA** (medido): texto 1 ≥ 11:1, texto 2 ≥ 6,1:1, texto 3 ≥ 5:1 até `surface-3`; ciano
   ≥ 7:1; verde ≥ 6,4:1; âmbar ≥ 7,2:1; cinza de situação ≥ 4,8:1; texto de erro (`#f87171`) ≥ 5,3:1;
   texto escuro sobre o botão ciano 9,8:1.
9. **Trilho recolhe sozinho abaixo de 1360 px** (mais espaço para a cena em 1280×720), salvo escolha
   guardada.

## 6. Regras de negócio aplicadas

- RN-008 / ADR-013 C-7 — o HUD só mostra o que o backend devolveu; a geometria do navegador aparece
  rotulada "pré-visualização — frontend"; nenhuma capacidade é calculada na UI.
- PEND-004 — sem níveis de alerta; a cor só compara carga e capacidade (texto no HUD e na ajuda);
  `warning` não é usado.
- ADR-015 — selo PROVISÓRIO no HUD e aviso permanente no Início.
- ADR-012 — dados FICTÍCIOS nos testes, E2E e capturas; aviso permanente no Início.
- RN-007 — "não avaliável" mostra os motivos (códigos).
- Regra **não documentada** encontrada: carga igual à capacidade (§ 8, 1).

## 7. O que NÃO foi feito e por quê

- **Ligar a cena nova da TASK-041 (acréscimo da sessão principal): PARCIAL.** O
  `git merge --no-ff task/TASK-041-cena-3d-enriquecida` foi recusado pelo controle de permissões desta
  sessão e não foi contornado. Sem a mescla, o `CraneViewport` desta branch não tem as props
  `evaluationStatus`, `load`, `cameraPreset` nem o `ref`, então **não** foram ligados: a situação na
  cena, a caixa da carga e os botões de câmera. Já prontos para a ligação: `evaluationStatus()` com o
  contrato da TASK-041, `CameraPresetButtons` e o espaço `cameraActions` da `ConnectionStatusBar`.
  As capturas do CA-8 mostram a cena antiga.
- E2E com backend (`evaluation.spec.ts`): **pulados** localmente (o backend em `:8000` desta máquina
  não é desta sessão e está sem banco: `database: NOT_CONFIGURED`). Rodam no job "E2E" do CI.
- Login real, guardas de rota, página de usuários (TASK-040); listas completas, drawers e versões de
  tabelas (TASK-042) — fora do escopo; os pontos de encaixe estão em § 10.
- `docs/architecture.md`, `development-guide.md`, `known-gaps.md`, `README.md`: não tocados (regra da
  tarefa); o que mudar está em § 10.
- Os commits intermediários `950dfe7` (painéis) e `1c41c0c` (casca) só compilam juntos: o primeiro
  remove `LoadChartAndLoadPanels.tsx`, que o `App.tsx` antigo ainda importava até o segundo. Com
  squash no PR, não importa.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Carga igual à capacidade (100 %) aparece como "Dentro da capacidade" (verde). Está certo, ou é violação (P-005)? | não | | |
| 2 | Quando houver critério de "atenção" (PEND-004), a faixa âmbar entra no medidor e na cena (`warning`) | não | | |
| 3 | Autorizar a mescla `task/TASK-041-cena-3d-enriquecida` nesta branch (ou mesclar as duas em `development` e ligar lá) | sim, para o acréscimo | | |

## 9. ⚠️ Segurança

- nada a relatar (dados FICTÍCIOS; nenhum segredo; dependências novas MIT/OFL, sem CDN).

## 10. Próximo passo

**Papel:** Pessoa responsável (mescla/autorização), depois Implementador (ligação) e Revisor

**O que fazer, concretamente:**
1. **Mesclar a TASK-041** nesta branch: `git merge --no-ff task/TASK-041-cena-3d-enriquecida -m
   "chore(merge): trazer a cena 3D da TASK-041 (TASK-039)"` (a sessão principal informou que entra sem
   conflito com `86e4929`).
2. **Ligar a cena** em `frontend/src/app/routes/SimulatorRoute.tsx` (contrato em
   `handoffs/TASK-041.md` § 2.1):
   ```tsx
   const viewportRef = useRef<CraneViewportHandle>(null)
   const [cameraPreset, setCameraPreset] = useState<CameraPresetId | null>(null)
   <CraneViewport
     ref={viewportRef}
     setup={craneSetup.setup}
     onCraneChange={handleCraneChange}
     evaluationStatus={evaluationStatus(evaluationInput.problem === null && evaluation.error === null ? evaluation.result : null)}
     load={validLoad ? { lengthM: validLoad.lengthM, widthM: validLoad.widthM, heightM: validLoad.heightM } : null}
   />
   // na ConnectionStatusBar:
   cameraActions={<CameraPresetButtons active={cameraPreset} onSelect={(p) => { setCameraPreset(p); viewportRef.current?.setCameraPreset(p) }} />}
   ```
   `evaluationStatus` e `CameraPresetButtons` já existem nesta branch; `CameraPresetId` tem os mesmos
   nomes do `CameraPreset` da TASK-041.
3. **Uma fonte só para as cores:** acrescentar um teste que importa `STATUS_COLORS`/`statusCssColor`
   de `src/three/scene/palette.ts` e compara com os valores de `tokens.css` (ok, warning, danger,
   neutral), para os dois não divergirem.
4. Refazer as capturas do CA-8 (mesmos nomes em `docs/assets/screenshots/`) com a cena nova e rodar
   os gates.
5. **TASK-040 (login) — pontos de encaixe:**
   - `frontend/src/app/auth/authContext.ts`: tipo `AuthState` (`status`, `user`, `hasRole`,
     `signOut`) e `useAuth()`; trocar o `AuthProvider` falso (`app/auth/AuthProvider.tsx`, sempre
     `anonymous`) pelo real, sem mudar quem consome.
   - Menu do usuário: `presentation/layout/UserMenu.tsx` (hoje "Sem autenticação"); `AppRoutes` já
     passa `user` de `useAuth()` (nome e perfil). Acrescentar o "Sair" ali.
   - Guardas: em `app/AppRoutes.tsx`, envolver o `<Route element={<AppShell …/>}>` com a guarda que
     redireciona para `/login` preservando o destino; `/usuarios` com perfil ADMIN.
   - `/login`: `presentation/pages/LoginPage.tsx` (hoje reservado, fora da casca).
   - `/usuarios`: `presentation/pages/UsersPage.tsx` (vazio com texto do que vem); o item já está na
     seção "Administração" do trilho (`presentation/layout/navigation.ts`, `section: 'admin'`).
6. **TASK-042 (catálogo e tabelas) — pontos de encaixe:**
   - Rotas `/catalogo` e `/tabelas` em `app/AppRoutes.tsx` → `app/routes/CatalogRoute.tsx` e
     `TablesRoute.tsx`, que hoje montam `CatalogPage`/`TablesPage` simples.
   - Componentes prontos: `Table` (colunas, `numeric`, `loading`, `empty`), `Drawer` (detalhe/edição),
     `Dialog` (confirmação), `Tabs`, `EmptyState`, `Toast` (`useToast`, já usado no cadastro).
   - Estado compartilhado: `useCatalog()` (`app/catalog/catalogContext.ts`); a seleção vale para o
     simulador também.
   - "Versões" em `TablesPage` é o lugar da lista de versões/ativação.
7. Docs para a tarefa de consolidação: `architecture.md` (camadas do frontend: theme/ui/layout/pages/
   simulator; `app/routes`, provedores), `development-guide.md` (testes `.tsx` com jsdom; E2E com
   catálogo simulado), `known-gaps.md` (100 % = dentro, provisório; `warning` sem uso; versões de
   tabela ainda vazias), `README.md` (páginas e capturas).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff (§ 7 e § 10)
3. `handoffs/TASK-041.md` § 2.1 (contrato do viewport)
4. `frontend/src/app/routes/SimulatorRoute.tsx`
5. `docs/decisions/ADR-017-navegacao-e-design-system-do-frontend.md`

**Cuidado com:**
- `CraneViewport` remonta a cena a cada objeto `setup` novo: `craneSetup` continua memorizado pelo
  JSON da configuração.
- Nos E2E, `getByLabel('Comprimento (m)')` casa também com "Ao longo do comprimento (m)": use
  `{ exact: true }` (já feito em `catalogMock.ts`).
- O `mountCraneScene` da TASK-041 põe `position: relative` inline em `.crane-viewport__canvas`
  quando ele é `static`; aqui ele é `absolute` (em `global.css`), então nada muda.

## 11. Como revisar este trabalho

- Comece por `app/routes/SimulatorRoute.tsx` (a avaliação tem de continuar igual à do antigo
  `App.tsx`) e `application/simulator/guidedSteps.ts` + `evaluationStatus.ts` (regras do fluxo e da
  cor).
- Depois `presentation/ui/useModal.ts`, `Tabs.tsx` e `Gauge.tsx` (acessibilidade) e os testes em
  `tests/presentation/ui/`.
- Visual: as capturas em `docs/assets/screenshots/`.
- Tenho menos certeza sobre: a decisão 4 (100 % = dentro, P-005) e se o passo 3 deve contar como
  concluído só com resultado do backend (decisão 5).
