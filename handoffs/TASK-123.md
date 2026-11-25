# Handoff — TASK-123 — implementação (tandem quando o guindaste sozinho está na faixa de atenção)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-123.md`; `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data** | 2026-11-25 |
| **Tarefa** | `tasks/in-progress/TASK-123-tandem-na-faixa-de-atencao.md` |
| **Etapa concluída** | implementação com testes |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-123-tandem-na-faixa-de-atencao`, a partir de `development` @ `4e3c62e` |

## 1. O que foi feito

- `backend/app/application/use_cases/recommend_lift_plan.py` (`execute`): com guindaste sozinho
  válido, compara a utilização do melhor com `warning_band_percent` do modelo; se está na faixa,
  chama `_plan_tandem` e, havendo tandem válido, devolve os tandems (até `MAX_TANDEM_RESULTS`)
  seguidos dos singles, com uma nota explicando.
- `frontend/src/presentation/simulator/PlanningPanel.tsx`: aviso "Recomendamos operar com 2
  guindastes" também quando a lista começa por tandem e tem guindaste sozinho válido.
- Testes: `test_single_na_faixa_de_atencao_recomenda_o_tandem_primeiro_e_mantem_o_single`,
  `test_single_abaixo_da_faixa_de_atencao_nao_tenta_o_tandem` (backend) e um caso novo em
  `planningPanel.test.tsx`.
- `docs/decisions/ADR-056-...md` (Proposto) e a linha no índice.

## 2. Comandos executados (saída real, resumida)

- Catálogo fictício dos testes, viga 10 × 0,6 × 0,8 m, entrega a 3 m: 3.500 kg → só single (89 %);
  3.750 kg → tandem (66 %) e depois single (95 %); 4.000 kg → só tandem (comportamento anterior).
- Backend: `ruff check .`, `ruff format --check .`, `mypy app` (`no issues found in 183 source files`),
  `lint-imports` (`3 kept, 0 broken`), `pytest -q` (passa; integração com banco pulada).
- Frontend: `npx vitest run tests/presentation/simulator/planningPanel.test.tsx` (7 passam),
  `npm run lint`, `npm run typecheck` sem erros. A suíte inteira do frontend e o build: ver o CI.

## 3. Decisões

- Gatilho na faixa de atenção e tandem primeiro com o single mantido: escolha da pessoa responsável.
- Tandem válido vem primeiro mesmo com utilização alta; não há comparação entre o tandem e o single.

## 4. O que NÃO foi feito

- Não testado na tela. O caso real que motivou (89 % com um guindaste de teste E2E, já apagado do
  banco local) não foi reproduzido com o mesmo cenário.
- `docs/business-rules.md` não foi alterado (protegido).
- Translações longas continuam sem par viável (ADR-055, passo 2 em aberto): nesses casos o gatilho
  dispara, mas não acha tandem, e a resposta é a de antes.

## 5. Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff `development...task/TASK-123-tandem-na-faixa-de-atencao`.
