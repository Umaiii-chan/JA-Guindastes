# TASK-014 — Implementar no domínio o cálculo geométrico do ADR-013

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code; tarefas em paralelo) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | 2026-09-26 |
| **Branch** | `task/TASK-014-geometria-adr-013-impl` (a partir de `3ce9d5f`, o mesmo HEAD de `task/TASK-014-geometria-adr-013`; ver § 2) |
| **PR** | [#13](https://github.com/Umaiii-chan/JA-Guindastes/pull/13), mergeado em 2026-09-26 com CI verde |
| **Requisitos** | RF-015, RNF-002, RNF-004, RNF-008, RNF-010 |
| **Regras de negócio** | RN-003, RN-006, RN-007, RN-008 |
| **Estimativa** | M |

---

## 1. Objetivo

O domínio do backend passa a calcular, só com a biblioteca padrão, o raio de trabalho, a altura da
ponta, a altura do gancho e as posições do pino, da ponta e do gancho a partir do estado operacional
(L, θ, ψ, c) e da ficha técnica geométrica do guindaste, exatamente pelas fórmulas do ADR-013.

## 2. Contexto

- O ADR-013 (convenções geométricas provisórias) foi **aceito pela pessoa responsável em chat**, em
  2026-09-26. O aceite está no commit `3ce9d5f` ("docs(decisions): aceitar ADR-013 por decisão da
  pessoa responsável (TASK-014)"), que é a base desta branch. O ADR é a especificação desta tarefa:
  eixos (C-1), ângulos (C-2), pontos, raio e altura (C-3), parâmetros do guindaste (C-4), fórmulas,
  validade e simplificações S-1..S-8 (C-5).
- A branch `task/TASK-014-geometria-adr-013` já estava em uso no checkout principal; por isso o
  trabalho foi feito em `task/TASK-014-geometria-adr-013-impl`, criada no mesmo commit `3ce9d5f`.
- Tarefas em paralelo (TASK-006): o handoff fica em `handoffs/TASK-014.md` e `handoffs/current.md`
  não é editado. TASK-010, TASK-011 e TASK-013 estão em andamento e tocam outros arquivos (inclusive
  `docs/known-gaps.md` e `docs/architecture.md`); esta tarefa só cria arquivos novos.
- Dados de teste: parâmetros geométricos FICTÍCIOS rotulados como tal (ADR-012; ADR-013 C-4, regra 2).
- Base: ADR-004 (Clean Architecture), ADR-013, `docs/business-rules.md` (RN-003, RN-006, RN-008),
  `docs/known-gaps.md` (P-001..P-004), domínio existente da TASK-008 (`Length`, `Angle`,
  `_numeric.py`, `DomainError`).

## 3. Critérios de aceite

- [ ] **CA-1** — Dada uma ficha técnica FICTÍCIA coerente, quando crio a `CraneGeometry` (a com
  sinal, h, faixas de L, θ, c e, opcionalmente, ψ), então ela guarda os valores em metros e graus;
  dada uma faixa incoerente (mínimo > máximo em L, θ, c ou ψ; θ fora de −90° < θ ≤ 90°; só um dos
  limites de giro; amplitude de giro ≥ 360°; campo com tipo errado), então recebo
  `InvalidCraneGeometryError`; a não finito e h negativo são rejeitados.
- [ ] **CA-2** — Dado L, θ, ψ e c como `Length`/`Angle`, quando crio o `OperationalState`, então ψ é
  guardado normalizado em [0°, 360°) (ADR-013 C-2) e campo com tipo errado levanta
  `InvalidOperationalStateError`.
- [ ] **CA-3** — Dado um estado dentro das faixas, quando chamo `calculate_operational_geometry`,
  então recebo R = a + L·cos θ, y_T = h + L·sin θ, y_G = y_T − c e P, T, G pela fórmula (5) do
  ADR-013, conferidos com valores calculados à mão (θ = 0°, 30°, 60°, 90° e negativo; a > 0, a = 0 e
  a < 0; ψ = 0°, 45°, 90°, 180° e 270°), com tolerância explícita.
- [ ] **CA-4** — Dado ψ = 90°, então a lança fica sobre +X (lado esquerdo do chassi), e ψ positivo
  gira no sentido anti-horário visto de cima (regra da mão direita em torno de +Y).
- [ ] **CA-5** — Dado L, θ, c ou ψ fora das faixas da ficha técnica, então recebo
  `OperationalStateOutOfLimitsError` com todas as violações, sem nenhum valor corrigido (ADR-013 C-5:
  "sinaliza, e não corrige"); os limites são inclusivos; sem c_max ou sem limites de giro, não há
  limite superior de cabo nem de giro.
- [ ] **CA-6** — Dado um estado com a ponta atrás do eixo de giro (R < 0), então recebo
  `OutsideGeometricDomainError`, e o raio nunca vira |R| (ADR-013 C-5).
- [ ] **CA-7** — Dado um estado com o gancho abaixo do plano de apoio (y_G < 0), então a geometria é
  devolvida normalmente (ADR-013 C-5: não bloqueado, G-8).
- [ ] **CA-8** — Dado o exemplo da doc-fonte com a = 0 (L = 18,2 m, θ = 42°), então R ≈ 13,5252 m
  (13,5 m com 1 casa); a altura do gancho do exemplo **não** é caso de teste (ADR-013, R-4).
- [ ] **CA-9** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, sem dependência
  nova (só `math`), e `bash scripts/check-structure.sh` não tem erro.
- [ ] **CA-10** — `handoffs/TASK-014.md` registra comandos, saídas reais e as pendências encontradas.

## 4. Escopo

### Dentro do escopo

- Value objects `CraneGeometry`, `OperationalState`, `Point3D` e `OperationalGeometry` em
  `backend/app/domain/value_objects/` (arquivos novos).
- Exceções de geometria em `backend/app/domain/exceptions/geometry_errors.py` (arquivo novo).
- `GeometryService` como função pura `calculate_operational_geometry` em
  `backend/app/domain/services/geometry_service.py` (arquivo novo).
- Testes em `backend/tests/domain/` e fixture FICTÍCIA em `backend/tests/fixtures/` (arquivos novos).

### Fora do escopo (explicitamente — o agente NÃO faz)

- Onde a ficha técnica fica no modelo (`CraneKinematics`, entidade própria ou `CraneConfiguration`),
  cadastro por API, persistência e registro do documento de origem de cada valor (ADR-013 C-4,
  regra 1).
- Ligar a geometria à consulta de capacidade, `LoadChartResolver`, `SafetyValidator`, casos de uso,
  API e WebSocket.
- Geometria no frontend e testes de paridade (ADR-013 C-7).
- Alterar arquivos existentes: `angle.py`, `capacity_query.py`, `domain_errors.py`,
  `docs/known-gaps.md`, `docs/architecture.md`, `docs/project-overview.md`, `handoffs/current.md` e
  os arquivos das TASK-010, TASK-011 e TASK-013.
- Se algo daqui parecer necessário, registrar em "Pendências" do handoff e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/domain/exceptions/geometry_errors.py` | criar | sim |
| `backend/app/domain/value_objects/{crane_geometry,operational_state,operational_geometry}.py` | criar | sim |
| `backend/app/domain/services/geometry_service.py` | criar | sim |
| `backend/tests/domain/test_geometry_{value_objects,service}.py` | criar | sim |
| `backend/tests/fixtures/crane_geometry_ficticia.py` | criar | sim |
| `handoffs/TASK-014.md`, este arquivo | criar | sim |

## 6. Riscos e dependências

- Depende de: ADR-013 aceito (commit `3ce9d5f`).
- Risco: parâmetros FICTÍCIOS confundidos com ficha técnica real → rótulo FICTÍCIO no nome do
  arquivo, no cabeçalho, nas constantes e nos nomes dos testes (ADR-012).
- Risco: itens A VALIDAR do ADR-013 (G-1..G-8) mudarem → o raio está numa única função
  (`_working_radius`) e os parâmetros ficam em dados, como o ADR pede.
- Risco: conflito com tarefas em paralelo → só arquivos novos.

## 7. Teste manual (se houver)

Não há: todo o comportamento é verificado pelos testes automatizados de domínio.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar esta tarefa | `tasks/in-progress/` | `check-structure.sh` | [x] |
| 2 | Exceções, `CraneGeometry` e `OperationalState`, com fixture FICTÍCIA e testes | `app/domain/exceptions/`, `app/domain/value_objects/`, `tests/` | CA-1, CA-2, gates | [x] |
| 3 | `OperationalGeometry` e `calculate_operational_geometry`, com testes | `app/domain/value_objects/`, `app/domain/services/`, `tests/domain/` | CA-3..CA-8, gates | [x] |
| 4 | Handoff | `handoffs/TASK-014.md` | CA-9, CA-10 | [x] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só arquivos novos; nada existente os importa).
- Regras de negócio aplicáveis: RN-003 (parâmetros nunca do GLB), RN-006 (metros e graus), RN-007
  (R < 0 sinalizado), RN-008 (backend como fonte de verdade da geometria).
- Decisões necessárias: registradas em `handoffs/TASK-014.md` § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| ficha técnica coerente guardada; faixas incoerentes, tipos errados, a não finito e h negativo rejeitados | CA-1 | unitário | `backend/tests/domain/test_geometry_value_objects.py` | verde |
| ψ normalizado em [0°, 360°); tipos errados rejeitados | CA-2 | unitário | `backend/tests/domain/test_geometry_value_objects.py` | verde |
| R, y_T, y_G, P, T e G contra valores calculados à mão | CA-3 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |
| ψ = 90° em +X; sentido anti-horário visto de cima | CA-4 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |
| fora das faixas → erro com todas as violações; limites inclusivos; c_max e giro opcionais; arco de giro | CA-5 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |
| R < 0 → fora do domínio geométrico | CA-6 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |
| y_G < 0 devolvido | CA-7 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |
| raio do exemplo da doc-fonte | CA-8 | unitário | `backend/tests/domain/test_geometry_service.py` | verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
