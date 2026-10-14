# TASK-055 — risco de tombamento e área de operação

**Status:** in-progress · **Branch:** `task/TASK-055-tombamento-area` · **ADR:** ADR-025 · **Regras:** RN-011, RN-013

## Critérios de aceite

- CA-1 — `SafetyAssessment` devolve `tipping_risk` e `alerts` (pt-BR); entrada ausente gera INFO.
- CA-2 — REST e WebSocket aceitam `outriggers` e `ground_slope_deg` opcionais e devolvem `tipping_risk` e `alerts`.
- CA-3 — `POST /api/v1/configurations/{id}/operating-area` devolve a grade GREEN/YELLOW/RED (autorização da avaliação).
- CA-4 — frontend: cliente da área, `OperatingAreaOverlay`, `setOperatingArea`, liga/desliga com debounce, selo de risco e alertas no painel.
- CA-5 — testes existentes, lint, tipagem e build passam.
