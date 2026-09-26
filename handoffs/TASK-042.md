# Handoff — TASK-042 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 |
| **Tarefa** | `tasks/in-progress/TASK-042-paginas-catalogo-e-tabelas.md` |
| **Etapa concluída** | implementação (pronta para revisão) |
| **Papel exercido** | Implementador (e engenheiro de testes) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente do orquestrador |
| **Branch** | `task/TASK-042-paginas-catalogo-e-tabelas`, criada a partir de `86e4929` (branch da TASK-039, ainda não integrada em `development`) |

---

## 1. Objetivo desta etapa

Transformar `/catalogo` e `/tabelas` em telas de trabalho completas (CA-1 a CA-5), sem mexer no
backend, na casca, nas rotas, na autenticação nem na cena 3D.

## 2. O que foi feito

**Cliente REST e aplicação**
- `LoadChartGateway` ganhou `validateChart` (`POST /api/v1/load-charts/validate`, sem gravar) e
  `getChart` (`GET /api/v1/load-charts/{id}`), no mesmo `send` do cliente atual. Nenhum cabeçalho
  novo: o `X-Requested-With`/`credentials` da TASK-040 entra no cliente e vale para as rotas novas.
- `application/loadChart/`: `loadChartMatrix.ts` (matriz lança × raio e 5 faixas de capacidade, sem
  interpolar), `chartComparison.ts` (pontos comuns que aumentam/diminuem, para o Dialog),
  `chartFile.ts` (extensão CSV/XLSX, vazio, limite de 1 MiB) e `chartVersions.ts` (versões
  conhecidas, sugestão de versão e id, `isActivatable`).
- `infrastructure/storage/knownChartsStorage.ts`: ids das tabelas acompanhadas por configuração no
  `localStorage` (paliativo da rota que falta; § 8), com reserva em memória.
- `application/catalog/catalogTree.ts`: árvore inteira do catálogo, contagens e busca sem acentos que
  atravessa os três níveis.

**Tabelas (`/tabelas`)** — `presentation/pages/TablesPage.tsx` e `presentation/tables/*`
- Escolha da configuração (o `CatalogSelectionPanel` compartilhado).
- `Dropzone` (novo, `presentation/ui/Dropzone.tsx`): estados arrastando, validando, válido e com
  erros; botão "Escolher arquivo" para o teclado; resultado em `role="status"`.
- Validação prévia: conferência local e, para CSV, o `/validate` do backend. XLSX fica "não
  verificado" até a importação (o `/validate` do backend só lê CSV).
- Prévia da matriz como mapa de calor: linhas = lança, colunas = raio, mono tabular, 5 faixas de um
  tom (ciano), legenda com os intervalos, células sem ponto hachuradas com "—".
- Relatório de erros em tabela com Linha, Coluna e Problema (código).
- Importação como rascunho, com versão e id sugeridos e validados no campo (obrigatório, repetido).
- Linha do tempo das versões (mais recente primeiro), ativa em destaque (marcador verde, borda,
  "vale para a avaliação", `aria-current`), "Ver matriz" e "Ativar".
- Dialog de ativação: explica que a capacidade calculada muda, que a ativa atual vira Substituída e,
  quando conhece as duas, compara os pontos comuns ("27 diminuem (até −10 %)").
- Toasts de sucesso e erro; estados de carregando, vazio e erro na lista.
- "Acompanhar uma tabela pelo id" (GET), para tabelas importadas fora deste navegador.

**Catálogo (`/catalogo`)** — `presentation/pages/CatalogPage.tsx` e `presentation/catalog/*`
- Três colunas mestre-detalhe (fabricante → guindaste → configuração) com contagens, busca com
  destaque do termo, setas/Home/End dentro de cada lista, e totais.
- Detalhe da configuração: a e h em destaque, limites (L, θ, c, ψ) em tabela, id, e a tabela ativa
  conhecida com a matriz compacta e link para `/tabelas`.
- Drawer de cadastro (fabricante, guindaste, configuração com ficha) com validação no campo enquanto
  se digita e erros do backend (422) nos campos. "Editar" abre o Drawer preenchido e **grava uma
  cópia** como item novo (§ 8).
