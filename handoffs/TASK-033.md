# Handoff — TASK-033 — implementação (telas de catálogo: seleção e cadastro)

> **Tarefas em paralelo (leva C):** este handoff fica em `handoffs/TASK-033.md` e
> `handoffs/current.md` **não** foi editado. Esta tarefa só toca `frontend/` (e este handoff e a
> tarefa); não mexe em `frontend/vite.config.ts` (TASK-036).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-033-telas-catalogo-e-selecao.md` |
| **Etapa concluída** | implementação (com testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-033-telas-catalogo-e-selecao` @ `9096647` (antes do commit deste handoff), a partir de `d58edf6` |
| **Duração aproximada** | ~1 h 15 min |

---

## 1. Objetivo desta etapa

Seleção encadeada fabricante → guindaste → configuração no frontend (alimentando a avaliação),
cadastros simples com a ficha técnica do ADR-013 C-4 e limites dos sliders e a/h da
pré-visualização vindos da ficha da configuração escolhida.

## 2. O que foi feito

- Troquei para a branch já existente (`git switch task/TASK-033-telas-catalogo-e-selecao`) e conferi
  `git log -1` = `d58edf6 chore(tasks): mover TASK-029 a 032 para completed e abrir a leva C`. A
  tarefa não existia em `tasks/in-progress/`; criei-a a partir do template.
- **Domínio** `src/domain/catalog/catalog.ts`: `Manufacturer`, `Crane`, `CraneConfiguration`,
  `CraneTechnicalSheet` (campos do ADR-013 C-4, opcionais como `null`) e `CatalogRequestError`
  (`code` + `fieldErrors`).
- **Infraestrutura**: `infrastructure/api/catalogContract.ts` (rotas e DTOs que espelham
  `backend/app/presentation/api/catalog_schemas.py`, mapa de nomes backend → frontend) e
  `catalogRestClient.ts` (`fetch` injetável; listar/criar fabricante, guindaste e configuração;
  404 → `NOT_FOUND` e 409 → `CONFLICT` com o `detail`; 422 → `VALIDATION` com um erro por item do
  `detail`, `loc` traduzido para o nome do frontend, ex.: `geometry.boomLengthMinM`; outro HTTP,
  rede e contrato violado).
- **Aplicação** `application/catalog/`: porta `CatalogGateway`; `CatalogBrowser` (estado observável
  como a `EvaluationSession`; escolher um item limpa as escolhas de baixo e recarrega a lista de baixo;
  respostas atrasadas são descartadas por id de pedido; cadastro recarrega a lista e deixa o item
  novo escolhido; devolve `{ok, value}` ou `{ok: false, error}`); `catalogForms.ts` (leitura da ficha a
  partir do texto, validação local básica e tradução dos erros do backend para o formulário).
- **Cena** (`src/three/`): novo tipo `CraneSetup` (limites + a/h); `buildCraneScene(setup)` e
  `mountCraneScene(container, setup)` desenham a lança de `L_min` a `L_max` e o pino com a/h do
  setup; os valores FICTÍCIOS saíram de `createProvisionalCrane.ts` para
  `three/crane/provisionalCraneSpec.ts` (sem Three.js; reexportados, então os testes antigos não
  mudaram). `CraneViewport` recebe `setup` e remonta a cena quando ele muda.
- **Composição** `app/craneSetup.ts` (`chooseCraneSetup`: ficha → setup, com aviso e observações por
  controle), `app/useCatalogBrowser.ts` e `App.tsx`: seleção no topo da barra lateral; a configuração
  escolhida vai para `buildEvaluationInput`; ponto de encaixe comentado para a TASK-034; cadastros num
  `<details>` no fim.
- **Apresentação**: `CatalogSelectionPanel`, `CatalogRegistrationPanel` (três formulários),
  `TechnicalSheetFields` e `technicalSheetLabels.ts`; `CraneControlPanel` recebe `notice`/`notes`
  (o texto fixo "FICTÍCIOS" virou aviso dinâmico); `OperationalGeometryPanel` diz se a/h são da ficha
  ou FICTÍCIOS; `EvaluationInputPanel` ficou só com a carga. Estilos em `App.css`.
