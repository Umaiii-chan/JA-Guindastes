# Handoff — TASK-026 — implementação

> Handoff próprio da TASK-026 (leva A, tarefas em paralelo). `handoffs/current.md` não foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 17:05 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-026-glb-e-cinematica.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma só sessão; a revisão deve ser de outra sessão/ferramenta) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), agente em segundo plano num git worktree isolado |
| **Branch** | `task/TASK-026-glb-e-cinematica` @ `9708965` (+ o commit deste handoff), a partir de `a5b1ab0` |
| **Duração aproximada** | 60 min (com uma interrupção por limite de uso) |

---

## 1. Objetivo desta etapa

Carregar GLB/glTF no frontend, mapear os nós do asset para os papéis do `CraneController` com
relatório de problemas e conferência de calibração, e versionar um modelo de exemplo FICTÍCIO.

## 2. O que foi feito

- Criei a branch com `git switch -c task/TASK-026-glb-e-cinematica a5b1ab0`; `git log -1` →
  `a5b1ab0 chore(protocolo): permitir até 15 tarefas em paralelo e abrir a leva A (TASK-021)`.
- `frontend/src/three/loaders/loadGltf.ts`: `parseGltf(ArrayBuffer | string)` e `loadGltf(url, {fetch?,
  signal?})` com `GLTFLoader` de `three/addons/loaders/GLTFLoader.js` (three 0.186 exporta `./addons/*`).
  Devolvem `{ scene, animations, asset, sourceNodeNames }`; erros são `GltfLoadError` com `code`
  `invalid-file` | `network-error` | `http-error` (+ `url`, `status`, `cause`).
- `frontend/src/three/crane/craneKinematics.ts`: `mapCraneKinematics(assetRoot, config, {sourceNodeNames?})`
  (o `CraneKinematics` da doc-fonte § 10.2). Config: mapa papel → nome do nó
  (obrigatórios `turret`, `boom`, `boomTip`, `cable`, `hook`; opcionais `base`, `boomExtension`,
  `cableLine`), a e h, L_min e tolerâncias de calibração. Devolve `{ ok, rig?, report }`, nunca lança
  por problema do asset:
  - `errors` (impedem o rig): `missing-node`, `duplicate-node` (na cena ou nos nomes do arquivo, porque o
    GLTFLoader renomeia repetidos para `nome_1`), `invalid-hierarchy`, `invalid-config`;
  - `warnings` (calibração; o rig é montado, erro só visual — ADR-013 C-4, regra 3): `position` (torre
    fora do eixo, P ≠ (0, h, a), T ≠ (0, h, a + L_min), extensão não recolhida, cabo fora da ponta,
    gancho fora da vertical), `rest-rotation`, `scale` (≠ 1 em relação à raiz do asset) e `unit` (razão
    ≈ 1000 ou 100 entre a lança medida e L_min → "parece estar em milímetro/centímetro");
  - `synthesizedRoles`: `boomExtension` e `cableLine` ausentes viram nós vazios; `base` ausente usa a
    raiz do asset.
- O `CraneRig` montado é o mesmo tipo que o `CraneController` já usa; `CraneController.ts` **não mudou**.
- `assets/example-models/guindaste-provisorio.ficticio.glb` (63 560 bytes): `createProvisionalCrane()`
  exportado com `GLTFExporter`, pose de repouso, rótulo FICTÍCIO em `extras` do nó `crane-base`.
  Gerado por `frontend/tests/three/loaders/exampleModel.test.ts` com `UPDATE_EXAMPLE_GLB=1`; sem a
  variável o teste confere que o arquivo continua em dia com o guindaste provisório. Geração
  determinística (mesmo SHA-256 `99afc292…825a` ao regenerar).
- `assets/example-models/README.md`: rótulo FICTÍCIO, hierarquia de nós, como regenerar e requisitos
  para um GLB real (doc-fonte § 12.1 + o que o mapeamento confere).
- Testes: `tests/helpers/exampleModel.ts` (leitura do GLB e exportação com substituto mínimo de
  `FileReader`, que o Node não tem), `tests/three/loaders/loadGltf.test.ts` (12),
  `tests/three/loaders/exampleModel.test.ts` (4 + 1 de geração, pulado por padrão),
  `tests/three/crane/craneKinematics.test.ts` (21). Total: 159 passam, 1 pulado (eram 122).

