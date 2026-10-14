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
- Mudei a regra do backend (ADR-029, decisão da pessoa em chat: "quero trazer uma simulação real"):
  lança entre colunas usa a coluna da **próxima lança mais longa**, como na nota padrão das tabelas
  de fabricante. Acima da maior coluna, `BOOM_LENGTH_ABOVE_CHART_MAX`. Arquivos:
  `backend/app/domain/services/conservative_tabulated_lookup.py` e `capacity_result.py`.
- A primeira versão, que encaixava o slider nas colunas, foi **rejeitada** pela pessoa e removida.
  O slider voltou a ser livre.
- `loadForm.ts`: o peso válido vai para a avaliação sem exigir o resto da carga (L-009).
- `EvaluationSession.ts`:
  - novo status `rest` no modo só REST;
  - espera de 8 s pela resposta do WebSocket e depois repetição do mesmo `sequence` por REST;
  - estado `slow` após 4 s sem resposta.
- `evaluationRestClient.ts`: tempo máximo de 75 s, com o código `TIMEOUT`.
- `ConnectionStatusBar` e `BackendEvaluationPanel`: rótulo "Avaliação por REST", "aguardando o
  backend…" e o aviso de que o backend pode estar acordando.
- Escrevi testes:
  - backend: `tests/domain/test_conservative_tabulated_lookup.py` e os testes de caso de uso, API, WebSocket e seed que esperavam `BOOM_LENGTH_NOT_IN_CHART`;
  - frontend: `EvaluationSession.test.ts`, `loadForm.test.ts` e `evaluationRestClient.test.ts`;
  - E2E no navegador em `e2e/tests/simulatorEvaluation.spec.ts`, com catálogo e avaliação FICTÍCIOS.
- Atualizei `docs/known-gaps.md` (L-004, L-009 e § 7), `docs/architecture.md`, `docs/demo.md` (cenário D) e criei o ADR-029.
- Gravei a captura `docs/assets/screenshots/leva-e/simulador-lanca-livre.png`.

## 3. Arquivos modificados

Ver `git diff --stat anderson/development...HEAD`:
- backend: a consulta conservadora e os testes;
- frontend: a sessão de avaliação, o cliente REST, a carga, o HUD, a barra e o E2E;
- docs: known-gaps, architecture, demo e o ADR-029;
- a captura de tela.

Fora do escopo: nada. Os arquivos não rastreados da TASK-048 não entram nesta branch.

## 4. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ | sem problemas |
| `npm run format:check` | ✅ | All matched files use Prettier code style! |
| `npm run typecheck` | ✅ | sem erros |
| `npm test` | ✅ | `Test Files 71 passed (71)`, `Tests 726 passed / 1 skipped` (antes dos testes de `stepToTabulated`; depois, `tests/application/loadChart` com 24 passed) |
| `npm run build` | ✅ | `built in 1.36s` |
| `npm run e2e` | ✅ | `12 passed`, `11 skipped` (os que exigem backend) |
| backend `uv run pytest` | ✅ (1 falha anterior) | tudo passa, exceto `test_create_admin.py::test_main_with_an_invalid_database_url_does_not_echo_it`, que **também falha na árvore limpa** (ambiente local, não relacionado) |
| backend `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | ✅ | All checks passed · 208 files already formatted · no issues in 114 files · 3 kept, 0 broken |

## 5. Decisões tomadas

- Próxima lança mais longa (ADR-029), em vez de interpolar ou de encaixar o slider: é a leitura de
  tabela da operação real, e não cria valores fora da tabela (RN-004).
- Os tempos (8 s, 4 s e 75 s) são PROVISÓRIOS e técnicos. Os 75 s cobrem o backend do Render
  acordando (~1 min).

## 6. Regras de negócio aplicadas

- RN-004 e RN-008: nenhuma capacidade é calculada no navegador.
- RN-007: fora das colunas o motivo continua aparecendo, quando não há tabela lida.

## 7. O que NÃO foi feito e por quê

- Revisão independente: pendente (AGENTS.md § 3).
- E2E contra a stack com backend: NÃO EXECUTADO (Docker indisponível, L-005).
- PR: https://github.com/Anderson-Sehn3m/JA-Guindastes/pull/3

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? |
|---|----------|-----------|
| 1 | A Guindastes Ribas confirma a nota da tabela oficial para lança entre colunas (ADR-029, PROVISÓRIO)? | não |

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
