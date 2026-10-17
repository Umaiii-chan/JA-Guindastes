# TASK-090 — tandem avaliado com ambiente, acessórios e gancho no ponto

Achados F-05 e F-16 da auditoria de 2026-10-16 (base `anderson/development` @ `784a9e1`). Regras:
RN-014, RN-015 e RN-016; ADR-013, ADR-034 e ADR-037.

## Critérios de aceite

- [x] **CA-1** — `POST /evaluations/tandem` aceita, por guindaste, `outriggers`, `ground_slope_deg`, `accessory_ids`, `soil_kinds` e `obstacle_conflicts`, e `wind_speed_ms` comum aos dois, com os mesmos tipos da avaliação individual; o caso de uso repassa tudo ao `EvaluateOperation`. Campos ausentes: resultado igual ao de antes.
- [x] **CA-2** — Patolas recolhidas, vento acima do limite, solo fraco ou acessórios mudam o resultado do tandem (RN-015, RN-016).
- [x] **CA-3** — O backend calcula o gancho de cada guindaste no mundo (posição, rumo e geometria do estado) e, com ele a mais de 0,5 m (FICTÍCIO) do ponto de içamento, responde o alerta CRITICAL `TANDEM_HOOK_OFF_POINT` e `tandem_ok = false`; testado com rumo e giro diferentes de zero.
- [x] **CA-4** — O frontend manda ao tandem o ambiente de cada guindaste (o do 1 igual ao da avaliação individual; o do 2 pela posição dele), a cadeia de acessórios só no guindaste 1 e os pontos de içamento da carga (não a posição do gancho).
- [x] **CA-5** — No engate e na carga içada, a altura de cada gancho é chão + altura da carga + lingas + distância de G ao engate do gancho em uso + cadeia de acessórios; as lingas saem do fim do gancho. Com o moitão do GLB 80 t (1,965 m abaixo de G), o moitão não entra mais na carga (antes: 0,465 m).

Testes: `backend/tests/presentation/test_evaluations_tandem_environment.py`,
`backend/tests/application/test_evaluate_tandem.py`, `backend/tests/domain/test_tandem_hook_alignment.py`,
`frontend/tests/app/tandemInput.test.ts`, `frontend/tests/three/scene/tandemRigging.test.ts` e
`frontend/tests/domain/tandem/tandem.test.ts`.

## Fora do escopo

- Cadeia de acessórios do guindaste 2 (a tela só tem a do 1).
- Correção do `HookLoad.currentAttachOffsetM` com o moitão trocado (TASK-093).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-17 (PR #47). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
