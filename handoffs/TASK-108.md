# Handoff — TASK-108 (entrega sobre contêiner, carreta prancha e qualquer apoio declarado)

- **Agente/papel:** Claude Code (Sonnet 5.5), implementador. Revisão independente pela Coruja no PR.

## O que foi feito
- **Frontend** (`objectLibrary.ts`): `LoadBedInfo` (capacidade conhecida ou FICTÍCIO), `defaultSize` (medida com que o objeto
  entra no cenário), objetos novos `conteiner-20`, `conteiner-40`, `conteiner-40hc` (ISO 668, mesmo GLB esticado) e
  `carreta-prancha` (GLB gerado por `scripts/build-carreta-prancha.mjs`); o `conteiner` genérico e o caminhão plataforma
  passam a declarar `loadBed`/`loadBedInfo`. `loadBeds.ts` ficou genérico (`modelId`, rótulo, capacidade, `exceedsCapacity`).
  `cargoOperation.ts`: `CargoStatus.bed` e `bedStatusAt`. `cargoGuidance.ts`: `bedNote` (capacidade contra o peso ou rótulo
  FICTÍCIO) e textos do apoio; `SimulatorRoute.tsx` passa o peso. `scenarioDraft.ts`: contêiner ISO com a medida real na IA.
- **Backend** (`library_boxes.py`): `SupportSpec` e `LOAD_SUPPORTS` (espelho de `loadBed`), `support_of`, `bed_contains`,
  `support_top_ratio`, `support_higher_parts` (cabine só no caminhão). `sweep.py`: apoio genérico, `over_capacity`,
  `overloaded_supports`, capacidade só na entrega. `scenario_layout.py`: todo apoio pode ficar no ponto de entrega.
  `recommend_lift_plan.py`: dica por tipo de apoio, recusa por capacidade, notas FICTÍCIO/capacidade. `ai_prompts.py`: ids novos.
- **Paridade:** `backend/tests/fixtures/support_surfaces.golden.json`, conferido por `test_support_surfaces.py` e por
  `supportSurfaces.parity.test.ts`.
- **Docs:** ADR-052 (Proposto), índice de ADRs, `known-gaps.md` L-016, `CREDITS.md` dos objetos, `tasks/in-progress/TASK-108`.

## Verificação (saída real)
- Backend (`backend/`): `uv run ruff check .` e `uv run ruff format --check .` ok; `uv run mypy app`: sem problemas em 177 arquivos;
  `uv run pytest tests -q`: tudo passa (os pulados são os de banco/integração).
- Frontend (`frontend/`): `npm run lint`, `npm run format:check`, `npm run typecheck` sem erros; `npm test`: 139 arquivos,
  1257 passam, 1 ignorado; `npm run build` ok (só o aviso de chunk grande).
- E2E: `E2E_PREVIEW_PORT=5398 npx playwright test -c e2e/playwright.config.ts cargoDelivery`: 1 passed (1,6 min). A 1ª tentativa,
  sem `-c e2e/playwright.config.ts`, falhou por "invalid URL" (uso errado do comando, sem relação com o código).
- NÃO EXECUTADO: `scripts/safe-merge.sh` (o arquivo não existe neste repositório nem no que procurei em `C:/dev` e no perfil).

## Pendências para a pessoa responsável
1. **Capacidade real de cada apoio** (caminhão plataforma, carreta prancha, contêiner): hoje nenhum tem dado, todos são FICTÍCIOS e o
   peso apoiado não é conferido. A ISO 1496-1 não dá capacidade de teto para carga içada (HIPÓTESE, não verificada).
2. **Medidas da carreta prancha** (2,6 × 13 × 1,5 m) são típicas e FICTÍCIAS; confirmar com um modelo real.
3. O **GLB dos contêineres de 20/40 pés** é o mesmo da Kenney esticado: o visual das ondulações e das portas é aproximado.
4. **Aceitar o ADR-052** (e, com ele, a substituição da Decisão 1 do ADR-049).
5. O texto da recusa da caixa "carreta" mudou de propósito (lista os apoios aceitos); um teste do TASK-102 foi atualizado.
