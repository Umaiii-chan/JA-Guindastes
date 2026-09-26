# Handoff — TASK-014 — implementação (geometria do ADR-013 no domínio)

> **Tarefas em paralelo (TASK-006):** este handoff fica em `handoffs/TASK-014.md` e
> `handoffs/current.md` **não** foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 15:30 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-014-geometria-adr-013.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-014-geometria-adr-013-impl` @ `842109b` (antes do commit deste handoff), a partir de `3ce9d5f` |
| **Duração aproximada** | ~40 min |

---

## 1. Objetivo desta etapa

Implementar no domínio, só com a biblioteca padrão, o cálculo geométrico do ADR-013 (RF-015): ficha
técnica geométrica, estado operacional e `GeometryService` com raio de trabalho, altura da ponta,
altura do gancho e posições de P, T e G, com testes FICTÍCIOS.

## 2. O que foi feito

- Verifiquei que o worktree estava em `0960943` e que `task/TASK-014-geometria-adr-013` (em
  `3ce9d5f`) estava em uso no checkout principal (`git worktree list`). Criei
  `task/TASK-014-geometria-adr-013-impl` em `3ce9d5f` e confirmei com `git log -1`.
- Criei `tasks/in-progress/TASK-014-geometria-adr-013.md`, registrando no Contexto que o aceite do
  ADR-013 foi decisão da pessoa em chat e está no commit `3ce9d5f`.
- Criei `backend/app/domain/exceptions/geometry_errors.py`: `InvalidCraneGeometryError`,
  `InvalidOperationalStateError`, `OperationalLimitViolation` (enum legível por máquina),
  `OperationalStateOutOfLimitsError` (traz todas as violações) e `OutsideGeometricDomainError`
  (traz o alcance horizontal negativo). Todas herdam de `DomainError`.
- Criei `CraneGeometry` (`value_objects/crane_geometry.py`), a ficha técnica do ADR-013 C-4: `a`
  como `boom_pivot_offset_m: float` com sinal; `h` e as faixas de L e c como `Length`; faixas de θ
  e ψ como `Angle`; `cable_length_max` e os limites de giro opcionais. Valida tipos, mínimo ≤
  máximo, −90° < θ_min e θ_max ≤ 90° (validade das fórmulas, C-2), limites de giro juntos, com
  amplitude < 360°.
- Criei `OperationalState` (`value_objects/operational_state.py`): L, θ, ψ e c com `Length`/`Angle`;
  ψ guardado normalizado em [0°, 360°) (C-2), com proteção para `-1e-20 % 360.0 == 360.0`.
- Criei `Point3D` e `OperationalGeometry` (`value_objects/operational_geometry.py`): raio como
  `Length`; P, T e G em metros no referencial do guindaste; `tip_height_m` e `hook_height_m` como
  propriedades (podem ser negativas).
- Criei `calculate_operational_geometry(state, geometry)` em `services/geometry_service.py`, com as
  fórmulas (1) a (5) do ADR-013; graus nas interfaces e `math.radians` só dentro do cálculo. O raio
  fica numa única função (`_working_radius`), separada das posições, como pede o C-3.
- Escrevi 109 testes novos, com a ficha técnica FICTÍCIA de
  `backend/tests/fixtures/crane_geometry_ficticia.py` (rótulo FICTÍCIO no nome do arquivo, no
  cabeçalho, nas constantes e nos nomes dos testes):
  - `test_geometry_value_objects.py`: validação da ficha técnica e do estado (CA-1, CA-2);
  - `test_geometry_service.py`: 11 casos calculados à mão em forma fechada (θ = 0°, 30°, 60°, 90° e
    −30°; a = 1,5, 0 e −2; ψ = 0°, 45°, 90°, 180° e 270°), sentido anti-horário visto de cima
    (produto vetorial), faixas, arco de giro, R < 0, y_G < 0 e o raio do exemplo da doc-fonte
    (CA-3 a CA-8). A tolerância é `TOLERANCE_M = 1e-9` (só erro de ponto flutuante).
- Teste de mutação manual: troquei `direction_x = math.sin(...)` por `-math.sin(...)` (giro
  horário) e rodei `tests/domain/test_geometry_service.py`: `7 failed, 47 passed`. Reverti antes do
  commit (os gates abaixo rodaram no código revertido).

## 3. Arquivos modificados

`git diff --stat 3ce9d5f...HEAD` antes do commit deste handoff (este arquivo e a atualização do
plano da tarefa entram no commit final):

```text
 backend/app/domain/exceptions/geometry_errors.py   |  66 ++++
 backend/app/domain/services/geometry_service.py    | 128 +++++++
 backend/app/domain/value_objects/crane_geometry.py | 126 ++++++
 .../domain/value_objects/operational_geometry.py   |  53 +++
 .../app/domain/value_objects/operational_state.py  |  54 +++
 backend/tests/domain/test_geometry_service.py      | 421 +++++++++++++++++++++
 .../tests/domain/test_geometry_value_objects.py    | 250 ++++++++++++
 backend/tests/fixtures/crane_geometry_ficticia.py  |  78 ++++
 tasks/in-progress/TASK-014-geometria-adr-013.md    | 158 ++++++++
 9 files changed, 1334 insertions(+)