- A seleção continua na `CatalogBrowser` compartilhada: o que se escolhe aqui vale no Simulador e
  nas Tabelas.

**Removidos (substituídos pelas páginas novas)**: `panels/CatalogRegistrationPanel.tsx`,
`panels/LoadChartImportPanel.tsx`, `pages/CatalogPage.module.css`, `application/loadChart/importForm.ts`
e os testes deles. Os testes do `LoadPanel` que moravam em `LoadChartImportPanel.test.ts` foram para
`tests/presentation/panels/LoadPanel.test.ts`, sem mudança.

## 3. Arquivos modificados

`git diff --stat 86e4929..HEAD -- frontend` (resumo): 47 arquivos, +5794 −1193. Principais:

```text
frontend/e2e/tests/loadChartImport.spec.ts                 (novo)
frontend/src/app/permissions/useCanEdit.ts                 (novo, provisório)
frontend/src/app/routes/CatalogRoute.tsx, TablesRoute.tsx  (alterados)
frontend/src/application/catalog/catalogTree.ts            (novo)
frontend/src/application/loadChart/*.ts                    (novos + ports.ts)
frontend/src/infrastructure/api/loadChartRestClient.ts     (validate, get)
frontend/src/infrastructure/storage/knownChartsStorage.ts  (novo)
frontend/src/presentation/catalog/*                        (novo)
frontend/src/presentation/tables/*                         (novo)
frontend/src/presentation/pages/CatalogPage.tsx, TablesPage.tsx
frontend/src/presentation/ui/Dropzone.tsx (+ .module.css)  (novo; nenhum componente existente mudou)
frontend/tests/**                                          (testes novos e ajustados)
```

Fora do escopo: nenhum. Não toquei em `backend/**`, ADRs, `handoffs/current.md`, `AuthProvider`,
`AppRoutes`, casca, simulador, `src/three/**` nem em `ui/index.ts` (o `Dropzone` é importado direto
do arquivo dele).