## 3. Arquivos modificados

`git diff --stat a5b1ab0...HEAD` (antes do commit deste handoff):

```text
 assets/example-models/README.md                    |  71 +++
 .../guindaste-provisorio.ficticio.glb              | Bin 0 -> 63560 bytes
 frontend/src/three/crane/craneKinematics.ts        | 539 +++++++++++++++++++++
 frontend/src/three/loaders/loadGltf.ts             | 164 +++++++
 frontend/tests/helpers/exampleModel.ts             |  57 +++
 frontend/tests/three/crane/craneKinematics.test.ts | 377 ++++++++++++++
 frontend/tests/three/loaders/exampleModel.test.ts  |  96 ++++
 frontend/tests/three/loaders/loadGltf.test.ts      | 117 +++++
 tasks/in-progress/TASK-026-glb-e-cinematica.md     | 137 ++++++
 9 files changed, 1558 insertions(+)
```

Mais `handoffs/TASK-026.md`. Fora do escopo: nenhum. `package.json`/`package-lock.json` intactos (sem
dependência nova); `App.tsx`, `presentation/`, `backend/`, Docker, `docs/`, `README.md` e
`handoffs/current.md` não foram tocados. O GLB entrou como binário (`git diff --numstat` → `-  -`).

## 4. Comandos executados e resultados

Em `frontend/` (Node v24.19.0, npm 11.17.0), exceto o check-structure (raiz).

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm ci` | ✅ | `found 0 vulnerabilities` |
| `npm run lint` | ✅ | `eslint .` sem problemas |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b` sem erros |
| `npm test` | ✅ | `Test Files  11 passed (11)` · `Tests  159 passed \| 1 skipped (160)` |
| `npm run build` | ✅ com aviso | `dist/assets/index-C7Gnn9Rf.js 791.01 kB │ gzip: 210.97 kB` · `✓ built` · aviso de chunk > 500 kB (o mesmo de antes; bundle idêntico, os módulos novos ainda não são importados pela tela) |
| `UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts` (2×) | ✅ | `Tests  5 passed (5)`; `sha256sum` igual antes e depois |
| `bash scripts/check-structure.sh` | ✅ | antes do handoff: `FALHOU: 1 erro` (`TASK-026 sem handoff`); depois: `OK: 0 erros, 1 aviso(s)` (aviso: `há 3 tarefas em tasks/in-progress/`) |

Nenhum servidor foi iniciado.

## 5. Decisões tomadas

- **a, h e L_min entram pela configuração, não pelo GLB** (RN-003; ADR-013 C-4, regra 1).
  `rig.boomRetractedLengthM` = L_min da configuração; o comprimento medido no asset só é comparado.
- **Divergência de calibração é aviso, não erro** (ADR-013 C-4, regra 3: "o erro é só visual"). Quem
  integrar decide se recusa o asset (Pendência 2).
- **Tolerâncias de calibração sem valor padrão** (parâmetro obrigatório), porque a tolerância de
  engenharia ainda não existe (G-7). Testes usam 1e-6 m / 1e-6° (só ponto flutuante; as transformações
  dos nós ficam no JSON do GLB com precisão dupla). A escala é aceita se |s − 1| · L_min ≤ tolerância de
  posição (regra derivada, documentada no código).
- **Papéis obrigatórios**: `turret`, `boom`, `boomTip`, `cable`, `hook` — o controller precisa de um
  pivô de cabo que contra-gire a lança. `boomExtension` e `cableLine` opcionais com nó vazio sintetizado
  (lança fixa: a faixa de L deve ser fixa); `base` opcional (raiz do asset). A ponta é reparentada na
  extensão sintetizada com `attach` (mantém a pose de mundo).
- **Nomes comparados após o saneamento do GLTFLoader** (`PropertyBinding.sanitizeNodeName`), para o
  mapa poder usar os nomes do arquivo.
- **Pose de repouso**: só a do ADR-013 C-4, regra 4; outra pose é avisada (`rest-rotation`), não
  compensada (Pendência 1).
