# TASK-026 — Carregar GLB/glTF e mapear a cinemática do modelo para o CraneController

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva A, pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-026-glb-e-cinematica` (a partir de `a5b1ab0`, commit-base da leva A, TASK-021) |
| **PR** | [#28](https://github.com/Umaiii-chan/JA-Guindastes/pull/28), mergeado em 2026-09-26 |
| **Requisitos** | RF-003, RF-004, RNF-004 (via ADR-008) |
| **Regras de negócio** | RN-003, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

O frontend consegue carregar um modelo 3D em GLB/glTF, localizar nele os nós móveis do guindaste por
um mapeamento configurável e comandá-lo com o mesmo `CraneController` do guindaste provisório, com um
relatório claro quando o modelo não serve.

## 2. Contexto

- ADR-008: o runtime web trabalha com GLB/glTF preparado. Doc-fonte § 12 (fluxo do modelo 3D,
  requisitos do asset § 12.1, responsabilidades do `CraneController` § 12.2) e § 10.2
  (`CraneKinematics`: mapeia nós do GLB para funções do simulador).
- ADR-013: Y para cima, metros, zero e sentido de ψ e θ; a, h e as faixas vêm da ficha técnica, nunca
  do GLB (C-4, regra 1; RN-003); divergência entre asset e ficha é erro só visual (C-4, regra 3); pose
  de repouso recomendada (C-4, regra 4).
- `docs/known-gaps.md` L-002: não há modelo 3D real. Por isso o exemplo é o guindaste provisório
  (TASK-013/016) exportado, rotulado FICTÍCIO (ADR-012).
- Protocolo da leva A (pessoa responsável, 2026-09-26): arquivos exclusivos desta tarefa são arquivos
  novos em `frontend/src/three/loaders/` e `frontend/src/three/crane/`, testes novos em
  `frontend/tests/` e a pasta nova `assets/example-models/`. A integração na tela (App/presentation)
  fica para a leva B. Sem dependência nova, sem tocar backend, Docker nem docs.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o GLB de exemplo como ArrayBuffer, quando `parseGltf` é chamado, então devolve a
  cena com os nós do guindaste, os metadados do `asset` e os nomes dos nós como estão no arquivo.
- [ ] **CA-2** — Dado um conteúdo que não é glTF 2.0 (bytes aleatórios, JSON sem `asset`, versão 1.0,
  GLB truncado, arquivo vazio, glTF sem cena), quando é interpretado, então rejeita com
  `GltfLoadError` de código `invalid-file`; dado `loadGltf(url)`, falha de rede vira `network-error` e
  resposta HTTP de erro vira `http-error` com o status.
- [ ] **CA-3** — Dado o asset e um mapa papel → nome do nó, quando `mapCraneKinematics` é chamado, então
  localiza os nós e monta o `CraneRig`; nós obrigatórios ausentes, nomes duplicados (na cena ou no
  arquivo), hierarquia incompatível e configuração inválida saem num relatório, sem exceção.
- [ ] **CA-4** — Dado um asset fora da ficha técnica (P ou T fora de (0, h, a) e (0, h, a + L_min),
  escala ≠ 1, unidade em milímetros, pose de repouso girada, extensão não recolhida, cabo fora da
  ponta, gancho fora da vertical), quando mapeado, então o rig é montado e o relatório traz avisos de
  calibração.
- [ ] **CA-5** — Dado o rig importado do GLB de exemplo, quando o `CraneController` aplica estados
  dentro dos limites, então P, T e G da cena coincidem com `getOperationalGeometry()` (ADR-013) com
  tolerância de 1e-6 m, como nos testes da TASK-016.
- [ ] **CA-6** — Existe `assets/example-models/guindaste-provisorio.ficticio.glb`, gerado por script
  versionado, com README ao lado rotulando-o FICTÍCIO, descrevendo a hierarquia de nós e os requisitos
  para um GLB real (doc-fonte § 12.1).
- [ ] **CA-7** — Nenhum teste existente quebra; lint, format:check, typecheck, test e build passam em
  `frontend/`; `bash scripts/check-structure.sh` passa.

## 4. Escopo

### Dentro do escopo

- `frontend/src/three/loaders/loadGltf.ts` (novo).
- `frontend/src/three/crane/craneKinematics.ts` (novo).
- `assets/example-models/` (nova): GLB de exemplo FICTÍCIO e README.
- Testes novos em `frontend/tests/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Integração na tela (`App.tsx`, `presentation/`, seleção/upload de modelo): leva B.
- Upload para storage, cadastro `Crane3DModel`, segurança de upload (P-008), backend.
- Pose de repouso diferente da do ADR-013 C-4, regra 4 (ângulos de repouso no mapeamento).
- Atualizar `docs/` e `README.md` (listado no § 10 do handoff).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/three/loaders/loadGltf.ts` | criar | sim |
| `frontend/src/three/crane/craneKinematics.ts` | criar | sim |
| `assets/example-models/guindaste-provisorio.ficticio.glb` | criar | sim |
| `assets/example-models/README.md` | criar | sim |
| `frontend/tests/helpers/exampleModel.ts` | criar | sim |
| `frontend/tests/three/loaders/exampleModel.test.ts` | criar | sim |
| `frontend/tests/three/loaders/loadGltf.test.ts` | criar | sim |
| `frontend/tests/three/crane/craneKinematics.test.ts` | criar | sim |

## 6. Riscos e dependências

- Depende de: modelo real (L-002) para validar os requisitos com um asset de verdade.
- Risco: GLB real em outra pose ou com eixos de CAD (Z para cima) → avisos de calibração; suporte a
  ângulos de repouso fica como pendência.
- Risco: o `GLTFExporter` usa `FileReader`, que o Node não tem → substituto mínimo só no helper de
  teste que gera o exemplo.

## 7. Teste manual (se houver)

Não se aplica nesta tarefa: nada muda na tela (a integração é da leva B).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Loader com erros classificados | `src/three/loaders/loadGltf.ts` | `loadGltf.test.ts` | [x] |
| 2 | Mapeamento cinemático + calibração | `src/three/crane/craneKinematics.ts` | `craneKinematics.test.ts` | [x] |
| 3 | GLB de exemplo gerado por teste + README | `assets/example-models/`, `tests/three/loaders/exampleModel.test.ts` | teste de conferência | [x] |
| 4 | Gates e handoff | — | § 4 do handoff | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só arquivos novos; `CraneController.ts` não mudou).
- Regras de negócio aplicáveis: RN-003 (a, h e L_min vêm da configuração, não do GLB), RN-008.
- Decisões necessárias: ver § 8 do handoff.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| parse do GLB de exemplo e de .gltf JSON | CA-1 | unitário | `tests/three/loaders/loadGltf.test.ts` | verde |
| arquivo inválido, rede, HTTP | CA-2 | unitário | `tests/three/loaders/loadGltf.test.ts` | verde |
| nós, ausentes, duplicados, hierarquia, config | CA-3 | unitário | `tests/three/crane/craneKinematics.test.ts` | verde |
| avisos de calibração | CA-4 | unitário | `tests/three/crane/craneKinematics.test.ts` | verde |
| controller no rig importado × ADR-013 (162 estados) | CA-5 | unitário | `tests/three/crane/craneKinematics.test.ts` | verde |
| GLB existe, rotulado, em dia com o provisório | CA-6 | unitário | `tests/three/loaders/exampleModel.test.ts` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

—

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

—