- **Testes** (48 novos, Vitest, `fetch` falso que imita as rotas da TASK-030 em memória, dados
  FICTÍCIOS): `tests/infrastructure/api/catalogRestClient.test.ts`,
  `tests/application/catalog/CatalogBrowser.test.ts`, `tests/application/catalog/catalogForms.test.ts`,
  `tests/app/craneSetup.test.ts` (inclui a cena montada com a ficha limitando os comandos e calculando
  R com a da ficha), `tests/presentation/panels/catalogPanels.test.ts`; helper
  `tests/helpers/fakeCatalogFetch.ts` e fixture `tests/fixtures/catalogFicticio.ts`.
- **Mutação manual** (alterei, rodei, restaurei): sem o descarte por id de pedido no `loadList` →
  `1 failed | 24 passed` em `tests/application/catalog`; ψ_max trocado por 180 em `chooseCraneSetup`
  → `2 failed | 6 passed` em `craneSetup.test.ts`.
- **Conferência no navegador** (Vite em `:5179`, encerrado no fim; sem backend, porque as rotas do
  catálogo exigem PostgreSQL): sem backend, a lista de fabricantes mostra "O backend respondeu HTTP
  502." Com um `fetch` falso injetado na página (só no navegador, nada no código), cadastrei
  fabricante, guindaste e configuração pela tela: nome vazio → "Obrigatório."; θ máx = 95 → erro 422
  exibido embaixo do campo θ máx; corrigido para 75 → configuração criada e escolhida, sliders com
  θ 0..75°, L 8..30 m, cabo 1..15 m com "Máximo FICTÍCIO…", giro "contínuo", e a pré-visualização
  "com parâmetros da ficha técnica da configuração (a = 0,50 m, h = 2,50 m)", raio 10,33 m
  (= 0,5 + 12·cos 35°).

## 3. Arquivos modificados

`git diff --stat d58edf6...HEAD` antes do commit deste handoff e da tarefa:

```text
 frontend/src/app/App.css                           | 122 +++++++
 frontend/src/app/App.tsx                           |  61 +++-
 frontend/src/app/craneSetup.ts                     |  86 +++++
 frontend/src/app/evaluationInput.ts                |   7 +-
 frontend/src/app/useCatalogBrowser.ts              |  25 ++
 frontend/src/application/catalog/CatalogBrowser.ts | 213 ++++++++++++
 frontend/src/application/catalog/catalogForms.ts   | 161 +++++++++
 frontend/src/application/catalog/ports.ts          |  30 ++
 frontend/src/domain/catalog/catalog.ts             |  73 +++++
 frontend/src/infrastructure/api/catalogContract.ts |  82 +++++
 .../src/infrastructure/api/catalogRestClient.ts    | 197 +++++++++++
 .../src/presentation/components/CraneViewport.tsx  |  13 +-
 .../panels/CatalogRegistrationPanel.tsx            | 365 +++++++++++++++++++++
 .../presentation/panels/CatalogSelectionPanel.tsx  | 129 ++++++++
 .../src/presentation/panels/CraneControlPanel.tsx  |  17 +-
 .../presentation/panels/EvaluationInputPanel.tsx   |  22 +-
 .../panels/OperationalGeometryPanel.tsx            |  13 +-
 .../presentation/panels/TechnicalSheetFields.tsx   |  65 ++++
 .../presentation/panels/technicalSheetLabels.ts    |  16 +
 frontend/src/three/crane/createProvisionalCrane.ts |  67 ++--
 frontend/src/three/crane/provisionalCraneSpec.ts   |  54 +++
 frontend/src/three/crane/types.ts                  |  10 +
 frontend/src/three/scene/buildCraneScene.ts        |  34 +-
 frontend/src/three/scene/mountCraneScene.ts        |   9 +-
 frontend/tests/app/craneSetup.test.ts              |  99 ++++++
 .../application/catalog/CatalogBrowser.test.ts     | 217 ++++++++++++
 .../tests/application/catalog/catalogForms.test.ts | 159 +++++++++
 frontend/tests/fixtures/catalogFicticio.ts         |  72 ++++
 frontend/tests/helpers/fakeCatalogFetch.ts         | 132 ++++++++
 .../infrastructure/api/catalogRestClient.test.ts   | 228 +++++++++++++
 .../presentation/panels/catalogPanels.test.ts      | 137 ++++++++
 31 files changed, 2813 insertions(+), 102 deletions(-)
```

