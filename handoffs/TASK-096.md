# Handoff — TASK-096

**Agente:** Claude Code (Opus 5.5), papel de implementador. Revisão independente não feita.

- `LinearInterpolationLookup` (`backend/app/domain/services/linear_interpolation_lookup.py`): entre
  colunas, ou abaixo da menor, vale a coluna da próxima lança mais longa (ADR-043); o raio continua
  interpolado só dentro dela. O laço de duas colunas saiu.
- `InterpolatedCapacityFound`: docstring diz 1 ou 2 pontos, da mesma coluna.
- Testes novos: `backend/tests/domain/test_linear_interpolation_lookup.py` (11). Contra o código
  antigo, 4 falham (entre colunas e raio conferido na coluna mais longa).
- Documentação: `docs/decisions/ADR-043-lanca-entre-colunas-na-interpolacao.md` (Aceito), índice
  `docs/decisions/README.md` (ADR-030 "Substituído em parte por ADR-043"), `docs/demo.md`.

## Comandos

- `uv run ruff check .` → All checks passed!
- `uv run ruff format --check .` → 321 files already formatted
- `uv run mypy app` → Success: no issues found in 174 source files
- `uv run lint-imports` → Contracts: 3 kept, 0 broken
- `uv run pytest` → suíte inteira verde (integração com PostgreSQL pulada)
- `bash scripts/check-structure.sh` → falha que já vem da base (mais de 15 tarefas em
  `tasks/in-progress/` e TASK-080 sem handoff); tratada em PR separado.
- Frontend: não mudou (NÃO EXECUTADO).

## Pendências

- A capacidade muda em degrau ao trocar de coluna; é o comportamento esperado pela nota do
  fabricante.
- PEND-001 continua aberta (método oficial de interpolação no raio).