```

Fora do escopo: nenhum. Só arquivos novos; nenhum arquivo existente foi alterado.

## 4. Comandos executados e resultados

Todos em `backend/`, exceto o `check-structure.sh` (raiz), com o código final.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ passou | `Resolved 41 packages in 1ms` / `Checked 38 packages in 2ms` |
| `uv run ruff check .` | ✅ passou | `All checks passed!` |
| `uv run ruff format --check .` | ✅ passou | `47 files already formatted` |
| `uv run mypy app` | ✅ passou | `Success: no issues found in 35 source files` |
| `uv run lint-imports` | ✅ passou | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ passou | `192 passed in 0.79s` (83 anteriores + 109 novos) |
| `bash scripts/check-structure.sh` | ✅ passou | `OK: 0 erros, 0 aviso(s)` |

`bash scripts/check-structure.sh` (rodado antes do commit deste handoff, com este arquivo já
criado; seções 1 e 4 resumidas, todas com ✓):

```text
2. Handoff atual (handoffs/current.md)
  ✓ tamanho: 4147 bytes
3. Tarefas
  ✓ 1 tarefa(s) em in-progress
  ✓ nenhum ID de tarefa duplicado
5. Segurança básica
  ✓ .env está no .gitignore
  ✓ nenhum .env versionado
  ✓ nenhum padrão óbvio de segredo encontrado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-014-geometria-adr-013-impl
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 5 commit(s) desta branch sem co-autoria de IA

OK: 0 erros, 0 aviso(s)
```

`uv run lint-imports`:

```text
Camadas: apresentação e infraestrutura dependem de aplicação, que depende de domínio KEPT
Domínio não depende de frameworks (RNF-002) KEPT
Aplicação não depende de framework web nem de ORM (RNF-002) KEPT

