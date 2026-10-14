# Handoff — TASK-056 — implementação (acessórios de içamento)

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-056-acessorios.md` |
| **Papel** | Implementador (Claude Code) |
| **Branch** | `task/TASK-056-acessorios`, a partir de `leva-e/contratos` |

## Feito
Backend: entidade `Accessory`, portas, `ManageAccessories`, repositório SQLAlchemy, migration (`down_revision = b4e1d7c93a52`), rotas `/api/v1/accessories`, `accessory_ids` em REST e WebSocket, `ACCESSORY_NOT_FOUND`.
Frontend: domínio, cliente REST, `AccessoryPanel` (sob os passos), estado no rascunho, `accessoryIds` no `EvaluationInput` (enviado só se não vazio), parcela no HUD, `AccessoryChain` (GLB por acessório), `computeLoadBox(…, accessoriesDropM)`, `HookLoad.setAccessories`, `setAccessories` no handle e no `CraneViewport`.

## Resultados reais
- Backend: ruff, format, mypy, lint-imports e pytest passaram (integração pulou sem Postgres).
- Frontend: lint, format, typecheck, 727 testes e build passaram; `npm run e2e`: 12 passed, 11 skipped.
- Contrato mudou: respostas ganham `accessories_weight_kg` e `accessories`; ajustei 3 testes frontend, `test_composition` e `test_openapi_evaluations`.

## Decisões a conferir
- Com acessórios, um filete liga o gancho ao ponto das lingas (só distância, não é modelo). Remover se a regra "nada por código" valer para isso.
- Tapete de patola não pende do gancho; deve ter `rigging_height_m` 0.
- Modelo é escalado para `rigging_height_m` quando > 0.

## Modelos 3D (candidatos; NADA baixado; licenças NÃO verificadas)
| Tipo | Título | URL | Autor | Licença | Formato |
|------|--------|-----|-------|---------|---------|
| Balancim | Axzion spreader beam adjustable | https://sketchfab.com/3d-models/axzion-spreader-beam-adjustable-caa573ec049b403385eb7c3134c3c110 | axzion | a verificar | Sketchfab (607 mil tri) |
| Balancim | Metlase Spreader Beam SWL 500kg | https://sketchfab.com/3d-models/metlase-spreader-beam-swl-500kg-28e2a83fa7f04d768ab44d9145dd9668 | GazCollin | a verificar (pode ser pago) | Sketchfab (1,5 mi tri) |
| Linga cabo de aço | Wire tow rope 2 (corda de reboque) | https://sketchfab.com/3d-models/wire-tow-rope-2-57b361cc827a453780c814e60cd362ff | Vinny Passmore | a verificar | Sketchfab |
Sem candidato achado para moitão, bola de peso, gancho giratório, manilha, linga de corrente, cinta e tapete. Fontes a explorar: Poly Pizza, OpenGameArt, Sketchfab filtrado por downloadable/CC0/CC-BY. Confirme cada download em chat.

## Testes a escrever depois
Backend já tem testes; frontend não (por prioridade): `accessorySelection`, `accessoryRestClient`, `readAccessories` (REST e WS), `toEvaluationRequestDto`/`toStateChangedMessage` com `accessoryIds`, `computeLoadBox` com `accessoriesDropM`, `HookLoad.setAccessories`, `AccessoryChain` (empilhamento, carregador falso, falha), `AccessoryPanel`, parcela "Acessórios" do HUD, e2e com `page.route` (GET `/api/v1/accessories`, envio de `accessory_ids`).

## Pendências
Modelos 3D reais; encadear a migration na ordem 051 → 052 → 056 → 057; depende do PR #3 (TASK-050) e do commit de contratos.
