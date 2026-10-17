# Handoff — TASK-114 — implementação (estabilizar dois testes instáveis do CI)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-114.md`; `handoffs/current.md` **não**
> foi editado. Não existe `tasks/in-progress/TASK-114-*.md` no repositório (verifiquei em `tasks/`):
> a tarefa chegou pelo pedido da pessoa responsável (ver § 8).

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3, Brasília) |
| **Tarefa** | TASK-114 (sem arquivo em `tasks/`; ver § 8) |
| **Etapa concluída** | implementação (com testes) |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3). A revisão é feita por outra sessão (Coruja) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-114-estabilizar-testes-instaveis`, a partir de `anderson/development` @ `6659320` |
| **Duração aproximada** | ~3 h (a maior parte, laços de repetição sob carga) |

---

## 1. Objetivo desta etapa

Achar a causa real de dois testes instáveis no CI e corrigi-los esperando a condição certa, sem
aumentar timeout às cegas nem relaxar asserção: (a) `tablesPage.test.tsx` «falha na ativação: toast de
erro e a lista é relida»; (b) `frontend/e2e/tests/collision.spec.ts:41` (baixar o cabo até a carga
tocar o chão).

## 2. O que foi feito

**(a) `frontend/tests/presentation/pages/tablesPage.test.tsx`**

- Verifiquei que o teste registrava `loadChartFetch.mockImplementationOnce(...409)` DEPOIS de
  «Versão v1 importada», e que um `mockImplementationOnce` é consumido pelo **próximo `fetch` qualquer**.
- Verifiquei no código que `onImported` chama `versionsApi.reload()` = `setAttempt(+1)`
  (`useChartVersions.ts`), e que a listagem só é chamada no **effect** que reage a essa mudança: ou
  seja, DEPOIS do toast, de forma assíncrona em relação ao teste.
- Quando esse effect ainda não rodou ao registrar o 409 (acontece sob carga), o 409 vai para a
  releitura, `useChartVersions` entra em `error`, a linha do tempo (`<ol>`) não é renderizada e o
  `findByRole('list', { name: 'Linha do tempo das versões' })` falha: exatamente o erro do CI.
- **Prova da causa:** uma sonda (cópia do teste, apagada depois) contou as listagens já chamadas no
  instante do registro do 409. Em 40 execuções sob carga, 2 falharam com o erro do CI, e as DUAS tinham
  `listagens=1` (esperado 2: inicial + pós-importação), ou seja, a releitura ainda não tinha saído.
- **Correção:** o 409 passa a valer SÓ para `POST …/activate` (`mockImplementation` que delega ao
  fetch normal nos demais pedidos). Acrescentei a verificação que o título promete: depois da falha, a
  lista é relida (`listings()` sobe de `beforeActivation` para `beforeActivation + 1`).

**(b) `frontend/e2e/tests/collision.spec.ts`**

- Li o log e o **trace do CI** do run `39041689294` (commit `e01410b`; artefato `playwright-report`):
  - o teste levou 24,7 s (localmente ~7 s);
  - no *snapshot* de DOM de 16 243 ms (início do `expect`), o alerta «comando bloqueado» **estava no
    DOM**; a captura final mostra o modelo GLB carregado e o cabo parado em 4,5 m (o `End` foi
    processado e bloqueado), mas sem alerta na tela;
  - o `expect(group «Colisões»).toHaveCount(1)`, que deveria ser instantâneo, levou 3 090 ms, e o
    `press End` ~1 s: a thread da página estava travada por quadros de vários segundos (SwiftShader, sem
    GPU; o console do trace traz «GPU stall due to ReadPixels»).
- Causa: o aviso dura 2 s e some sozinho (`BLOCKED_NOTICE_HOLD_MS`, TASK-069), e `toBeVisible`
  **amostra** o DOM; com a thread ocupada, a primeira amostragem só rodou depois dos 2 s de vida do
  aviso. O comportamento do app está correto; o teste dependia de amostrar um elemento transitório.
- **Correção:** `watchBlockedNotice(page)` instala, ANTES do comando `End`, um `MutationObserver` que
  resolve uma Promise no instante em que um `[role="alert"]` com «bloqueado» entra no DOM (com falha
  explícita em 15 s se nunca entrar); o spec espera por ela em vez de `toBeVisible`.
- A espera fixa `waitForTimeout(1500)` (interpretar o GLB) **não** é a causa (no CI o modelo já estava
  carregado) e foi mantida; ver § 7.

## 3. Arquivos modificados

```text
 frontend/e2e/tests/collision.spec.ts               | 50 ++++++++++++++++++++--
 .../tests/presentation/pages/tablesPage.test.tsx   | 27 ++++++++++--
 handoffs/TASK-114.md (+ cópia em handoffs/history/)