Contracts: 3 kept, 0 broken.
```

## 5. Decisões tomadas

- **Mecanismo do "sinaliza, e não corrige" (ADR-013 C-5):** o ADR não diz como sinalizar. Seguindo
  a instrução da pessoa ("se o ADR não disser, erro de domínio explícito"), estado fora das faixas
  levanta `OperationalStateOutOfLimitsError` com **todas** as violações, e nenhuma geometria é
  devolvida. R < 0 levanta `OutsideGeometricDomainError`. Pergunta em § 8, item 1.
- **Gancho abaixo do plano de apoio:** o ADR-013 C-5 trata do caso ("y_G negativo não é bloqueado
  por este ADR", G-8), então segui o ADR: y_G < 0 é devolvido normalmente, sem erro.
- **Limites inclusivos e comparação exata**, sem tolerância: o ADR fala em "fora de [L_min,
  L_max]" (intervalo fechado) e não define tolerância para as faixas da ficha técnica. Pergunta em
  § 8, item 3.
- **Limites de giro** como arco que sai de ψ_min e vai, no sentido positivo, até ψ_max (valores
  podem ser negativos, ex.: −30° a 30°), exigindo os dois juntos, mínimo ≤ máximo e amplitude
  < 360°. O ADR não define essa representação. Pergunta em § 8, item 2.
- **θ:** a ficha técnica exige −90° < θ_min e θ_max ≤ 90°, porque o ADR-013 C-2 diz que as fórmulas
  valem nesse intervalo. O `OperationalState` não restringe θ: θ fora da faixa é sinalizado pelo
  serviço como violação de limite.
- **Tipos:** `a` é `float` com sufixo `_m`, porque `Length` não aceita negativo e o ADR diz que `a`
  tem sinal; `h` é `Length` (o ADR diz "altura de P acima do plano de apoio"). L_min = 0 e h = 0
  são aceitos: o ADR não os proíbe e as fórmulas continuam válidas.
- **Resultado:** o raio é `Length` (serve direto para `CapacityQuery`, e nunca é negativo porque R < 0
  é erro); as alturas são `float` (podem ser negativas) e saem das posições, para não haver dois
  valores divergentes. Incluí P e T além de G porque a fórmula (5) do ADR define os três.
- **API pública mínima:** só `calculate_operational_geometry`. `_working_radius` e
  `_horizontal_reach_m` são privadas, para ninguém calcular um raio sem passar pela checagem das
  faixas. As posições usam o alcance (1); se a empresa escolher a alternativa A-1 (raio a partir do
  pino), muda só `_working_radius`, como o ADR pede.
- **Nomes:** `CraneGeometry` (sugestão do ADR), `OperationalState` (as entradas; o `SimulationState`
  da doc-fonte § 10.2 inclui também raio e altura) e `OperationalGeometry` (como o
  `getOperationalGeometry()` da doc-fonte § 17.3).
- **Exceções num módulo novo** (`geometry_errors.py`) em vez de alterar `domain_errors.py`: a
  instrução desta tarefa era só criar arquivos novos.

## 6. Regras de negócio aplicadas

- RN-003 — os parâmetros vêm da `CraneGeometry` (ficha técnica), nunca do GLB; está nas docstrings.
- RN-006 — metros e graus nas interfaces; radianos só dentro de `geometry_service.py`.
- RN-007 — R < 0 é sinalizado explicitamente, nunca vira |R| (`test_ficticio_tip_behind_slewing_axis_is_outside_geometric_domain`).
- RN-008 — o cálculo oficial fica no backend; o `OperationalState` só tem entradas, nunca raio ou
  altura (ADR-013 C-7).
- Regra **não documentada** encontrada: como sinalizar estado fora das faixas, representação dos
  limites de giro e tolerância nas faixas → § 8.

## 7. O que NÃO foi feito e por quê

- Documentação não atualizada, porque as tarefas em paralelo estão alterando esses arquivos
  (instrução desta tarefa): `docs/known-gaps.md` (ainda diz "não existe código" em L-001 e § 5; falta
  uma limitação sobre a geometria provisória e as simplificações S-1..S-8), `docs/architecture.md`
  (o `GeometryService` agora existe) e `docs/testing-strategy.md`. Ver § 8, item 5.
- Docstrings antigas ficaram desatualizadas e não foram alteradas (só arquivos novos):
  `backend/app/domain/value_objects/angle.py` ("o zero e o sentido dos ângulos ainda não estão
  definidos (known-gaps P-001)"), `backend/app/domain/value_objects/capacity_query.py` ("como eles
  são obtidos da geometria do guindaste ainda não está definido") e o nome do teste
  `test_angle_accepts_negative_values_because_sign_convention_is_pending` em
  `backend/tests/domain/test_quantities.py`. O comportamento deles continua correto (θ e limites de
  giro podem ser negativos).
- Onde a `CraneGeometry` fica no modelo (`CraneKinematics`, entidade própria ou
  `CraneConfiguration`) e o registro do documento/revisão de origem de cada valor (ADR-013 C-4,
  regra 1): ficam para a tarefa de modelagem, como o ADR diz.
- Ligação com a consulta de capacidade, casos de uso, API, frontend e testes de paridade (C-7):
  fora do escopo.
- Push e PR: não feitos, por instrução desta tarefa.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | O ADR-013 C-5 diz que o `GeometryService` "sinaliza, e não corrige" estados fora das faixas (e R < 0), sem dizer como. Implementei como **erro de domínio** (`OperationalStateOutOfLimitsError` com todas as violações; `OutsideGeometricDomainError`), sem devolver geometria. A alternativa é devolver a geometria **junto** com as violações, como resultado explícito (no padrão do `CapacityUnsupported` da TASK-008), para a cena poder mostrar a pose com aviso. Mantém o erro ou prefere o resultado com violações? | não (a troca é local ao serviço) | | |
| 2 | Limites de giro: implementei como o arco de ψ_min a ψ_max no sentido positivo, com os dois juntos, mínimo ≤ máximo, amplitude < 360° e valores que podem ser negativos (−30° a 30° = setor da frente). Isso não representa guindaste de giro limitado com curso maior que uma volta. Confirma a representação? (Vale perguntar à empresa junto com a G-8.) | não | | |
| 3 | As faixas da ficha técnica são comparadas com limites inclusivos e **sem tolerância** (L = 30,0000001 m com L_max = 30 m é violação). O ADR-013 só fala de tolerância para comparar L com os comprimentos tabelados (C-6). Aceita comparação exata nas faixas? | não | | |
| 4 | Onde a ficha técnica geométrica fica no modelo de domínio (atributos de `CraneKinematics`, entidade própria ou parte de `CraneConfiguration`) e se guarda documento/revisão de origem de cada valor (ADR-013 C-4). Hoje é um value object solto. | não (bloqueia a tarefa de cadastro/persistência) | | |
| 5 | Autoriza uma tarefa pequena de documentação, depois do merge de TASK-010 e TASK-011, para atualizar `docs/known-gaps.md` e `docs/architecture.md` com o `GeometryService` e corrigir as docstrings desatualizadas de `angle.py` e `capacity_query.py` (§ 7)? | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta, AGENTS.md § 3), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisor: revisar `git diff 3ce9d5f...task/TASK-014-geometria-adr-013-impl` com
   `docs/templates/code-review-template.md`, conferindo as fórmulas contra o ADR-013 C-5.
2. Pessoa: responder as pendências do § 8; decidir se a branch `-impl` substitui
   `task/TASK-014-geometria-adr-013` (as duas partem de `3ce9d5f`) antes do push e do PR.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-014-geometria-adr-013.md` § 3
