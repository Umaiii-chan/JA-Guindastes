# TASK-013 — Criar a PoC Three.js com guindaste provisório e controles (só visual)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-010..013, commit `ae2ec66`) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-013-poc-threejs-guindaste` (a partir de `ae2ec66`, commit-base da leva) |
| **PR** | — (a abrir) |
| **Requisitos** | RF-012, RF-013, RF-014 (só no nível visual); RNF-002; Estação 2 "prova de conceito Three.js carregando um guindaste" (doc-fonte § 23) |
| **Regras de negócio** | RN-003, RN-008 (o controller nunca decide capacidade nem segurança) |
| **Estimativa** | M |

---

## 1. Objetivo

Quem abre o frontend vê um guindaste 3D no navegador e consegue girar a torre, inclinar a lança,
estender a lança e mudar o comprimento do cabo com sliders, e orbitar a câmera com o mouse. É uma PoC
visual: nenhum raio, altura ou capacidade é calculado.

## 2. Contexto

- ADR-005: React cuida da UI; a lógica Three.js fica em controllers/adapters em `src/three/`, e
  componentes React não importam o pacote `three` (regra do ESLint desde a TASK-007).
- Doc-fonte § 12.2 (responsabilidades do `CraneController`) e § 17.3 (comandos estáveis
  `setTurretRotation`, `setBoomAngle`, `setBoomLength`, `setCableLength`).
- O GLB real do guindaste não existe (L-002, ADR-008): a PoC usa um guindaste **provisório**
  procedural, com hierarquia de nós que imita a futura.
- ADR-013 (convenções geométricas) está **Proposto**: fórmulas, `getOperationalGeometry()` e as
  convenções dele não entram nesta tarefa.
- Tarefa paralela às TASK-010, 011 (backend, docker-compose, `.env.example`, `docs/development-guide.md`,
  `docs/known-gaps.md`, `docs/architecture.md`) e 012 (`README.md`). Esta tarefa toca só `frontend/`,
  este arquivo e `handoffs/TASK-013.md` (regra da TASK-006).
- Decisões da pessoa responsável em 2026-09-26 (chat): sem dependência nova; testes Vitest em ambiente
  node, sem WebGL; verificação visual no navegador fica como teste manual.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o frontend rodando, quando abro a página, então vejo a cena com chão, grade,
  luzes e o guindaste provisório, e consigo orbitar, aproximar e deslocar a câmera com o mouse
  (teste manual, § 7).
- [ ] **CA-2** — Dado o `CraneController` construído com limites, quando chamo `setTurretRotation`,
  `setBoomAngle`, `setBoomLength` ou `setCableLength` com valor fora da faixa, então o valor é limitado
  (clamp) ao mínimo ou máximo, e o método devolve o valor aplicado.
- [ ] **CA-3** — Dado o `CraneController`, quando aplico cada comando, então a transformação cai no nó
  certo: rotação Y da torre, rotação X da lança, posição Z da extensão (a ponta acompanha), escala Y da
  linha do cabo e posição Y do gancho; o cabo continua na vertical com qualquer giro e inclinação.
- [ ] **CA-4** — Dado o guindaste provisório, então a hierarquia é base → torre → lança → extensão →
  ponta → cabo → gancho, com nomes de nó estáveis.
- [ ] **CA-5** — Dado o painel, quando mexo em cada slider, então o guindaste se move e o valor
  mostrado é o aplicado pelo controller (teste manual, § 7).
- [ ] **CA-6** — Dado que o componente de viewport desmonta, então a cena é liberada (laço de
  renderização parado, controles, geometrias, materiais e renderer liberados, canvas removido); no
  modo dev (StrictMode monta e desmonta duas vezes) fica um único canvas (teste automatizado do
  `disposeObject3D`; restante manual, § 7).
- [ ] **CA-7** — Componentes React não importam `three`; `npm run lint`, `npm run format:check`,
  `npm run typecheck`, `npm test` e `npm run build` passam em `frontend/`, e nenhuma dependência nova
  entra no `package.json`.

## 4. Escopo

### Dentro do escopo

- `frontend/src/three/`: cena (ambiente, câmera, OrbitControls, montagem com dispose),
  `CraneController` e guindaste provisório em `crane/`.
- `frontend/src/presentation/`: viewport, painel de sliders, error boundary da cena.
- `frontend/src/app/App.tsx` (composição) e `App.css`.
- Testes em `frontend/tests/three/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- `getOperationalGeometry()`, cálculo de raio, altura ou posição de referência do gancho, e qualquer
  convenção do ADR-013 tratada como decidida.
- Capacidade, utilização, alertas, integração com backend (REST/WebSocket), carregamento de GLB.
- Testes de componentes React (exigiriam dependência nova, como jsdom/Testing Library).
- Atualizar `docs/architecture.md`, `docs/development-guide.md` e `docs/known-gaps.md` (tocados pelas
  TASK-010/011; ver Pendências no handoff).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/three/crane/{types,CraneController,createProvisionalCrane}.ts` | criar | sim |