```

Fora do escopo: nenhum. Nenhuma mudança em `src/`.

## 4. Comandos executados e resultados

Todos em `frontend/` (Windows, 16 CPUs). Carga = 16 processos queimando CPU + execuções em paralelo.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| (a) ANTES: teste original ×100, 8 em paralelo, carga 16 | ❌ 2 falharam | `execucoes=100 ok=98 falhas=2` (execuções 6 e 86; erro `Unable to find role="list" and name "Linha do tempo das versões"`) |
| (a) sonda (instrumentada) ×40 | ❌ 2 falharam | as 2 falhas = as 2 únicas com `listagens=1` na linha 210 |
| (a) DEPOIS: teste corrigido ×60, mesma carga | ✅ | `execucoes=60 ok=60 falhas=0` |
| (a) DEPOIS: arquivo inteiro `tablesPage.test.tsx` ×30 | ✅ | `ok=30 falhas=0` |
| `catalogPage.test.tsx` inteiro ×30 (a tarefa cita o Catálogo) | ✅ | `ok=30 falhas=0` (não consegui reproduzir instabilidade ali; nada alterado) |
| (b) ANTES: `collision.spec.ts:41` original, `--repeat-each=25`, carga 16 | ✅ não reproduziu | `25 passed (10.1m)` |
| (b) ANTES: original ×8 com Chromium e queimadores presos a 2 núcleos | ✅ não reproduziu | `8 passed (12.4m)` |
| (b) DEPOIS: `collision.spec.ts` (2 testes) `--repeat-each=20`, carga 16 | ✅ | `40 passed (9.8m)` |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run lint` | ✅ | sem saída (0 erros) |
| `npm run typecheck` (`tsc -b && tsc -p e2e`) | ✅ | sem saída (0 erros) |
| `npm test` (vitest completo) | ✅ | `Test Files 148 passed (148)`, `Tests 1355 passed \| 1 skipped (1356)` |
| `npm run build` | ✅ | `✓ built in 950ms` |
| `bash scripts/check-structure.sh` (Git Bash) | ✅ | `OK: 0 erros, 2 aviso(s)` |

## 5. Decisões tomadas

- (a) Em vez de aumentar o timeout do teste ou do `findByRole`, tornei o fake determinístico: a falha
  injetada pertence à requisição certa. Alternativa descartada: aguardar a releitura antes de registrar
  o 409; ela funcionaria, mas deixaria o teste dependente da ordem interna dos effects.
- (b) Em vez de `toBeVisible` (amostragem) com `timeout` maior, observei a **aparição** pelo DOM. Um
  timeout maior não resolve: o aviso some em 2 s, e a amostragem pode rodar só depois disso.
- Não alterei código de produção nem o tempo de vida do aviso (TASK-069): o comportamento é o esperado.

## 6. Regras de negócio aplicadas

Nenhuma regra de negócio nova. RN-012 (colisão da carga) segue coberta pelo mesmo spec.

## 7. O que NÃO foi feito e por quê

- **A falha (b) NÃO foi reproduzida localmente.** 25/25 (carga de 16 queimadores), 8/8 (2 núcleos
  disputados) e 3/3 (CPU emulada 4×, 8×; aviso observado em 108 ms a ~950 ms conforme a lentidão) com o
  spec original. A causa vem da **evidência do trace do CI**, não de uma reprodução; por isso o
  "antes" do (b) não mostra falha. Tentei também uma sonda que atrasa a primeira checagem em 2,6 s: o
  original passou, porque localmente o aviso dura mais de 2,6 s (a releitura do controle de deslizar o
  renova). Não investiguei esse comportamento além disso.
- A prova de estabilidade do (b) "depois" (40/40) é compatível com a correção, mas **não distingue
  estatisticamente** de "antes" (0 falhas nos dois), dada a baixa frequência natural da falha.
- `waitForTimeout(1500)` («interpretar o GLB») e outras esperas fixas em `cargoDelivery.spec.ts`,
  `objetosReais.spec.ts` e `tipoDeCarga.spec.ts` ficaram como estão: não há sinal observável do modelo
  principal trocado (`onModelResult` não chega à UI) e não foram a causa dos dois testes desta tarefa.
- O CI completo (job E2E com a stack Docker) não foi executado aqui; só o `vite preview` local.
- `scripts/check-structure.sh` avisou 2 itens; não investiguei (0 erros).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Criar `tasks/in-progress/TASK-114-*.md` com os critérios de aceite? A tarefa veio pelo pedido, sem arquivo | não | | |
| 2 | Expor na UI um sinal de «modelo do guindaste trocado» (ex.: `data-crane-model`) para trocar as esperas fixas dos e2e por condição? Exige mudança em `src/` | não | | |

## 9. ⚠️ Segurança

Nada a registrar. Os artefatos do CI foram baixados num diretório temporário próprio e tratados como
dado (não executados).

## 10. Próximo passo

**Papel:** Revisor, depois a pessoa responsável (aprovar o PR).

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-114-estabilizar-testes-instaveis` (2 arquivos de teste).
2. Conferir no CI do PR se o `collision.spec.ts` e o `tablesPage.test.tsx` passam; acompanhar as
   próximas execuções do CI para confirmar que as duas falhas não voltam.

**Ler primeiro:** `AGENTS.md`; este handoff; `frontend/src/presentation/tables/useChartVersions.ts`;
`frontend/src/app/simulator/useCollisionState.ts`.

**Cuidado com:** o "antes" do (b) não falha localmente; a evidência da causa é o trace do CI (run
`39041689294`, artefato `playwright-report`, 2026-10-17).

## 11. Como revisar este trabalho

- Comece pelo `tablesPage.test.tsx` (linhas ~210-235): é a correção mais direta e a única com prova
  numérica de antes/depois (2/100 → 0/60).
- Tenho menos certeza do (b): a correção é por construção a partir do trace; não há reprodução local.
- O observador do (b) detecta a *presença no DOM* do aviso, não a visibilidade CSS; o app só o
  monta quando há bloqueio, então é equivalente aqui.
