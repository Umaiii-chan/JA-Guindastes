# Handoff — TASK-050 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 11:45 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-050-resultado-da-simulacao.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só IA disponível) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), app desktop |
| **Branch** | `task/TASK-050-resultado-da-simulacao` (a partir de `origin/development` @ `3f55ac0`) |
| **Duração aproximada** | 1 h |

---

## 1. Objetivo desta etapa

Corrigir "durante a simulação não retorna o resultado" (pedido de 14/10/2026), primeira tarefa da
leva E.

## 2. O que foi feito

- Verifiquei a causa principal. O backend só avalia um comprimento de lança que seja coluna da tabela
  (`conservative_tabulated_lookup.py`, ADR-015, L-004), mas o slider andava de 0,1 em 0,1 m. Com a
  tabela demo (12, 17 e 22 m), quase toda posição dava `BOOM_LENGTH_NOT_IN_CHART`.
- Criei `frontend/src/application/loadChart/tabulatedBoomLengths.ts` e
  `frontend/src/app/useTabulatedBoomLengths.ts`, que leem as tabelas ativas da configuração (uma por
  zona). Com eles, o slider da lança encaixa nas colunas: a seta do teclado leva à coluna vizinha e,
  quando a tabela chega, a lança vai à coluna mais próxima. Nada é interpolado (RN-004). Sem tabela
  lida, o slider continua livre.
- `loadForm.ts`: o peso válido vai para a avaliação sem exigir o resto da carga (L-009).
- `EvaluationSession.ts`:
  - novo status `rest` no modo só REST;
  - espera de 8 s pela resposta do WebSocket e depois repetição do mesmo `sequence` por REST;
  - estado `slow` após 4 s sem resposta.
- `evaluationRestClient.ts`: tempo máximo de 75 s, com o código `TIMEOUT`.
- `ConnectionStatusBar` e `BackendEvaluationPanel`: rótulo "Avaliação por REST", "aguardando o
  backend…" e o aviso de que o backend pode estar acordando.
- Escrevi testes:
  - unitários em `tests/application/loadChart/tabulatedBoomLengths.test.ts`, `EvaluationSession.test.ts`, `loadForm.test.ts` e `evaluationRestClient.test.ts`;
  - E2E no navegador em `e2e/tests/simulatorEvaluation.spec.ts`, com catálogo, tabela e avaliação FICTÍCIOS.
- Atualizei `docs/known-gaps.md` (L-004, L-009 e § 7).
- Gravei a captura `docs/assets/screenshots/leva-e/simulador-lanca-tabelada.png`.

## 3. Arquivos modificados

```text
docs/known-gaps.md
frontend/e2e/tests/simulatorEvaluation.spec.ts                       (novo)
frontend/src/app/routes/SimulatorRoute.tsx
frontend/src/app/useTabulatedBoomLengths.ts                          (novo)
frontend/src/application/evaluation/EvaluationSession.ts
frontend/src/application/load/loadForm.ts
frontend/src/application/loadChart/tabulatedBoomLengths.ts           (novo)
frontend/src/domain/evaluation/evaluation.ts
frontend/src/infrastructure/api/evaluationRestClient.ts
frontend/src/presentation/panels/BackendEvaluationPanel.tsx
frontend/src/presentation/simulator/ConnectionStatusBar.tsx
frontend/tests/application/evaluation/EvaluationSession.test.ts
frontend/tests/application/load/loadForm.test.ts
frontend/tests/application/loadChart/tabulatedBoomLengths.test.ts    (novo)
frontend/tests/infrastructure/api/evaluationRestClient.test.ts
docs/assets/screenshots/leva-e/simulador-lanca-tabelada.png          (novo)
handoffs/TASK-050.md, tasks/in-progress/TASK-050-resultado-da-simulacao.md (novos)
```

Fora do escopo: nada. Os arquivos não rastreados da TASK-048 (`docs/apresentacoes/`,
`handoffs/TASK-048.md` etc.) **não** entram nesta branch.

## 4. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ | sem problemas |
| `npm run format:check` | ✅ | All matched files use Prettier code style! |
| `npm run typecheck` | ✅ | sem erros |
| `npm test` | ✅ | `Test Files 71 passed (71)`, `Tests 726 passed / 1 skipped` (antes dos testes de `stepToTabulated`; depois, `tests/application/loadChart` com 24 passed) |
| `npm run build` | ✅ | `built in 1.36s` |
| `npm run e2e` | ✅ | `12 passed`, `11 skipped` (os que exigem backend) |
| backend | ⚠️ NÃO EXECUTADO | o backend não mudou |

## 5. Decisões tomadas

- Encaixar o slider nas colunas, em vez de interpolar ou de escolher a coluna inferior: não cria
  regra de capacidade (RN-004 e RN-008), e o backend continua sendo a única fonte do resultado.
- Os tempos (8 s, 4 s e 75 s) são PROVISÓRIOS e técnicos. Os 75 s cobrem o backend do Render
  acordando (~1 min).
- O `setState` dentro de efeito em `SimulatorRoute` (espelhar a cena depois de encaixar a lança) tem
  `eslint-disable` com a justificativa no código.

## 6. Regras de negócio aplicadas

- RN-004 e RN-008: nenhuma capacidade é calculada no navegador.
- RN-007: fora das colunas o motivo continua aparecendo, quando não há tabela lida.

## 7. O que NÃO foi feito e por quê

- Revisão independente: pendente (AGENTS.md § 3).
- E2E contra a stack com backend: NÃO EXECUTADO (Docker indisponível, L-005).
- Push e PR: aguardando a pessoa confirmar o repositório (`origin` = `Umaiii-chan/JA-Guindastes`).

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? |
|---|----------|-----------|
| 1 | Confirmar que o push e o PR vão para `origin` (`Umaiii-chan/JA-Guindastes`), base `development` | sim, para o PR |

## 9. Próximo passo

**Papel:** Pessoa responsável (merge), depois Implementador (TASK-051).

A leva E segue o plano aprovado em chat em 14/10/2026, uma tarefa por PR:

| Tarefa | Conteúdo |
|--------|----------|
| TASK-051 | Limite de capacidade por modelo e faixas ok, atenção e acima (ADR-022; RN-011) |
| TASK-052 | Cenários persistidos com terreno editável e obstáculos (ADR-023) |
| TASK-053 | Colisões da carga com o chão, o guindaste e os obstáculos (RN-012) |
| TASK-054 | Patolas animadas no modelo 3D (ADR-024). Antes: ver se o FBX de origem tem as peças |
| TASK-055 | Risco de tombamento por regras e área de operação verde, amarela e vermelha (ADR-025; RN-013) |
| TASK-056 | Acessórios com modelos 3D de terceiros, com cada download confirmado em chat (ADR-026; RN-014) |
| TASK-057 | Gravar, salvar e reproduzir simulações (ADR-027) |

**Ler primeiro:** `AGENTS.md`, este handoff e `docs/known-gaps.md`.
