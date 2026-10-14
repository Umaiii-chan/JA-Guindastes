# Handoff — TASK-064 — implementação

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-064-modelo-guindaste-80t.md` |
| **Etapa concluída** | implementação (prioridade: entrega rápida; testes só do essencial) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-064-modelo-guindaste-80t` (a partir de `anderson/development`) |
| **Decisão** | ADR-031 |

## 1. Objetivo

Trocar o guindaste 3D por um modelo gratuito com patolas de verdade (CC BY 4.0).

## 2. O que foi feito

- `frontend/scripts/convert-crane-80t.mjs`: confere o SHA-256 da entrada, poda o campo de petróleo e a
  animação, reescreve o GLB no referencial do simulador e nos nós do contrato (`crane-*`,
  `crane-outrigger-*`), reduz texturas a 1024, `dedup`/`prune`/`join` e quantiza. Determinístico
  (duas execuções, mesmo SHA). Saída: `public/models/guindaste-80t.glb`, 4,29 MB.
- **Dependências novas (devDependencies):** `@gltf-transform/core`, `@gltf-transform/functions`,
  `@gltf-transform/extensions` (4.5.1) e `sharp` (redimensiona as texturas). Só o conversor e os testes
  usam; o bundle não muda.
- Calibração: escala 1,138 (h = 3,3 m); eixo de giro 2,0 m à frente da torre original, para a = −1,56 m
  sem mexer na ficha de demo (a conferência passa sem aviso). Ver o efeito no ADR-031.
- Lança com as 4 seções: a seção 4 e a cabeça vão na extensão; `updateTelescope` (loader, chamado em
  `afterCommand`) reparte as seções 2 e 3.
- Patolas: o GLB sai recolhido e com os macacos suspensos; `mountCraneScene` passa
  `beamTravelM: TRUCK_CRANE_OUTRIGGER_TRAVEL_M` ao `OutriggerController`. O `OutriggerController` não
  mudou.
- Olho do operador em `extras.olhoDoOperador` da torre (`rigLandmarks.findOperatorEye`).
- Créditos: `public/models/CREDITS.md` e linha na Ajuda (`HelpButton.tsx`).
- Testes: `tests/helpers/craneGlb.ts` lê o GLB sem texturas (o GLTFLoader não decodifica imagem no
  Node); `truckCraneModel.test.ts` (SHA, nós, calibração, patolas, telescópio) e
  `upgradeCraneModel.test.ts` adaptados.
- E2E `collision.spec.ts`: o corte do cabo (4,5175 m) agora cai abaixo do passo do slider (0,5 m) e o
  controle reenvia 4,5, que é seguro e apaga o alerta «comando bloqueado» na hora (antes o corte caía
  acima do passo e o alerta ficava). O teste passou a conferir só que o cabo parou e a altura do
  gancho; o alerta segue coberto pelos testes de componente.
- Capturas em `docs/assets/screenshots/leva-e/guindaste-80t-*.png` (Chromium com WebGL por software,
  cena montada com a ficha FICTÍCIA padrão).

## 3. Comandos

| Comando | Resultado |
|---------|-----------|
| `node scripts/convert-crane-80t.mjs <entrada>` | 4,29 MB; SHA-256 `9292432f9c9c3d3fda5482e98ac3393773b45eb077dbb994becd6931247f98a1` |
| `npm run lint` / `format:check` / `typecheck` | passou |
| `npm test` | 86 arquivos, 816 passaram, 1 pulado |
| `npm run build` | passou |
| `E2E_PREVIEW_PORT=5274 npm run e2e` | 15 passaram, 11 pulados (precisam de backend) |

Validação no navegador: o guindaste aparece; giro, inclinação, comprimento da lança (com as seções
telescopando), cabo e patolas (vigas estendem 1,71 m para os lados; sapatas descem ao chão) funcionam.

## 4. Armadilhas e pendências

- Com uma ficha de a/h diferente (por exemplo a do e2e, a = 0,8 m; h = 2,6 m), o console avisa
  diferença de calibração (só visual).
- A lança aponta para o lado oposto da cabine do caminhão; a cabeça da lança é escura (textura original).
- Nenhuma cabine/vidro nomeado: o olho do operador vem dos extras.
- `guindaste-caminhao.glb` e `convert-crane-model.mjs` (TASK-043) seguem no repositório, sem uso.
- O original (17 MB) não vai ao Git: `assets/source/sketchfab/guindaste-80t/source/wireline_crane_rig.glb`.
- Ver "Testes a escrever depois" na tarefa.