4. `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` C-2 a C-5 (a especificação)
5. `backend/app/domain/services/geometry_service.py` (as fórmulas)

**Cuidado com:**
- O ADR-013 é provisório: itens A VALIDAR (G-1..G-8) podem mudar o raio (só `_working_radius`) e os
  parâmetros (só dados).
- A altura do gancho do exemplo da doc-fonte (11,7 m) é inconsistente com as fórmulas e não deve
  virar teste (ADR-013, R-4). Só o raio do exemplo é testado.
- `cos 90°` em ponto flutuante dá `6e-17`, não 0: por isso os testes usam tolerância, e com a = 0 e
  θ = 90° o raio é ~7e-16, não exatamente 0.

## 11. Como revisar este trabalho

- Comece por `backend/app/domain/services/geometry_service.py`: fórmulas (1) a (5) e a checagem das
  faixas.
- Depois `backend/tests/domain/test_geometry_service.py`: os valores esperados estão em forma
  fechada, com a conta no comentário de cada caso.
- Tenho menos certeza sobre a representação dos limites de giro (§ 8, item 2) e sobre a borda
  numérica do arco. Suponho (não verifiquei um caso concreto) que um ψ que deveria cair exatamente
  em ψ_min possa, por arredondamento da normalização, ser julgado ~1e-14° fora, porque não há
  tolerância (§ 8, item 3). Os casos de borda testados (−30° e 330° com ψ_min = −30°; 90° com
  ψ_min = 90°) passam.
- Não há teste para estado com violação de faixa e R < 0 ao mesmo tempo: a checagem das faixas vem
  primeiro, então esse caso levanta `OperationalStateOutOfLimitsError`.
