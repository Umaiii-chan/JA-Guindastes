# Handoff — TASK-059 — interpolação linear provisória

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (Opus 5.5) |
| **Branch** | `task/TASK-059-interpolacao` (sobre `task/TASK-050-lanca-livre`, PR #4) |

## O que foi feito

- Backend:
  - `LinearInterpolationLookup` e `InterpolatedCapacityFound` (ADR-030);
  - estratégia `LINEAR_INTERPOLATION_PROVISIONAL`;
  - `interpolated_points` nas respostas REST e WS;
  - a composição passou a usar a interpolação.
- Frontend: o HUD mostra a marca "interpolado entre pontos da tabela (ADR-030)" e a estratégia.
- Ajustei os testes existentes que fixavam o contrato (o campo novo, o enum e a estratégia da
  composição).

## Comandos

| Comando | Resultado |
|---------|-----------|
| backend `ruff check`, `ruff format`, `mypy app` | ✅ |
| backend `pytest` | ✅, exceto `test_create_admin::invalid_database_url`, que já falha localmente |
| frontend `lint`, `tsc -b`, `vitest tests/presentation` | ✅ 163 passed |

## Testes a escrever depois (pedido da pessoa: priorizar entrega)

- Domínio da `LinearInterpolationLookup`:
  - ponto exato;
  - raio entre pontos;
  - lança entre colunas;
  - abaixo da menor coluna;
  - acima da maior coluna;
  - coluna que não cobre o raio;
  - invariante do resultado.
- REST/WS: `interpolated_points` preenchido.
- Frontend: a marca de interpolado no `BackendEvaluationPanel`.
- Seed da demo: os valores do roteiro (`docs/demo.md`) mudam com a interpolação. Atualizar a tabela
  de cenários e `tests/test_demo_seed.py` (hoje esse teste usa a estratégia injetada).

## Próximo passo

A pessoa revisa e mergeia (depois do PR #4).