Mais `tasks/in-progress/TASK-033-telas-catalogo-e-selecao.md` e este handoff. Nada em `backend/`,
`docs/`, `README.md`, `handoffs/current.md` nem `frontend/vite.config.ts`. Nenhuma dependência nova
(`package.json`/`package-lock.json` intactos).

Fora do escopo aparente (justificativa):
- `src/three/**` — a cena precisava receber limites e a/h de fora (objetivo 4); mudança mínima, API
  antiga mantida (parâmetro opcional, reexport dos FICTÍCIOS).

## 4. Comandos executados e resultados

Em `frontend/`, com o código final (`9096647`), exceto o `check-structure.sh` (raiz).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ passou | `found 0 vulnerabilities` |
| `npm run lint` | ✅ passou | `eslint .` sem saída |
| `npm run format:check` | ✅ passou | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ passou | `tsc -b` sem saída |
| `npm test` | ✅ passou | `Test Files 23 passed (23)` · `Tests 265 passed \| 1 skipped (266)` (48 novos; antes 217 + 1) |
| `npm run build` | ✅ passou | `✓ built in 423ms`; aviso de chunk > 500 kB (Three.js, já existia; é da TASK-036) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)`; `✓ 3 commit(s) desta branch sem co-autoria de IA` |

## 5. Decisões tomadas

1. **A cena é remontada quando a configuração (ou a ficha) muda**, em vez de trocar limites num
   controller vivo: o modelo provisório desenha a lança recolhida com `L_min` e o pino com a/h, que só
   entram na construção. A pose volta à inicial FICTÍCIA (limitada à ficha). O `setup` é memorizado
   pelo JSON da configuração, para recarregar a lista (objetos novos e iguais) não remontar a cena.
2. **Sem ψ_min/ψ_max, slider de −180° a 180° rotulado "giro contínuo"** (ADR-013 C-4: sem valor = giro
   contínuo). **Sem c_max, máximo FICTÍCIO** (15 m da PoC, ou c_min se maior), rotulado. Ver § 8, 1.
3. **Ficha com `L_min = 0` usa os FICTÍCIOS**, com aviso: o modelo provisório não desenha lança de
   comprimento zero (o `createProvisionalCrane` exige recolhida > 0). Ver § 8, 2.
4. **Validação local só com o que o backend já documenta** (schema e `CraneGeometry`: obrigatórios,
   número finito, `ge=0`, mínimo ≤ máximo, giro em par). A faixa de θ (−90°, 90°] fica para o 422.
5. **Erros 422 com `loc` traduzido** para os nomes do frontend; o que o formulário não mostra (ex.:
   `manufacturerId`) aparece numa lista embaixo do resumo, para não se perder.
6. **O item cadastrado fica escolhido** na seleção (fabricante, guindaste ou configuração), para a
   sequência cadastrar → avaliar ser direta. Decisão de UX, sem regra; reversível.
7. **Cadastros num `<details>` fechado no fim da barra lateral**, para a ficha (10 campos) não empurrar
   os controles para baixo.
8. **Ponto de encaixe da TASK-034** em `App.tsx`: comentário no `aside`, entre a pré-visualização e os
   cadastros, com a variável `selectedConfiguration` (id e ficha, ou `null`) pronta.

## 6. Regras de negócio aplicadas

- RN-003 / ADR-013 C-4 regra 1 — a/h e limites vêm da ficha cadastrada no backend, nunca do modelo 3D.
- RN-008 / ADR-013 C-7 — a ficha no frontend só define sliders e pré-visualização; o backend continua
  validando o estado com a ficha (nada de capacidade no navegador).
- RN-006 — campos com a unidade no nome (`…M`, `…Deg`) e nos rótulos.
- ADR-012 — dados FICTÍCIOS nos testes; FICTÍCIOS rotulados na tela quando não há ficha.
- Regras **não documentadas** encontradas → § 8.

## 7. O que NÃO foi feito e por quê

- Editar/excluir cadastros: fora do escopo (sem regra; pendência 2 da TASK-030).
- Teste de componente com interação (clique/digitação): o projeto não tem jsdom nem Testing Library e
  a tarefa proíbe dependência nova. A lógica está em módulos testados sem DOM; os painéis têm teste de
  render estático; a interação foi conferida no navegador (§ 2).
- Conferência com o backend real: NÃO EXECUTADA — as rotas do catálogo só existem com `DATABASE_URL`
  (PostgreSQL), e o Docker local não roda (pendência 6 do `current.md`). O contrato foi seguido pelo
  handoff da TASK-030 e pelo `catalog_schemas.py`.
- Câmera: não se ajusta ao tamanho do guindaste da ficha (lança longa pode sair do quadro). Não pedido.
- `docs/*.md`, `README.md`, `handoffs/current.md`: não tocados (regra da leva C); ver § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Sem c_max na ficha, qual o máximo do slider do cabo? Hoje: 15 m FICTÍCIO (ou c_min, se maior), rotulado | não | | |
| 2 | Ficha com `L_min = 0` (o backend aceita): como desenhar? Hoje usa os FICTÍCIOS, com aviso | não | | |
| 3 | Deixar escolhido o item recém-cadastrado é o comportamento desejado? | não | | |
| 4 | A tela deve avisar quando o backend sobe sem `DATABASE_URL` (catálogo ausente, hoje aparece "HTTP 404"/"502" na lista)? | não | | |

## 9. ⚠️ Segurança

- nada a relatar (dados FICTÍCIOS; nenhum segredo).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisar `git diff d58edf6...task/TASK-033-telas-catalogo-e-selecao`.
2. Conferir no CI os gates do frontend.
3. **Mudanças de documentação para a tarefa de consolidação (TASK-037)** — não feitas aqui:
   - `docs/architecture.md`: frontend com `domain/catalog`, `application/catalog` (`CatalogBrowser`,
     porta `CatalogGateway`, formulários), `infrastructure/api/catalogRestClient.ts`; a cena recebe
     `CraneSetup` (limites + a/h) e remonta quando a configuração muda.
   - `docs/development-guide.md`: a seleção e os cadastros precisam do backend com `DATABASE_URL`.
   - `docs/known-gaps.md`: sem editar/excluir cadastros; c_max ausente → máximo FICTÍCIO; `L_min = 0`
     → FICTÍCIOS; câmera fixa; sem teste de componente com interação.
   - `README.md`: a tela escolhe fabricante → guindaste → configuração e cadastra com ficha técnica.
   - `handoffs/current.md`: registrar a TASK-033 e as pendências da § 8.
4. **Mescla com a TASK-034:** os painéis dela entram no ponto de encaixe comentado em
   `frontend/src/app/App.tsx` (recebendo `selectedConfiguration`). Se ela alterou `App.tsx` a partir de
   `d58edf6`, manter a seleção desta tarefa (o campo de texto de `configuration_id` não existe mais).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `frontend/src/application/catalog/CatalogBrowser.ts` e `frontend/src/app/craneSetup.ts`
4. `frontend/src/infrastructure/api/catalogRestClient.ts` (erros)

**Cuidado com:**
- `CraneViewport` remonta a cena a cada objeto `setup` novo: mantê-lo memorizado.
- Os FICTÍCIOS agora moram em `src/three/crane/provisionalCraneSpec.ts`; `createProvisionalCrane.ts`
  só os reexporta.

## 11. Como revisar este trabalho

- Comece por `CatalogBrowser.ts` (descarte de respostas e limpeza das escolhas) e `craneSetup.ts`
  (o que vem da ficha e o que é FICTÍCIO).
- Teste manual com backend real: `docker compose up` (ou backend com `DATABASE_URL`) e
  `npm run dev` em `frontend/`; abrir "Cadastros", criar fabricante, guindaste e configuração com
  ficha FICTÍCIA (ex.: a 0,5; h 2,5; L 8..30; θ 0..75; c mín 1) → a configuração fica escolhida, os
  sliders passam aos limites da ficha e o painel de geometria diz "parâmetros da ficha técnica";
  informar a carga → avaliação do backend com essa configuração. Um θ máx de 95 deve voltar 422 com a
  mensagem embaixo do campo θ máx.
- Tenho menos certeza sobre as decisões 2 e 3 (§ 5) e sobre o caso `L_min = 0`.
