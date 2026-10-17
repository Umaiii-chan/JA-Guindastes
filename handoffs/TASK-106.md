# Handoff — TASK-106 — estabilidade por física (D1)

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-17 |
| **Tarefa** | `tasks/in-progress/TASK-106-fisica-estabilidade.md` |
| **Papel exercido** | Implementador |
| **Branch** | `task/TASK-106-fisica-estabilidade` (base `c84a386`, `anderson/development`) |

## O que mudou

- **Domínio:** `services/stability.py` (estática do polígono: `ρ` por lado, reação por sapata, flecha,
  vento, inclinação) e `value_objects/stability_params.py` (parâmetros FICTÍCIOS). `safety_assessment.py`
  ganha `TIPPING_MARGIN_EXCEEDED`, `OUTRIGGERS_LIFT_OFF`, `STABILITY_NEAR_LIMIT`, `WIND_ABOVE_LIMIT` e
  `WIND_NEAR_LIMIT` (sai `WIND_REDUCES_CAPACITY`). `environment_factors.py` perde `slope_factor`,
  `wind_factor` e `pad_pressure_kpa`.
- **Caso de uso e API:** `EvaluatedOperation.stability`; entrada opcional `load_wind_area_m2` (REST e
  WebSocket); resposta `stability` (REST e WebSocket). `slope_factor` e `wind_factor` seguem no contrato,
  sempre `1`. O planejador não filtra mais sítios por solo (cada estado avaliado confere a sapata).
- **Frontend:** lê `stability`, envia `load_wind_area_m2` (maior face × 1,2, só com a carga pendurada) e
  mostra "Estabilidade" no painel da avaliação.
- **Docs:** RN-017 nova; RN-013 e RN-015 marcadas como substituídas; ADR-050 (Aceito).

## Comandos rodados

- Backend (`backend/`): `uv run pytest`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`.
- Frontend (`frontend/`): `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`.

## Pendências

- **D5:** dados oficiais por modelo (polígono, massas, CG, flecha, velocidade da tabela). Hoje tudo é
  FICTÍCIO e fica em `StabilityParams`, sem coluna no banco.
- Conferir nas normas (ISO 4305, EN 13000, ASME B30.5, e a numeração brasileira) as cláusulas e o fator
  de carga de tombamento: não foram verificados.
- Vento e inclinação entram no pior sentido para todos os lados (o contrato não tem direção).
- `slope_derating_percent_per_deg` do `SafetyProfile` ficou como campo obsoleto (sem migração).
