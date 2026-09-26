# Handoff — TASK-028 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-028-carga-no-dominio.md` |
| **Etapa concluída** | planejamento + testes + implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (mesma sessão, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code (Opus 5.5), agente em worktree isolada, leva A |
| **Branch** | `task/TASK-028-carga-no-dominio` (a partir de `a5b1ab0`) @ `a42497c` + o commit deste handoff |
| **Duração aproximada** | 40 min |

---

## 1. Objetivo desta etapa

Modelar a carga da simulação (`Load`, RF-011; doc-fonte § 10.2) no domínio, com validação e uma
função pura do peso comparado com a capacidade, sem alterar arquivos existentes.

## 2. O que foi feito

- Li RN-006 e PEND-006 (`docs/business-rules.md`), RF-011 (`docs/requirements/functional.md`),
  doc-fonte §§ 10.2 e 14.2, `Length`/`Mass`/`_numeric.py`, as exceções de domínio e o
  `EvaluateOperation`.
- Criei `InvalidLoadError(DomainError)` em `backend/app/domain/exceptions/load_errors.py`.
- Criei `LoadDimensions` (comprimento, largura, altura em `Length`, todas > 0) e
  `LoadCenterOfGravity` (três coordenadas finitas, em m, no referencial da carga).
- Criei a `Load` (frozen dataclass): `description`, `weight: Mass`, `dimensions`,
  `center_of_gravity` opcional, `id` opcional. O docstring diz que o peso é o informado pelo usuário
  e que a "carga bruta" depende da PEND-006.
- Criei `weight_compared_with_capacity(load) -> Mass` em
  `backend/app/domain/services/compared_load_weight.py`: devolve `load.weight`, sem somar nada.
- Escrevi 44 testes em `backend/tests/domain/test_load.py` (CA-1..CA-5), com dados FICTÍCIOS.

## 3. Arquivos modificados

```text
$ git diff --stat a5b1ab0...HEAD   (antes do commit deste handoff)
 backend/app/domain/entities/load.py                |  71 +++++++
 backend/app/domain/exceptions/load_errors.py       |  16 ++
 .../app/domain/services/compared_load_weight.py    |  15 ++
 .../domain/value_objects/load_center_of_gravity.py |  41 ++++
 .../app/domain/value_objects/load_dimensions.py    |  37 ++++
 backend/tests/domain/test_load.py                  | 231 +++++++++++++++++++++
 tasks/in-progress/TASK-028-carga-no-dominio.md     | 134 ++++++++++++
 7 files changed, 545 insertions(+)
```

Mais este `handoffs/TASK-028.md`. Todos os arquivos são novos; nenhum arquivo existente foi
alterado. Fora do escopo: nada.

## 4. Comandos executados e resultados

Em `backend/`, depois do código e dos testes:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv sync --locked` | ✅ | ambiente instalado, sem mudança no lock |
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `90 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 55 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `464 passed, 2 skipped in 2.98s` |
| `uv run pytest tests/domain/test_load.py` | ✅ | `44 passed in 0.06s` |
| `bash scripts/check-structure.sh` (raiz, antes deste handoff) | ❌ esperado | `✗ tarefa em andamento TASK-028 sem handoff` · `! há 3 tarefas em tasks/in-progress/` |
| `bash scripts/check-structure.sh` (raiz, com este handoff) | ver § 4.1 | |

### 4.1 check-structure com o handoff

Saída real registrada no retorno ao coordenador (rodado depois do commit deste arquivo). O aviso
"há 3 tarefas em tasks/in-progress/" é esperado na leva A (TASK-020, TASK-021 e TASK-028 nesta
branch; as demais estão nas branches delas).

## 5. Decisões tomadas

Todas **provisórias**, na opção mais restritiva quando a doc é omissa (instrução da pessoa
responsável, 2026-09-26); cada uma vira pergunta em § 8.

- **Dimensões > 0** (`LoadDimensions`): a doc não diz se uma dimensão pode ser zero.
- **Peso > 0** (`Load`): a doc não diz se uma carga de 0 kg é válida. O `Mass` continua aceitando
  0 kg (tabela e `EvaluateOperation` não mudam).
- **Descrição obrigatória e não vazia**: a doc-fonte não fala de descrição; o campo veio da
  instrução da tarefa.
- **Referencial do CG**: origem no centro geométrico da caixa das dimensões; eixos ao longo do
  comprimento, largura e altura; sentido positivo não definido em relação ao guindaste/cena. O CG
  precisa ficar dentro da caixa (faces incluídas): `|deslocamento| ≤ aresta/2` em cada eixo.
- **Igualdade por valor** (frozen dataclass sobre todos os campos), como `LoadChart`; comparar
  carga persistida só pelo `id` fica para a persistência.
- **Erros**: invariantes da carga → `InvalidLoadError`; não numérico, não finito ou negativo →
  `InvalidQuantityError` (herdado de `Length`/`Mass`/`require_finite`).
- **Módulos separados** (`entities/load.py`, dois value objects, `exceptions/load_errors.py`,
  `services/compared_load_weight.py`) para não tocar arquivos existentes.

## 6. Regras de negócio aplicadas

- RN-006 — peso em kg (`Mass`), dimensões e CG em m.
- PEND-006 — **não aplicada** (pendente): nada é somado ao peso; está no docstring da `Load` e da
  função, e o teste `test_compared_weight_is_exactly_the_informed_weight` garante isso.
- Regras não documentadas encontradas: § 8.

## 7. O que NÃO foi feito e por quê

- **Integração da `Load` ao `EvaluateOperation`** (que recebe `load_weight: Mass`): fica para a leva
  B, usando `weight_compared_with_capacity(load)`; não alterei arquivos existentes.
- API, persistência, frontend e uso do CG em cálculos: fora do escopo.
- Documentação em `docs/`: proibido nesta leva; ver § 10.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Uma carga pode ter peso 0 kg? (hoje: não, provisório) | não | | |
| 2 | Alguma dimensão da carga pode ser zero (ex.: chapa fina modelada como 2D)? (hoje: não, provisório) | não | | |
| 3 | A descrição da carga é obrigatória? (hoje: sim, não vazia, provisório; a doc-fonte não a cita) | não | | |
| 4 | Referencial do centro de gravidade: origem no centro da caixa? em qual vértice/face? sentido dos eixos em relação ao guindaste? O CG pode ficar fora da caixa (carga irregular descrita só pelas dimensões externas)? (hoje: centro da caixa, CG dentro, provisório) | não | | |
| 5 | Como "comprimento", "largura" e "altura" se orientam na cena e em relação ao gancho? | não | | |
| 6 | PEND-006: a carga comparada é a bruta (acessórios, moitões, cabos, pesos auxiliares)? (hoje: só o peso informado) | não | | |

## 9. ⚠️ Segurança (se houver algo)

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta) e, depois, Pessoa responsável.