| `frontend/src/three/scene/{addEnvironment,buildCraneScene,mountCraneScene,disposeObject3D}.ts` | criar | sim |
| `frontend/src/three/scene/createScene.ts` | alterar (só o comentário) | sim |
| `frontend/src/three/camera/createCamera.ts`, `frontend/src/three/controls/createOrbitControls.ts` | criar | sim |
| `frontend/src/presentation/components/{CraneViewport,SceneErrorBoundary}.tsx`, `frontend/src/presentation/panels/CraneControlPanel.tsx` | criar | sim |
| `frontend/src/app/App.tsx`, `frontend/src/app/App.css` | alterar / criar | sim |
| `frontend/tests/three/{crane,scene,camera}/*.test.ts` | criar | sim |
| `tasks/in-progress/TASK-013-poc-threejs-guindaste.md`, `handoffs/TASK-013.md` | criar | sim |

## 6. Riscos e dependências

- Depende do aceite do ADR-013 para `getOperationalGeometry()` e para as convenções de ângulo (zero,
  sentido) valerem de fato; até lá o mapeamento graus → rotação é só visual e está isolado no controller.
- Risco: medidas e limites FICTÍCIOS confundidos com dados reais → rótulo FICTÍCIO no código, nos
  testes e no painel.
- Risco: bundle de 788 kB (Three.js) gera aviso do Vite (> 500 kB) → só aviso; code-splitting fica
  para tarefa futura (Pendências).

## 7. Teste manual (se houver)

1. Em `frontend/`: `npm ci` (se preciso) e `npm run dev`; abrir a URL do Vite.
   **Esperado:** cabeçalho, cena com chão cinza-esverdeado e grade, guindaste amarelo com lança
   inclinada (35°), cabo e gancho; painel à direita com 4 sliders habilitados (0°, 35°, 12,0 m, 5,0 m).
2. Arrastar com o botão esquerdo na cena, rolar a roda e arrastar com o botão direito.
   **Esperado:** a câmera orbita, aproxima/afasta e desloca; não passa para baixo do chão.
3. Mover cada slider até os extremos.
   **Esperado:** giro de −180° a 180° gira a torre; inclinação de 0° a 80° levanta a lança; comprimento
   de 12,0 m a 22,0 m estende a seção telescópica (a ponta, o cabo e o gancho acompanham); cabo de
   1,0 m a 15,0 m sobe/desce o gancho, sempre na vertical. O valor ao lado de cada rótulo acompanha.
4. No modo dev, no console do navegador: `document.querySelectorAll('canvas').length`.
   **Esperado:** `1` (o StrictMode montou, desmontou e montou de novo sem deixar canvas sobrando), e
   nenhum erro no console.
5. `npm run build && npx vite preview` e abrir a URL. **Esperado:** o mesmo comportamento dos passos 1–3.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Tipos, `CraneController` com clamp e guindaste provisório | `src/three/crane/` | CA-2, CA-3, CA-4 (Vitest) | [x] |
| 2 | Ambiente, câmera, OrbitControls, montagem e dispose da cena | `src/three/{scene,camera,controls}/` | CA-6 (Vitest + manual) | [x] |
| 3 | Viewport, painel e composição no `App` | `src/presentation/`, `src/app/` | CA-1, CA-5 (manual); CA-7 (lint) | [x] |
| 4 | Gates e check-structure; handoff | — | CA-7 | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum fora de `frontend/`; `tests/three/createScene.test.ts`
  continua valendo (`createScene` segue devolvendo cena vazia).
- Regras de negócio aplicáveis: RN-003 e RN-008 (o controller só move a representação visual).
- Decisões necessárias: ver Pendências no handoff (ADR-013, docs compartilhadas, aviso de bundle).

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| clamp acima/abaixo em cada comando, com valor devolvido | CA-2 | unitário | `frontend/tests/three/crane/CraneController.test.ts` | verde |
| estado inicial limitado; faixas inválidas e entradas não finitas rejeitadas | CA-2 | unitário | idem | verde |
| rotação Y da torre, rotação X da lança, posição Z da extensão, escala Y do cabo, posição Y do gancho, cabo vertical | CA-3 | unitário | idem | verde |
| hierarquia e nomes dos nós; integração com o controller | CA-4 | unitário | `frontend/tests/three/crane/createProvisionalCrane.test.ts` | verde |
| cena com luzes, chão, grade e guindaste ligado ao controller | CA-1 | unitário | `frontend/tests/three/scene/buildCraneScene.test.ts` | verde |
| liberação de geometrias e materiais (compartilhados uma vez só) | CA-6 | unitário | `frontend/tests/three/scene/disposeObject3D.test.ts` | verde |
| proporção da câmera | CA-1 | unitário | `frontend/tests/three/camera/createCamera.test.ts` | verde |
| cena visível, órbita, sliders, um único canvas no StrictMode | CA-1, CA-5, CA-6 | manual | § 7 | executado pelo agente (ver handoff) |
| import de `three` fora de `src/three/` barrado | CA-7 | manual (ESLint via stdin) | — | verificado |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
