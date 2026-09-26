# Handoff — TASK-016 — implementação

> Handoff próprio da TASK-016 (tarefas em paralelo, regra da TASK-006). `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:55 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-016-geometria-na-cena.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só sessão; a revisão deve ser de outra sessão/ferramenta) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-016-geometria-na-cena` @ `88297cf` (+ o commit deste handoff), a partir de `d5eedab` |
| **Duração aproximada** | 45 min |

---

## 1. Objetivo desta etapa

Entregar `getOperationalGeometry()` no `CraneController` com as fórmulas do ADR-013 (só
pré-visualização), alinhar o guindaste provisório às convenções do ADR-013 com o gancho desenhado em
G, mostrar raio e alturas num painel da UI e provar a paridade com os casos do backend no Vitest.

## 2. O que foi feito

- Verifiquei que o worktree começou em `f18dd9e`; criei a branch a partir de `d5eedab`, como pedido
  (`git log -1` → `d5eedab chore(tasks): mover TASK-010, 013 e 014 para completed e abrir a leva TASK-015..017`).
- Criei `frontend/src/domain/geometry/operationalGeometry.ts`: `calculateOperationalGeometry(inputs,
  parameters)` com as fórmulas (1)–(5), `workingRadiusM()` como função única do raio (ADR-013 C-3),
  `validateCraneGeometryParameters()` e os tipos `CraneGeometryParameters` (a, h), `OperationalInputs`,
  `Point3` e `OperationalGeometry`. Sem Three.js nem React; comentários dizem que é PRÉ-VISUALIZAÇÃO e
  que o backend é a fonte de verdade (C-7, RN-008).
- Alterei `frontend/src/three/crane/CraneController.ts`: o construtor recebe `geometryParameters`
  (3º argumento, antes do estado inicial), valida e guarda cópia congelada; `getOperationalGeometry()`
  devolve o cálculo com o estado atual (já limitado). Documentei no `CraneRig` e nos `apply*` como o
  mapeamento graus → rotação segue o ADR-013 (C-1, C-2, C-4 regra 4).
- Alterei `frontend/src/three/crane/types.ts`: `CraneCommands` ganhou `geometryParameters` e
  `getOperationalGeometry()`.
- Alterei `frontend/src/three/crane/createProvisionalCrane.ts`: novo `PROVISIONAL_CRANE_GEOMETRY`
  (FICTÍCIO: a = −1,2 m; h = 3,3 m) e o pino da lança passou a ser posicionado a partir de a e h
  (antes era a constante visual `BOOM_PIVOT`, com os mesmos valores — o desenho não mudou).
- Alterei `frontend/src/three/scene/buildCraneScene.ts` para usar o mesmo `PROVISIONAL_CRANE_GEOMETRY`
  no modelo e no controller.
- Criei `frontend/src/presentation/panels/OperationalGeometryPanel.tsx` (raio de trabalho, altura da
  ponta, altura do gancho, selo "pré-visualização — frontend", parâmetros FICTÍCIOS, aviso de raio
  geométrico sem deflexão e de que capacidade e segurança não são decididas no frontend). Alterei
  `App.tsx` (guarda a geometria junto com o estado e envolve os dois painéis num `<aside>`), `App.css`
  e o aviso do `CraneControlPanel.tsx` (não diz mais "sem cálculo de raio, altura").
- Escrevi os testes: `frontend/tests/fixtures/geometryParityCases.ts` (os 11 casos de
  `test_ficticio_geometry_matches_hand_calculated_values` do backend, transcritos),
  `frontend/tests/helpers/expectClose.ts`, `frontend/tests/domain/geometry/operationalGeometry.test.ts`
  (33 testes), `frontend/tests/three/crane/operationalGeometryInScene.test.ts` (16 testes) e casos novos
  em `CraneController.test.ts`, `createProvisionalCrane.test.ts` e `buildCraneScene.test.ts`. Total:
  122 testes (eram 58).
- Fiz duas mutações para conferir que os testes pegam erro de convenção (sinal do giro no cálculo e
  na cena; pino 1 cm mais alto no modelo): falharam 7, 16 e 15 testes; restaurei o código.
- Rodei os gates, o check-structure e o teste manual no navegador (§ 4).

## 3. Arquivos modificados

`git diff --stat d5eedab...HEAD` (antes do commit deste handoff; a base é `d5eedab`):

