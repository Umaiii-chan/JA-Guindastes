# Handoff — TASK-034 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (fuso local, UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-034-telas-importacao-e-carga.md` |
| **Etapa concluída** | implementação (com planejamento e testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (mesma sessão) |
| **Ferramenta/agente** | Claude Code (Claude Opus 5.5), subagente em git worktree isolado |
| **Branch** | `task/TASK-034-telas-importacao-e-carga` (base `d58edf6`) @ `e4cca7e` + o commit deste handoff |
| **Duração aproximada** | 45 min |

---

## 1. Objetivo desta etapa

Telas do frontend para importar/ativar tabela de carga (contrato da TASK-031) e para informar a
carga da simulação (RF-011), com o peso alimentando a avaliação da TASK-032.

## 2. O que foi feito

- Branch criada com `git switch -c task/TASK-034-telas-importacao-e-carga d58edf6`; `git log -1`
  confirmou `d58edf6 chore(tasks): mover TASK-029 a 032 para completed e abrir a leva C`.
- **Porta** `application/loadChart/ports.ts`: `LoadChartGateway` (`importChart`, `activateChart`),
  tipos `StoredLoadChart`, `LoadChartImportIssue`, `LoadChartImportOutcome` (`IMPORTED` |
  `INVALID`), `LoadChartActivation` (`chart` + `supersededChartId`), `LoadChartFailure`.
- **Formulário de importação** `application/loadChart/importForm.ts`: só confere presença (arquivo,
  configuration_id, chart_id, versão; `trim`). Formato, existência e unicidade ficam com o backend.
- **Carga** `application/load/loadForm.ts`: `validateLoadForm` repete as regras provisórias da `Load`
  do backend (TASK-028): descrição não vazia; peso finito > 0; comprimento/largura/altura finitos
  > 0; CG opcional, com as três coordenadas finitas e `|c| <= aresta/2` (faces incluídas).
  `loadWeightTextForEvaluation(values)` → peso da carga válida como texto, ou `''`.
- **Cliente REST** `infrastructure/api/loadChartRestClient.ts` (`createLoadChartRestClient`, `fetch`
  injetável, mesma origem por padrão): multipart `file`/`configuration_id`/`chart_id`/`version`
  sem fixar `Content-Type`; 201 → `IMPORTED`; 422 com `status: INVALID` → `INVALID` com o relatório;
  404/409/413/415/422 do FastAPI/outros/rede/resposta fora do contrato → `LoadChartClientError`
  (`code`, `httpStatus`, mensagem em português + `detail` do backend quando houver). Ativação: 200 →
  tabela + `superseded_chart_id`; 404/409 com mensagens próprias. Id codificado na URL.
- **Painéis**: `presentation/panels/LoadChartImportPanel.tsx` (formulário + `LoadChartImportReport`,
  sem estado, que mostra problemas do formulário, erro, relatório 422 em tabela, resumo/pontos do
  201 com botão "Ativar", e a ativação com a tabela substituída como `SUPERSEDED`);
  `LoadPanel.tsx` (controlado, mensagens por campo, diz se o peso vai para a avaliação);
  `LoadChartAndLoadPanels.tsx` (junta os dois, guarda o estado da carga e chama
  `onLoadWeightTextChange`; cria o cliente REST padrão se não receber `gateway`).
- **App.tsx** (5 linhas): um import e o bloco
  `<LoadChartAndLoadPanels configurationId={configurationId} onLoadWeightTextChange={setLoadWeightText} />`
  logo após o `EvaluationInputPanel`.
- Estilos: reaproveitei classes já existentes em `App.css` (`evaluation-input*`, `evaluation-panel*`);
  nenhum CSS alterado.
- Testes novos (44): cliente (multipart, 201, 422 relatório, 422 FastAPI, 415, 404/409/413/500,
  rede, fora do contrato, ativação com/sem SUPERSEDED, 404/409, id codificado), formulário de
  importação, carga (peso, dimensões, descrição, CG dentro/fora/pela metade, peso para a avaliação)
  e renderização estática dos painéis alimentada pelo cliente com `fetch` falso. Dados FICTÍCIOS em
  `tests/fixtures/loadChartResponses.ts`.

## 3. Arquivos modificados

```text
$ git diff --stat d58edf6   (antes do commit de docs)
 frontend/src/app/App.tsx                           |   5 +
 frontend/src/application/load/loadForm.ts          | 134 +++++++++
 frontend/src/application/loadChart/importForm.ts   |  39 +++
 frontend/src/application/loadChart/ports.ts        |  66 +++++
 .../src/infrastructure/api/loadChartRestClient.ts  | 275 ++++++++++++++++++
 .../presentation/panels/LoadChartAndLoadPanels.tsx |  45 +++
 .../presentation/panels/LoadChartImportPanel.tsx   | 311 +++++++++++++++++++++
 frontend/src/presentation/panels/LoadPanel.tsx     |  88 ++++++
 frontend/tests/application/load/loadForm.test.ts   | 113 ++++++++
 .../tests/application/loadChart/importForm.test.ts |  37 +++
 frontend/tests/fixtures/loadChartResponses.ts      |  55 ++++
 .../infrastructure/api/loadChartRestClient.test.ts | 222 +++++++++++++++
 .../panels/LoadChartImportPanel.test.ts            | 187 +++++++++++++
 13 files changed, 1577 insertions(+)
```

Mais este handoff e o arquivo da tarefa. Único arquivo existente alterado: `frontend/src/app/App.tsx`.

## 4. Comandos executados e resultados

Em `frontend/`, Windows, Node v24.19.0:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ | `found 0 vulnerabilities`; nenhuma dependência nova |
| `npm run lint` | ✅ | sem saída de erro |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b` sem erros |
| `npm test` | ✅ | `Test Files 22 passed (22)`, `Tests 261 passed \| 1 skipped (262)` (44 novos) |
| `npm run build` | ✅ | `✓ built`; aviso já existente de chunk > 500 kB (821 kB; tema da TASK-036) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |
| teste manual no navegador contra o backend | ⚠️ NÃO EXECUTADO | sem PostgreSQL local (pendência geral 6); nenhum servidor foi iniciado |

## 5. Decisões tomadas

- **Configuração por prop**: o App passa o `configurationId` do campo já existente (TASK-032); com
  a prop ausente o painel mostra um campo próprio. Quando a TASK-033 entrar, basta passar a
  configuração selecionada.
- **Peso para a avaliação só com a carga toda válida** (opção mais restritiva, coerente com a `Load`
  do domínio só existir válida): carga inválida → `''`, e o `buildEvaluationInput` da TASK-032 mostra
  "Informe o peso da carga…". Ver § 8 item 1.
- **CG informado pela metade** (uma ou duas coordenadas) é recusado: a `LoadCenterOfGravity` do
  backend tem três coordenadas obrigatórias; "opcional" = as três vazias.
- **Relatório 422 x 422 do FastAPI**: distinguidos pelo campo `status: "INVALID"` (como no handoff
  da TASK-031); o segundo vira erro `INVALID_REQUEST` com o primeiro `detail`.
- **Mensagens de 409 da importação** cobrem os dois casos do contrato (versão duplicada ou id
  existente), pois o corpo `{detail}` não traz código; o `detail` do backend é anexado.
- **Painel sem estado para testes**: o ambiente do Vitest é `node` sem biblioteca de DOM (e nenhuma
  dependência nova), então os testes renderizam `LoadChartImportReport` estaticamente com os dados
  que o cliente real devolve para um `fetch` falso; o fluxo de cliques não tem teste automatizado.
- `LoadChartAndLoadPanels` (apresentação) importa a fábrica do cliente REST como padrão, para o App
  ter um só import; testes/composição podem injetar `gateway`.
- Os pontos da tabela são todos listados (sem paginação).

## 6. Regras de negócio aplicadas

- RN-001 (tabela por configuração), RN-005 (versão): campos obrigatórios; unicidade e existência
  decididas pelo backend (409/404).
- RN-006: unidades internas (m, kg) nos rótulos e no contrato.
- Validações da carga: regras **provisórias** da TASK-028 (§ 8 dos handoffs da TASK-028 continua
  aberto), repetidas sem acréscimo.

## 7. O que NÃO foi feito e por quê

- **Campo de peso da TASK-032 não removido**: ele está em `EvaluationInputPanel.tsx` (props
  obrigatórias usadas pelo `App.tsx`, dono TASK-033). Até a mescla, a tela tem dois campos de peso
  ligados ao mesmo estado `loadWeightText`: o painel de carga escreve nele; digitar no campo antigo
  sobrepõe o valor sem passar pelas validações da carga. Ver § 10.
- A carga (descrição, dimensões, CG) não vai ao backend: a avaliação só recebe `load_weight_kg`.
- `GET /api/v1/load-charts/{id}` não é usado (a ativação já devolve o id substituído).
- Teste manual NÃO EXECUTADO; sem teste de interação (cliques) por falta de DOM no Vitest.
- Documentação não editada (protocolo da leva C) → § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | O peso deve ir para a avaliação só quando a carga toda é válida (hoje), ou basta o peso > 0 (descrição/dimensões/CG não bloqueiam a avaliação)? | não | | |
| 2 | CG com uma ou duas coordenadas preenchidas: recusar (hoje) ou tratar as vazias como 0? | não | | |
| 3 | Tabelas com muitos pontos: listar todos (hoje) ou paginar/resumir? | não | | |
| 4 | Perguntas da TASK-028 § 8 (peso 0, dimensão 0, descrição obrigatória, referencial do CG) seguem abertas e afetam este painel | não | | |

## 9. ⚠️ Segurança

- Nada novo: o arquivo vai direto ao backend (limites 413/415 no servidor); nenhum dado em URL além
  do `chart_id` codificado; rotas sem autenticação (P-009) já registradas.

## 10. Próximo passo

**Papel:** sessão principal (mescla), depois Revisor e pessoa responsável.

1. **Mescla com a TASK-033 em `frontend/src/app/App.tsx`**: manter o import de
   `LoadChartAndLoadPanels` e o bloco; passar a configuração selecionada do catálogo em
   `configurationId`; **remover o campo de peso do `EvaluationInputPanel`** (props
   `loadWeightText`/`onLoadWeightTextChange`) para que o peso venha só do painel de carga.
2. Revisar `git diff development...task/TASK-034-telas-importacao-e-carga`.
3. Documentação a atualizar (não editada aqui): `docs/architecture.md` (frontend: porta
   `LoadChartGateway`, cliente REST de tabelas, painéis de importação e de carga);
   `docs/requirements/functional.md` (RF-006/007/011: tela no frontend, testes relacionados);
   `docs/known-gaps.md` (carga só com peso no backend; validações provisórias repetidas no
   frontend; § 8 deste handoff); `docs/testing-strategy.md` (painéis testados por renderização
   estática, sem DOM); `README.md` (como importar/ativar pela tela); `handoffs/current.md`
   (índice: TASK-034 em revisão).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-034-telas-importacao-e-carga.md` § 3
4. `frontend/src/infrastructure/api/loadChartRestClient.ts`
5. `frontend/src/application/load/loadForm.ts`

**Cuidado com:**
- As rotas de importação/ativação só existem no backend com `DATABASE_URL` e `FILE_STORAGE_DIR`
  (TASK-031); sem elas a tela recebe 404 na importação (mensagem de "configuração não encontrada",
  que nesse caso engana — o `detail` do FastAPI "Not Found" aparece anexado).

## 11. Como revisar este trabalho

- Comece por `loadChartRestClient.ts` (mapeamento de status e contrato) e compare com o § 2 do
  handoff da TASK-031.
- Tenho menos certeza sobre o 404 da importação quando as rotas não estão registradas (item
  "Cuidado com" acima) e sobre a UX dos dois campos de peso até a mescla.