**O que fazer, concretamente:**
1. Revisar o diff `development...task/TASK-028-carga-no-dominio`.
2. Responder § 8.
3. Leva B: `EvaluateOperation` receber `Load` e usar `weight_compared_with_capacity`.

**Mudanças de documentação necessárias (não feitas nesta leva, por regra da leva A):**
- `docs/requirements/functional.md`: RF-011 → status/teste relacionado (`backend/tests/domain/test_load.py`; domínio implementado, sem API).
- `docs/architecture.md` (seção do domínio): citar `Load`, `LoadDimensions`, `LoadCenterOfGravity`, `InvalidLoadError` e `weight_compared_with_capacity`.
- `docs/known-gaps.md`: L-001 (carga modelada só no domínio; sem integração); P-005 (a função do peso comparado é o ponto único onde a PEND-006 entrará); novas perguntas § 8 itens 1–5.
- `docs/business-rules.md` (pela pessoa responsável): PEND-006 → "Testes relacionados: `test_compared_weight_is_exactly_the_informed_weight`", se ela quiser.
- `handoffs/current.md`: marcar a TASK-028 no índice.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-028-carga-no-dominio.md` § 3
4. `backend/app/domain/entities/load.py`

**Cuidado com:**
- `Mass(0)` é válido, mas `Load` com 0 kg não é (regra provisória só da `Load`).

## 11. Como revisar este trabalho

- Comece por `backend/app/domain/entities/load.py` (validações e CG dentro da caixa).
- Tenho menos certeza sobre o referencial do CG (§ 8, item 4): é a decisão mais "inventada", embora
  documentada como provisória.
