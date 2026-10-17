# Handoff — TASK-098

**Agente:** Claude Code (Opus 5.5), papel de implementador. Revisão independente não feita.

- `frontend/e2e/tests/rotationZones.spec.ts`: função `liftLoad` (cabo no mínimo) chamada antes de
  cada giro, nos três testes; `expect(turret).toHaveValue('90')` confere que o giro chegou ao fim.
  Causa (captura local): "Colisão: comando bloqueado", a carga atingiria o terreno e o guindaste,
  giro parado em 12°.
- `frontend/e2e/tests/auth.spec.ts`: rota falsa de `/api/v1/ai/status` (IA desligada). Causa (trace
  do CI, run 38996946460): `GET /api/v1/ai/status` → 401 da stack com banco.

## Comandos

- `npx playwright test e2e/tests/rotationZones.spec.ts` (sem backend) → antes: 1 failed; depois:
  2 passed, 2 skipped (os dois com backend só rodam no CI).
- `npx playwright test e2e/tests/auth.spec.ts` (sem backend) → 1 passed, 4 skipped (já passava sem
  backend; a falha só aparece contra a stack, no CI).
- `prettier --check`, `eslint` e `tsc -p e2e` nos dois arquivos → ok.

## Pendências

- Os testes com backend (`rotationZones.spec.ts:192` e `:216`) e o `auth.spec.ts:118` contra a stack
  só podem ser confirmados no CI (o Docker não sobe nesta máquina).
- `collision.spec.ts:34` e `objetosReais.spec.ts:65` também falham na base: são o F-24 da auditoria,
  tratado na TASK-091.
