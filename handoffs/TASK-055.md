# Handoff — TASK-055 (risco de tombamento e área de operação)

- Etapa: implementação completa (planejador, testes e implementador: Claude Code, mesma sessão).
- Depende do PR #3 (TASK-050) e do commit de contratos da leva E.

## O que mudou

Backend: `domain/services/safety_assessment.py`, `domain/value_objects/safety_profile.py`,
`application/ports/safety_profile_provider.py`, `application/use_cases/compute_operating_area.py`,
`presentation/api/operating_area.py`; mudanças aditivas em `evaluate_operation.py`,
`evaluation_schemas.py`, `evaluation_messages.py`, `websocket/evaluation.py`, `evaluations.py`,
`api/main.py` e `app/main.py`. Frontend: `domain/evaluation/operatingArea.ts`,
`infrastructure/api/operatingAreaRestClient.ts`, `infrastructure/shared/evaluationSafety.ts`,
`three/scene/OperatingAreaOverlay.ts` (+ `setOperatingArea`), `app/useOperatingArea.ts`,
`presentation/simulator/OperatingAreaToggle.tsx`, selo e alertas no `BackendEvaluationPanel`.

## Decisões

- Padrões fictícios (100 %, 90 %, 1,0°) atrás de `SafetyProfileProvider`; **a TASK-051 precisa
  ligar a porta** (em `app/main.py`, `build_evaluate_operation` e `build_compute_operating_area`).
- Contrato alterado: toda resposta de avaliação tem `tipping_risk` e `alerts` (INFO quando as entradas
  faltam); ajustados `tests/test_composition.py` e `test_openapi_evaluations.py` e dois testes do frontend.
- O frontend ainda não envia `outriggers` nem `ground_slope_deg` (vêm da TASK-054/052).
- Fora do escopo: giro fora dos limites da ficha não é marcado na grade.

## Verificação (saída real)

- backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports`, `pytest` passaram
  (exceto o teste conhecido de `test_create_admin`, desselecionado).
- frontend: `lint`, `format:check`, `typecheck`, `npm test` (755 passaram) e `build` passaram.
- `npm run e2e`: NÃO EXECUTADO (prioridade mudou para entrega rápida).

## Testes a escrever depois

- e2e com `page.route` do liga/desliga da área e do selo de risco, e capturas em
  `docs/assets/screenshots/leva-e/`.
- Integração da composição com banco para `operating-area` (zonas, sessão exigida, 401/403).
- Teste de `RED` por zona sem tabela ativa e na fronteira entre zonas na área de operação.
- Teste do `SimulatorRoute` com o toggle ligado.

(Já existem testes unitários de domínio, REST, WebSocket, clientes, overlay, hook e painel.)

## Próximo passo

Revisor (outra sessão) conferir; TASK-051 ligar o perfil de segurança ao catálogo.