## 4. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ | sem erros |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b && tsc -p e2e` sem erros |
| `npm test` | ✅ | `Test Files 38 passed (38)` · `Tests 405 passed \| 1 skipped (406)` |
| `npm run build` | ✅ | `✓ built` (chunk da aplicação 211 kB, gzip 67 kB) |
| `E2E_BASE_URL=http://127.0.0.1:5221 npm run e2e` | ✅ | `8 passed`, `3 skipped` (os que exigem `E2E_BACKEND`) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 1 aviso(s)` (4 tarefas em `in-progress/`) |
| spec E2E "com backend" | ⚠️ NÃO EXECUTADO | exige a stack Docker (`E2E_BACKEND=1`); pulado, não aprovado |

Sobre o E2E: rodei contra um `vite preview` meu na porta **5221** (`E2E_BASE_URL`), e não com o
`webServer` padrão da configuração (porta 4173). Havia outros agentes usando a 4173 ao mesmo tempo, e
o `reuseExistingServer` faria o teste rodar contra o servidor de outra worktree. O servidor foi
encerrado no fim.

## 5. Decisões tomadas

- **Versões sem rota de listagem**: a tela lembra, no `localStorage`, os ids que importou, ativou
  ou acompanhou, e consulta cada um no `GET /load-charts/{id}` para ter o status real. Os que dão
  404 ou são de outra configuração são esquecidos. Uma falha de rede mostra erro (não meia lista).
- **Edição sem rota de alteração**: "Editar" grava uma cópia como item novo, com aviso explícito no
  Drawer. Não inventei endpoint.
- **XLSX**: sem validação prévia de conteúdo (o `/validate` do backend usa o parser CSV); vai para a
  importação, que valida os dois formatos. A tela diz isso no próprio Dropzone.
- **Cor da matriz**: escala sequencial de um tom só (ciano do acento), 5 faixas iguais entre o mínimo
  e o máximo da própria tabela; o número está sempre escrito. Contraste AA conferido por cálculo
  (mistura oklab sobre `--color-surface-2`): faixas 0–2 com texto claro 12,3 / 9,5 / 6,8:1; faixas 3–4
  com texto escuro 5,0 / 9,5:1. A faixa 3 começou em 62 % (4,4:1) e subiu para 68 %.
- **Não usei as cores de situação** (verde/âmbar/vermelho) na matriz: capacidade não é situação, e
  essas cores são reservadas para permitido/atenção/acima (ADR-017 § 3).
- **Toast no route/página**: o toast do cadastro continua no `CatalogRoute` (como na TASK-039); os de
  importação/ativação ficam na página Tabelas.

## 6. Regras de negócio aplicadas

- RN-001: tabela pertence a uma configuração (a página exige a configuração; `trackById` recusa id
  de outra).
- RN-005 / doc-fonte § 13.2: versões e status; só DRAFT/VALIDATED mostram "Ativar"; a ativa anterior
  vira SUPERSEDED (quem decide é o backend; a tela só reflete a resposta).
- ADR-009: a tela não interpola nem completa a matriz.
- RN-003 / ADR-013 C-4: ficha técnica com a validação local já existente (`catalogForms.ts`).
- ADR-012 / ADR-015: avisos FICTÍCIO e PROVISÓRIO no Drawer e no Dialog.

## 7. O que NÃO foi feito e por quê

- Spec E2E com backend: escrito, **NÃO EXECUTADO** (sem a stack Docker nesta sessão).
- Edição de verdade e lista de versões pelo backend: dependem das rotas do § 8.
- Capturas de tela não foram salvas no repositório (não é critério desta tarefa). Conferi o visual
  em 1440×900 e 1280×720 com capturas temporárias.
- Histórico de commits: o commit `3174bd2` levou também a remoção de `importForm.test.ts`, e o
  `3df2775` a de `pages/CatalogPage.module.css` (entraram junto por engano no `git add`). O conteúdo
  final está correto; o squash do PR resolve.

## 8. Pendências e riscos

**Rotas de backend que faltam** (nenhuma foi criada; a tela degrada):
1. Listar as tabelas de uma configuração, por exemplo `GET /api/v1/configurations/{id}/load-charts`
   ou `GET /api/v1/load-charts?configuration_id=…`. Sem ela, a linha do tempo só mostra o que este
   navegador conhece (ou o que se acompanha pelo id).
2. Tabela ativa de uma configuração (pode sair da mesma listagem). Sem ela, o detalhe do catálogo
   mostra "Nenhuma tabela ativa conhecida" quando o navegador não conhece a ativa.
3. Alterar cadastros: `PATCH`/`PUT` em `/api/v1/manufacturers/{id}`, `/api/v1/cranes/{id}` e
   `/api/v1/configurations/{id}`. Sem elas, "Editar" grava uma cópia.
4. (Opcional) `/validate` aceitar XLSX, como o `/import` (usar o seletor de parser da composição).

**Como ligar o `canEdit` real (integração com a TASK-040)**
- As páginas recebem `canEdit: boolean` por prop; quem decide é o route.
- `src/app/permissions/useCanEdit.ts` devolve `true` (provisório). Na integração, troque o corpo pelo
  hook de permissões da TASK-040 (ex.: `return usePermissions().canEdit`), ou apague o arquivo e
  importe o hook real em `src/app/routes/CatalogRoute.tsx` e `TablesRoute.tsx`.
- Com `canEdit=false`: Catálogo sem "Novo…"/"Editar" e selo "Somente leitura"; Tabelas sem Dropzone
  (aviso "Somente leitura") e sem "Ativar". Há teste para os dois casos.

**Outros**
- A TASK-040 vai centralizar `X-Requested-With`/`credentials` no cliente REST: `validateChart` e
  `getChart` passam pelo mesmo `send`/`fetchFn` e herdam isso sem mudança.
- A base é a branch da TASK-039: o PR desta tarefa depende da integração dela (e da TASK-040 para o
  perfil).

## 9. Próximo passo

Revisor (outra sessão/ferramenta): revisar `git diff 86e4929...task/TASK-042-paginas-catalogo-e-tabelas`
com `docs/templates/code-review-template.md`. Depois, a pessoa responsável decide sobre as rotas do
§ 8 (tarefa de backend) e integra com a TASK-040.