- **Gerador do GLB como teste** (não script em `frontend/scripts/`): `tsconfig.app.json` só inclui
  `src` e `tests`, e sem `tsx`/`vite-node` um script TS importando `src/` não roda sem dependência nova.
- **Heurística de unidade** (razão a 2 % de 1000 ou 100): só gera aviso com dica; não converte nada.

## 6. Regras de negócio aplicadas

- RN-003 — o arquivo 3D não fornece dado de cálculo; teste "não lê a geometria de cálculo do asset".
- RN-008 — nada de capacidade/segurança no frontend; o mapeamento só monta o rig visual.

## 7. O que NÃO foi feito e por quê

- Integração na tela (seleção/carregamento do modelo, exibição do relatório): leva B, por protocolo.
- Upload, storage, cadastro `Crane3DModel`, versão rastreável e limite de polígonos (doc-fonte § 12,
  § 12.1): sem decisão nem backend nesta tarefa.
- Recursos externos de `.gltf` (buffers/texturas em arquivos separados): o `resourcePath` é passado,
  mas não há teste com arquivo externo (Node sem servidor de arquivos).
- Teste visual no navegador: NÃO EXECUTADO (nada muda na tela).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Suportar GLB em pose de repouso diferente (ângulos de repouso no `CraneKinematics`, ADR-013 C-4, regra 4)? Exige mudar o `CraneController` (hoje escreve rotações absolutas) | não | | |
| 2 | Avisos de calibração devem bloquear o uso do asset na tela (leva B), ou só aparecer? E qual tolerância usar (G-7)? | não | | |
| 3 | Onde fica o mapa papel → nome do nó em produção (cadastro no backend junto com `Crane3DModel`?) | não | | |
| 4 | Limite de tamanho/polígonos do GLB e regras de segurança do upload (P-008) | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar (o loader não faz upload; dados todos FICTÍCIOS).

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta); depois, pessoa responsável (PR e merge).

**O que fazer, concretamente:**
1. Revisar `git diff development...task/TASK-026-glb-e-cinematica` com o § 11.
2. Leva B: usar `loadGltf` + `mapCraneKinematics` na montagem da cena (`buildCraneScene`/
   `mountCraneScene`) e mostrar o relatório na UI.

**Mudanças de documentação necessárias (não feitas, por protocolo):**
- `docs/architecture.md`: registrar `frontend/src/three/loaders/` (loader GLB/glTF) e
  `craneKinematics.ts` (mapeamento `CraneKinematics`), e a pasta `assets/example-models/` na raiz.
- `docs/development-guide.md` § 3/§ 4: comando de regeneração do GLB de exemplo
  (`UPDATE_EXAMPLE_GLB=1 npx vitest run tests/three/loaders/exampleModel.test.ts`) e a pasta `assets/`.
- `docs/testing-strategy.md`: testes de mapeamento/calibração sobre o GLB de exemplo FICTÍCIO.
- `docs/known-gaps.md` L-002: citar que há um GLB de exemplo FICTÍCIO e que os requisitos do GLB real
  estão em `assets/example-models/README.md`; P-008 continua aberto.
- `README.md`: mencionar `assets/example-models/` na estrutura do repositório.
- `handoffs/current.md`: TASK-026 na tabela de tarefas em andamento.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-026-glb-e-cinematica.md` § 3
4. `frontend/src/three/crane/craneKinematics.ts` (lógica principal)
5. `assets/example-models/README.md`

**Cuidado com:**
- `mapCraneKinematics` altera a cena quando sintetiza nós; chame-o uma vez por asset carregado.
- O GLB é gerado a partir de `createProvisionalCrane()`: se o guindaste provisório mudar, o teste de
  conferência falha até regenerar o arquivo.

## 11. Como revisar este trabalho

- Comece por `craneKinematics.ts` → `checkCalibration` (referenciais: posições medidas na base; escala
  medida na raiz do asset).
- Menos certeza: o critério de escala derivado (|s − 1| · L_min) e a heurística de unidade.
- `craneKinematics.test.ts` cobre o controller no rig importado em 162 estados (e na lança fixa com nós
  sintetizados); não cobre asset com nós intermediários entre os papéis.
