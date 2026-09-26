# TASK-043 — Converter o modelo 3D do guindaste (FBX → GLB) com peças móveis e pivôs

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-043-modelo-3d-guindaste` (a partir de `4ddd6a3`) |
| **PR** | — |
| **Requisitos** | doc-fonte § 12 e § 12.1 (modelo GLB com partes móveis e pivôs); `assets/example-models/README.md` ("Hierarquia de nós" e "Requisitos para um GLB real"); known-gaps L-002 |
| **Regras de negócio** | RN-003 (a, h e L_min vêm da ficha, nunca do GLB); ADR-008 (GLB); ADR-012 (rótulo de dado não oficial); ADR-013 C-1, C-3 e C-4 (eixos, pontos P/T/G, pose de repouso) |
| **Estimativa** | M |

---

## 1. Objetivo

Trocar o guindaste de caixas por um modelo 3D de verdade: converter o FBX fornecido pela pessoa
responsável (guindaste sobre caminhão, CGTrader) num GLB em metros, com as peças móveis separadas em
nós, pivôs nas articulações e pose de repouso do ADR-013, pronto para o mapeamento cinemático
(`craneKinematics.ts`) e o `CraneController`.

## 2. Contexto

Leva D. O FBX (`cgtrader_optimized_prop_crane.fbx`) é um "prop": 4 malhas (uma por material), cerca
de 103 mil triângulos, 158 peças soltas, sem animação, lança erguida a cerca de 38°, sem unidade
(1,39 de altura) e materiais sem cor. Paralelas: TASK-041 mexe em `frontend/src/three/**` (esta
tarefa só cria um arquivo novo em `src/three/loaders/`), TASK-039 em páginas, TASK-038 no backend.
A ligação do modelo no `CraneViewport` fica para a integração (sessão principal).

## 3. Critérios de aceite

- [ ] **CA-1** — `frontend/scripts/convert-crane-model.mjs`, rodado com `node` e só com o `three` já
  instalado, converte `assets/source/cgtrader_optimized_prop_crane.fbx` em
  `frontend/public/models/guindaste-caminhao.glb` de forma determinística (duas execuções geram o
  mesmo arquivo). As regras de classificação das peças (chassi, torre, seções da lança, ponta, cabo,
  gancho) estão escritas no próprio script, e ele falha se a contagem de peças por papel mudar.
- [ ] **CA-2** — O GLB está em metros, Y para cima, +Z para a frente, com a hierarquia
  `crane-base → crane-turret → crane-boom → crane-boom-extension → crane-boom-tip → crane-cable →
  (crane-cable-line, crane-hook)`, nós únicos, sem escala e sem rotação nos papéis, pivôs nas
  articulações (eixo de giro, pino do pé da lança, polia da ponta, ponto de suspensão) e lança
  horizontal, para +Z e recolhida.
- [ ] **CA-3** — O GLB traz, nos `extras` do nó base, a origem (arquivo, hash, script) e o aviso de
  modelo ilustrativo; o tamanho e o número de triângulos ficam registrados no handoff.
- [ ] **CA-4** — O FBX não é versionado (`assets/source/` no `.gitignore`).
- [ ] **CA-5** — Um arquivo novo em `frontend/src/three/loaders/` carrega o GLB e devolve a cena com os
  nomes de nós para `CraneKinematicsNodeNames`, usando `loadGltf`/`parseGltf` e
  `mapCraneKinematics` existentes, sem alterar outros arquivos de `src/three/`.
- [ ] **CA-6** — Teste Vitest: o GLB versionado carrega, o mapeamento o aceita sem erro de hierarquia e
  a conferência de calibração com a ficha de demo (a = −1,2 m, h = 3,3 m, L_min = 12 m) só dá os
  avisos esperados e documentados; com o `CraneController`, o gancho desenhado coincide com o G
  calculado e fica na vertical da ponta.
- [ ] **CA-7** — Capturas de conferência visual em `docs/assets/screenshots/modelo-3d/` (repouso, giro
  de 90°, lança a 45°, lança estendida, cabo mais longo), feitas com Playwright numa página temporária
  do Vite (porta 5200–5209, não versionada), citadas no handoff.
- [ ] **CA-8** — Gates do frontend (`lint`, `format:check`, `typecheck`, `test`, `build`) e
  `bash scripts/check-structure.sh` passam; nenhuma dependência nova.

## 4. Escopo

### Dentro do escopo

- `frontend/scripts/convert-crane-model.mjs` (novo);
- `frontend/public/models/guindaste-caminhao.glb` (novo, gerado);
- `frontend/src/three/loaders/loadTruckCraneModel.ts` (novo) e o teste correspondente;
- `docs/assets/screenshots/modelo-3d/*.png`, `.gitignore`, esta tarefa e `handoffs/TASK-043.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- trocar o guindaste provisório no `CraneViewport` ou em `buildCraneScene` (integração);
- alterar outros arquivos de `frontend/src/three/**` (TASK-041), `handoffs/current.md`, ADRs,
  `backend/**`;
- versionar o FBX; dados reais do guindaste; animar o cilindro de levantamento dentro do controller.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/scripts/convert-crane-model.mjs` | criar | sim |
| `frontend/public/models/guindaste-caminhao.glb` | criar | sim |
| `frontend/src/three/loaders/loadTruckCraneModel.ts` | criar | sim |
| `frontend/tests/three/loaders/truckCraneModel.test.ts` | criar | sim |
| `docs/assets/screenshots/modelo-3d/` | criar | sim |
| `.gitignore` | alterar | sim |

## 6. Riscos e dependências

- A proporção do modelo não bate com a ficha de demo: com escala única, h = 3,3 m deixa a lança
  recolhida com cerca de 6 m. A conversão estica os tubos da lança ao longo do eixo para chegar aos
  12 m, e o `a` do modelo diverge da ficha (registrado no handoff).
- Licença do CGTrader: falta a pessoa responsável conferir se permite versionar o GLB derivado e
  distribuí-lo embutido na aplicação.
- O cilindro de levantamento é rígido no FBX; a conversão o separa em dois nós extras, que só
  acompanham a lança se a integração chamar a função de atualização do carregador.

## 7. Teste manual (se houver)

Ver as capturas em `docs/assets/screenshots/modelo-3d/`; regenerar conforme o handoff.