```text
 frontend/src/app/App.css                           |  53 +++++-
 frontend/src/app/App.tsx                           |  31 +++-
 .../src/domain/geometry/operationalGeometry.ts     | 163 +++++++++++++++++
 .../src/presentation/panels/CraneControlPanel.tsx  |   3 +-
 .../panels/OperationalGeometryPanel.tsx            |  75 ++++++++
 frontend/src/three/crane/CraneController.ts        |  67 +++++--
 frontend/src/three/crane/createProvisionalCrane.ts |  38 +++-
 frontend/src/three/crane/types.ts                  |  21 ++-
 frontend/src/three/scene/buildCraneScene.ts        |  15 +-
 .../domain/geometry/operationalGeometry.test.ts    | 192 +++++++++++++++++++++
 frontend/tests/fixtures/geometryParityCases.ts     | 188 ++++++++++++++++++++
 frontend/tests/helpers/expectClose.ts              |  31 ++++
 frontend/tests/three/crane/CraneController.test.ts | 150 ++++++++++++++--
 .../three/crane/createProvisionalCrane.test.ts     |  31 +++-
 .../three/crane/operationalGeometryInScene.test.ts | 120 +++++++++++++
 frontend/tests/three/scene/buildCraneScene.test.ts |  19 +-
 tasks/in-progress/TASK-016-geometria-na-cena.md    | 170 ++++++++++++++++++
 17 files changed, 1312 insertions(+), 55 deletions(-)
```

Mais `handoffs/TASK-016.md` (este arquivo). `frontend/package.json` e `frontend/package-lock.json`
não mudaram (`git diff --stat d5eedab -- frontend/package.json frontend/package-lock.json` vazio):
nenhuma dependência nova.

Fora do escopo: nenhum. Nada fora de `frontend/`, da tarefa e deste handoff.

## 4. Comandos executados e resultados

Todos em `frontend/`, exceto o check-structure (na raiz), com Node v24.19.0 e npm 11.17.0.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ passou | `added 185 packages, and audited 186 packages in 15s` · `found 0 vulnerabilities` |
| `npm run lint` | ✅ passou | `eslint .` sem nenhum problema (`lint exit=0`) |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b` sem erros |
| `npm test` | ✅ passou | `Test Files  8 passed (8)` · `Tests  122 passed (122)` |
| `npm run build` | ✅ passou, com aviso | `dist/assets/index-C7Gnn9Rf.js 791.01 kB │ gzip: 210.97 kB` · `✓ built` · aviso `(!) Some chunks are larger than 500 kB` (o mesmo da TASK-013, Pendência 3 dela) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)` · `4 commit(s) desta branch sem co-autoria de IA` (antes dos commits da tarefa atualizada e deste handoff) |
| ESLint via stdin: `import { Scene } from 'three'` como `src/presentation/panels/Probe.tsx` e `src/domain/geometry/Probe.ts` | ✅ barrado | `'three' import is restricted from being used. Importe Three.js só dentro de src/three/ (ADR-005)` nos dois |
| `grep -rn "from 'three" src` fora de `src/three/` | ✅ nada | nenhuma linha |

**Teste manual (§ 7 da tarefa), feito pelo agente no painel de navegador do Claude Code**, sobre o build
de produção (`npx vite preview --port 4616 --strictPort`; `curl` → `200`):

- pose inicial (0°, 35°, 12,0 m, 5,0 m): painel "Geometria" com o selo "pré-visualização — frontend",
  `Raio de trabalho 8,63 m`, `Altura da ponta 10,18 m`, `Altura do gancho 5,18 m` (conferem com a
  conta em `awk`: R = 8,629825; y_T = 10,182917; y_G = 5,182917) e o texto dos parâmetros
  `a = -1,20 m, h = 3,30 m`;
- cabo em 15 m: `Altura do gancho -4,82 m`, raio e altura da ponta sem mudar;
- 90°, 60°, 20,0 m, 15,0 m: `8,80 m`, `20,62 m`, `5,62 m` (R = −1,2 + 20·cos 60° = 8,8; y_T = 3,3 +
  20·sin 60° = 20,62), e a lança passou para o lado +X do chassi na imagem;
