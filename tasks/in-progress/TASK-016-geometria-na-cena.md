# TASK-016 — Pré-visualizar a geometria do ADR-013 na cena 3D

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva TASK-015..017, commit `d5eedab`) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-016-geometria-na-cena` (a partir de `d5eedab`, commit-base da leva) |
| **PR** | — |
| **Requisitos** | RF-015 (raio e altura do gancho em tempo de execução, só como pré-visualização); RNF-002; RNF-003; doc-fonte §§ 12.2 e 17.3 (`getOperationalGeometry()`) |
| **Regras de negócio** | RN-003, RN-008 (o frontend não é fonte de verdade: capacidade e segurança não são decididas aqui) |
| **Estimativa** | M |

---

## 1. Objetivo

Quem mexe nos sliders do guindaste provisório vê, num painel ao lado da cena, o raio de trabalho, a
altura da ponta e a altura do gancho calculados pelas fórmulas do ADR-013, rotulados como
pré-visualização do frontend. O gancho desenhado na cena fica exatamente no ponto G calculado.

## 2. Contexto

- ADR-013 (Aceito): eixos (Y para cima, +Z para a frente do chassi), zero e sentido dos ângulos,
  parâmetros a e h, fórmulas (1)–(5) e simplificações S-1..S-8. A C-7 diz que o backend é a fonte de
  verdade da geometria; o frontend pode calcular a mesma geometria **só para pré-visualização**, e
  `getOperationalGeometry()` devolve o resultado das fórmulas, nunca a posição lida de nós do GLB.
- TASK-013 entregou a PoC Three.js (`CraneController` com clamp e guindaste provisório). Pendência 1
  do handoff dela: com o ADR-013 decidido, entra `getOperationalGeometry()` numa tarefa nova (esta).
- TASK-014 entregou o cálculo de referência no backend
  (`backend/app/domain/services/geometry_service.py`) e os casos calculados à mão em
  `backend/tests/domain/test_geometry_service.py`, que esta tarefa repete no Vitest (paridade).
- ADR-005: componentes React não importam `three` (regra do ESLint).
- Tarefa paralela às TASK-011 e TASK-015 (backend, `docker-compose.yml`, `.env.example`,
  `docs/development-guide.md`, `docs/architecture.md`) e TASK-017 (`docs/*.md` e partes do backend).
  Esta tarefa toca só `frontend/`, este arquivo e `handoffs/TASK-016.md` (regra da TASK-006).
- Decisões da pessoa responsável em 2026-09-26 (chat): parâmetros a e h FICTÍCIOS no guindaste
  provisório; nenhuma dependência nova; testes de paridade com os mesmos casos do backend.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o estado atual do `CraneController` e os parâmetros geométricos FICTÍCIOS (a, h)
  do guindaste provisório, quando chamo `getOperationalGeometry()`, então recebo R = a + L·cos θ,
  y_T = h + L·sin θ, y_G = y_T − c, raio de trabalho = R e as posições P, T e G da fórmula (5) do
  ADR-013; o valor muda depois de cada `set*`.
- [ ] **CA-2** — Dados os casos calculados à mão em `backend/tests/domain/test_geometry_service.py`
  (mesmas entradas, mesmos parâmetros, mesmas saídas esperadas), quando calculo a geometria no
  frontend, então os resultados batem com tolerância explícita de 1e-9 m (paridade, Vitest).
- [ ] **CA-3** — Dado o giro da torre, quando ψ aumenta, então a lança gira no sentido anti-horário
  visto de cima (componente Y de antes × depois positiva), ψ = 0 aponta a lança para +Z e ψ = 90°
  para +X (lado esquerdo do chassi), no cálculo e na cena.
- [ ] **CA-4** — Dado o guindaste provisório montado com os mesmos a e h usados no cálculo, quando
  aplico qualquer estado dentro dos limites, então a posição de mundo do nó do gancho coincide com G
  (e as dos nós da ponta e da lança com T e P), com tolerância explícita de 1e-6 m.
- [ ] **CA-5** — Dado R < 0 (ponta atrás do eixo de giro), então o raio de trabalho **não** vira |R|:
  o resultado sinaliza "fora do domínio geométrico" (raio `null`), como o ADR-013 C-5 pede.
- [ ] **CA-6** — Dado o frontend rodando, quando mexo nos sliders, então o painel mostra raio de
  trabalho, altura da ponta e altura do gancho atualizados, com o rótulo "pré-visualização —
  frontend" e o aviso de que capacidade e segurança não são decididas no frontend (RN-008) e de que o
  raio é geométrico, sem deflexão (teste manual, § 7).
- [ ] **CA-7** — Componentes React continuam sem importar `three`; `npm run lint`,
  `npm run format:check`, `npm run typecheck`, `npm test` e `npm run build` passam em `frontend/`;
  nenhuma dependência nova no `package.json`; nenhum teste existente quebra.

## 4. Escopo

### Dentro do escopo

- Cálculo puro das fórmulas (1)–(5) do ADR-013 em `frontend/src/domain/geometry/` (sem Three.js),
  com a função do raio isolada (ADR-013 C-3).
- `getOperationalGeometry()` no `CraneController`, com os parâmetros a e h recebidos na construção.
- Guindaste provisório com a e h FICTÍCIOS explícitos, e pivô da lança posicionado a partir deles;
  comentários que amarram o mapeamento graus → rotação às convenções do ADR-013.
- Painel React da geometria (pré-visualização) e ajuste dos avisos da UI.
- Testes Vitest: paridade com o backend, sentido do giro e coincidência do nó do gancho com G.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Integração com o backend (REST/WebSocket), troca do valor provisório pelo oficial, capacidade,
  utilização, status e alertas.
- Arquivo único de casos de paridade compartilhado por pytest e Vitest (exige tocar `backend/`;
  ver Pendências no handoff).
- Validar no frontend as faixas da ficha técnica (é do backend, RN-008); o controller continua só
  limitando (clamp) os comandos.
- Normalizar o giro em [0°, 360°) no estado visual e mudar a faixa do slider (ver Pendências).
- Atualizar `docs/` (arquivos com as TASK-011, 015 e 017; ver Pendências no handoff).
- Testes de componentes React (exigiriam jsdom/Testing Library, dependência nova).

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/domain/geometry/operationalGeometry.ts` | criar | sim |
| `frontend/src/three/crane/{types,CraneController,createProvisionalCrane}.ts` | alterar | sim |
| `frontend/src/three/scene/buildCraneScene.ts` | alterar | sim |
| `frontend/src/presentation/panels/OperationalGeometryPanel.tsx` | criar | sim |
| `frontend/src/presentation/panels/CraneControlPanel.tsx`, `frontend/src/app/{App.tsx,App.css}` | alterar | sim |
| `frontend/tests/fixtures/geometryParityCases.ts` | criar | sim |
| `frontend/tests/domain/geometry/operationalGeometry.test.ts` | criar | sim |
| `frontend/tests/three/crane/operationalGeometryInScene.test.ts` | criar | sim |
| `frontend/tests/three/crane/{CraneController,createProvisionalCrane}.test.ts`, `frontend/tests/three/scene/buildCraneScene.test.ts` | alterar | sim |
| `tasks/in-progress/TASK-016-geometria-na-cena.md`, `handoffs/TASK-016.md` | criar | sim |

## 6. Riscos e dependências

- Depende do ADR-013 (Aceito); itens A VALIDAR (G-1..G-8) podem mudar as fórmulas. O raio fica numa
  função só, como no backend.
- Risco: o valor de pré-visualização ser lido como oficial → rótulo "pré-visualização — frontend",
  aviso RN-008 e parâmetros rotulados FICTÍCIO no painel e no código.
- Risco: frontend e backend divergirem (ADR-013 R-5) → testes de paridade com os mesmos casos; um
  arquivo único de casos fica para tarefa futura (Pendências).

## 7. Teste manual (se houver)

1. Em `frontend/`: `npm ci` (se preciso) e `npm run dev`; abrir a URL do Vite.
   **Esperado:** cena como na TASK-013; à direita, o painel de controles e, abaixo dele, o painel
   "Geometria — pré-visualização — frontend" com raio, altura da ponta e altura do gancho. Na pose
   inicial (0°, 35°, 12,0 m, 5,0 m), com a = −1,2 m e h = 3,3 m FICTÍCIOS: raio 8,63 m, altura da
   ponta 10,18 m, altura do gancho 5,18 m.
2. Mover cada slider.
   **Esperado:** os três valores mudam junto com o guindaste. O giro não muda raio nem alturas. Mais
   inclinação: raio menor, alturas maiores. Mais lança: raio e alturas maiores. Mais cabo: só a
   altura do gancho diminui (cabo 15,0 m na pose inicial: −4,82 m, gancho abaixo do chão, não
   bloqueado).
3. Com giro 90°, olhar de cima.
   **Esperado:** a lança aponta para o lado +X do chassi (a cabine fica na frente, +Z); aumentar o
   giro gira a lança no sentido anti-horário visto de cima.
4. `npm run build && npx vite preview` e abrir a URL. **Esperado:** o mesmo comportamento.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Cálculo puro das fórmulas do ADR-013 e testes de paridade | `src/domain/geometry/`, `tests/domain/`, `tests/fixtures/` | CA-2, CA-3, CA-5 (Vitest) | [ ] |
| 2 | `getOperationalGeometry()` no controller; guindaste provisório com a e h; coincidência do gancho | `src/three/crane/`, `src/three/scene/`, `tests/three/` | CA-1, CA-3, CA-4 (Vitest) | [ ] |
| 3 | Painel da geometria e avisos da UI | `src/presentation/`, `src/app/` | CA-6 (manual); CA-7 (lint) | [ ] |
| 4 | Gates, check-structure e handoff | — | CA-7 | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: testes do `CraneController` e do guindaste provisório
  (o construtor do controller ganha o parâmetro da geometria).
- Regras de negócio aplicáveis: RN-003 (a e h não vêm do modelo 3D), RN-008 (pré-visualização).
- Decisões necessárias: ver Pendências no handoff.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| casos calculados à mão do backend (θ 0/30/60/90/−30, ψ 45/90/180/270, a < 0) | CA-2 | unitário | `frontend/tests/domain/geometry/operationalGeometry.test.ts` | — |
| raio a partir do eixo de giro; raio não depende do giro; gancho abaixo da ponta a c metros; R = 0; y_G < 0 não bloqueado; exemplo da doc-fonte (só o raio) | CA-2 | unitário | idem | — |
| giro anti-horário visto de cima; ψ = 90° no lado +X | CA-3 | unitário | idem e `frontend/tests/three/crane/operationalGeometryInScene.test.ts` | — |
| R < 0: raio `null`, alcance com sinal preservado | CA-5 | unitário | `frontend/tests/domain/geometry/operationalGeometry.test.ts` | — |
| `getOperationalGeometry()` segue o estado do controller | CA-1 | unitário | `frontend/tests/three/crane/CraneController.test.ts` | — |
| nó do gancho (e da ponta e da lança) na posição calculada, nos casos do backend e na cena da PoC | CA-4 | unitário | `frontend/tests/three/crane/operationalGeometryInScene.test.ts` | — |
| painel atualiza com os sliders, rótulo e avisos | CA-6 | manual | § 7 | — |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
