# Handoff — TASK-067 — implementação

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-067-ambiente-na-avaliacao.md` |
| **Etapa concluída** | implementação (prioridade: entrega rápida; testes só do essencial) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-067-ambiente-na-avaliacao` (a partir de `anderson/development`) |

## 1. Objetivo

Fazer o ambiente (inclinação, solo, vento, obstáculos) influenciar a utilização e o risco (RN-015).

## 2. O que foi feito

- `environment_factors.py` (fatores e constantes), `capacity_limit.py` (fatores e bloqueio),
  `safety_assessment.py` (alertas de solo, vento, obstáculos), `evaluate_operation.py`,
  `compute_operating_area.py`.
- Colunas novas em `cranes` e migration `a9c4e2f7b361` (cabeça anterior `d7a3c5e8f1b4`).
- REST e WS: `soil_kinds`, `wind_speed_ms`, `obstacle_conflicts`; `capacity_limit` com `slope_factor`
  e `wind_factor`.
- Frontend: Drawer do guindaste, clientes REST/WS e painel de resultado.
- Um teste existente mudou: a inclinação de 2° agora também reduz a capacidade e soma o alerta de
  faixa de atenção.
- `docs/business-rules.md`: RN-015 registrada por pedido explícito da pessoa responsável (chat, 2026-10-14).

## 3. Comandos

| Comando | Resultado |
|---------|-----------|
| backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | passou |
| backend: `pytest` | passou (integrações puladas, sem Postgres; `test_create_admin` ignorado) |
| frontend: `lint`, `format:check`, `typecheck`, `build` | passou |
| frontend: `npm test` | 86 arquivos, 815 passaram, 1 pulado |
| frontend: `npm run e2e` | 15 passaram, 11 pulados (precisam de backend) |

## 4. Pendências

A tela do simulador ainda não envia solo, vento e obstáculos (só os tipos e os clientes aceitam).
O cálculo dos obstáculos no raio de giro é do cliente. Ver "Testes a escrever depois" na tarefa.
Depende do PR #3 (TASK-050) e do commit de contratos da leva E.