- nenhum erro no console. O servidor foi encerrado no fim (porta 4616 livre).
- não verificado por mim: o modo dev (`npm run dev`, StrictMode) e o arraste do mouse para orbitar;
  `mountCraneScene` e `CraneViewport` não mudaram nesta tarefa. O sentido anti-horário visto de cima foi
  verificado por teste automatizado, não por inspeção visual de cima.

## 5. Decisões tomadas

- **Cálculo puro em `frontend/src/domain/geometry/`**, e não em `src/three/crane/`: é a pasta
  planejada para "tipos e regras locais independentes da UI" (`docs/development-guide.md` § 4), a UI
  pode importar os tipos sem passar por `src/three/`, e a regra do ESLint já barra `three` ali. É o
  primeiro arquivo dessa pasta (Pendência 4).
- **a e h entram no `CraneController` como argumento próprio**, e não no `CraneRig`: são dados da ficha
  técnica (ADR-013 C-4, regra 1; RN-003), não do modelo 3D. O rig é que precisa ser coerente com eles
  (C-4, regra 3). Por isso o construtor virou `(rig, limits, geometryParameters, initialState?)`.
- **Mapeamento graus → rotação não mudou:** conferi (conta e testes) que o da TASK-013 já seguia o
  ADR-013 — `rotation.y = ψ` leva +Z a (sin ψ, 0, cos ψ) = u(ψ); `rotation.x = −θ` leva +Z a
  (0, sin θ, cos θ); a cabine fica em +Z. Só entraram comentários e testes. a = −1,2 m e h = 3,3 m são
  os valores que o desenho já tinha (torre em 1,6 m + pino a 1,7 m; pino 1,2 m atrás do eixo).
- **R < 0 vira `workingRadiusM: null`**, com `horizontalReachM` (R com sinal) e P, T, G ainda
  calculados para a cena; o painel mostra "fora do domínio geométrico (ponta atrás do eixo de giro)". No
  backend isso é exceção; no frontend, lançar erro no meio do render derrubaria a UI. Com os limites
  FICTÍCIOS atuais, R < 0 não acontece (R mínimo = −1,2 + 12·cos 80° ≈ 0,88 m) (Pendência 3).
- **Sem validar as faixas da ficha técnica no cálculo do frontend:** quem valida é o backend (RN-008);
  o controller continua limitando (clamp). Os testes de limites do backend não foram repetidos (dito no
  cabeçalho do teste). Os parâmetros são validados como no backend: finitos e h ≥ 0.
- **Giro sem normalizar:** o estado continua no valor do slider ([−180°, 180°], FICTÍCIO). As fórmulas
  são periódicas; um teste mostra que −45° ≡ 315°, 725° ≡ 5° e −180° ≡ 180° dão a mesma geometria
  (Pendência 2).
- **Tolerâncias explícitas:** 1e-9 m nas fórmulas (a mesma do backend); 1e-6 m na comparação com as
  posições de mundo dos nós (erro de ponto flutuante das matrizes). Nenhuma é tolerância de engenharia
  (G-7).
- **Casos de paridade duplicados no frontend**, transcritos do backend com o mesmo `id`, porque esta
  tarefa não pode tocar `backend/` (Pendência 1).
- **Painel:** duas casas decimais em pt-BR; os dois painéis ficam num `<aside>` (a largura e a borda
  saíram de `.crane-panel` para `.app__sidebar`).

## 6. Regras de negócio aplicadas

- RN-008 / ADR-013 C-7: a geometria do frontend é rotulada "pré-visualização — frontend" na UI e
  PRÉ-VISUALIZAÇÃO no código; o painel diz que capacidade e segurança não são decididas no frontend.
  Nada de capacidade foi implementado.
- RN-003 / ADR-013 C-4: a e h vêm de constante FICTÍCIA passada ao controller, não do modelo; o
  cálculo não lê a posição dos nós (os testes conferem os nós contra o cálculo, não o contrário).
- ADR-013 R-1: o painel avisa que o raio é geométrico, sem deflexão da lança.
- ADR-012: dados FICTÍCIOS rotulados no código, nos testes e no painel.
- Nenhuma regra não documentada foi implementada.

## 7. O que NÃO foi feito e por quê

- Integração com o backend (REST/WebSocket) e troca do valor provisório pelo oficial: fora do escopo.
- Arquivo único de casos de paridade lido por pytest e Vitest: exige tocar `backend/` (Pendência 1).
- Atualizar `docs/architecture.md` (§ 2 e § 9 ainda dizem que nada existe), `docs/development-guide.md`
  § 4 (estrutura "planejada") e `docs/known-gaps.md` P-004 (agora há paridade parcial): esses arquivos
  estão com as TASK-011, 015 e 017 (Pendência 4).
- Testes automatizados dos componentes React: exigiriam jsdom/Testing Library (dependência nova). O
  painel foi verificado à mão (§ 4).
- Push e PR: não feitos, por instrução desta sessão.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | O ADR-013 C-7 pede **um conjunto único** de casos de paridade rodado no pytest e no Vitest, com o local decidido "nessa tarefa". Como esta tarefa só podia tocar `frontend/`, os casos foram transcritos em `frontend/tests/fixtures/geometryParityCases.ts`. Criar uma tarefa curta para mover os casos para um arquivo compartilhado (por exemplo, um JSON numa pasta de fixtures comum lida pelos dois lados)? Onde ele deve ficar? | não | | |
| 2 | Giro: o estado visual fica no valor do slider ([−180°, 180°], FICTÍCIO) e não é normalizado em [0°, 360°) como no domínio do backend (ADR-013 C-2). A geometria é a mesma. Quando houver integração, o frontend normaliza antes de enviar ou deixa para o backend (o `OperationalState` já normaliza)? O slider deve passar a mostrar 0°..360°? | não | | |
| 3 | R < 0 no frontend: o resultado traz `workingRadiusM: null` e o painel mostra "fora do domínio geométrico (ponta atrás do eixo de giro)", em vez de erro. Confirma essa forma de sinalizar? (Não acontece com os limites FICTÍCIOS atuais.) | não | | |
| 4 | Docs: registrar que o frontend tem `src/domain/geometry/` (primeiro uso da pasta planejada), `getOperationalGeometry()` e testes de paridade — `docs/architecture.md` §§ 2 e 9, `docs/development-guide.md` § 4 e `docs/known-gaps.md` P-004. Fica com a TASK-017 ou numa tarefa de docs depois do merge? E confirma a pasta `src/domain/` para o cálculo? | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta), depois a pessoa responsável

**O que fazer, concretamente:**
1. Revisar o diff `git diff d5eedab...task/TASK-016-geometria-na-cena` com
   `docs/templates/code-review-template.md`.
2. Rodar o teste manual da tarefa (§ 7), principalmente conferir os números da pose inicial e o
   sentido do giro olhando de cima.
3. Pessoa responsável: responder as Pendências 1–4; push e PR pela autorização permanente 5 do
   `handoffs/current.md`, quando quiser.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-016-geometria-na-cena.md` §§ 3 e 7
4. `frontend/src/domain/geometry/operationalGeometry.ts` (as fórmulas)
5. `frontend/tests/fixtures/geometryParityCases.ts` ao lado de `backend/tests/domain/test_geometry_service.py` (paridade)
6. `frontend/src/three/crane/CraneController.ts` e `createProvisionalCrane.ts` (a e h no controller e no modelo)

**Cuidado com:**
- O construtor do `CraneController` mudou: `(rig, limits, geometryParameters, initialState?)`. Quem
  criar outro rig (por exemplo, o GLB real) precisa pôr a origem do nó `boom` em (0, h, a) da base com
  ψ = 0; senão o gancho desenhado sai do G calculado (só erro visual, C-4 regra 3).
- Se um caso de paridade mudar no backend, o frontend não percebe sozinho (Pendência 1).
- `workingRadiusM` pode ser `null`: quem consumir o valor precisa tratar.

## 11. Como revisar este trabalho (só quando a etapa for implementação/correções)

- Comece por `frontend/src/domain/geometry/operationalGeometry.ts` e compare com
  `backend/app/domain/services/geometry_service.py` (mesma estrutura: alcance, raio isolado, posições).
- Depois `frontend/tests/three/crane/operationalGeometryInScene.test.ts`: os nós do modelo conferidos
  contra os valores calculados à mão (casos do backend) e contra `getOperationalGeometry()` em 162
  estados da cena da PoC.
- Tenho menos certeza sobre a escolha de `null` para R < 0 (Pendência 3) e sobre a pasta
  `src/domain/` (Pendência 4).
- `OperationalGeometryPanel` e `App` não têm teste automatizado (sem jsdom); a evidência é o teste manual
  do § 4.
