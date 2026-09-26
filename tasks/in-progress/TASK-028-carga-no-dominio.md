# TASK-028 — Modelar a carga (`Load`) no domínio do backend

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por Anderson Sehnem |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-028-carga-no-dominio` (a partir de `a5b1ab0`, o commit-base da leva A, TASK-021) |
| **PR** | — |
| **Requisitos** | RF-011, RF-017, RNF-002, RNF-004 |
| **Regras de negócio** | RN-006; PEND-006 (pendente) |
| **Estimativa** | P |

---

## 1. Objetivo

O domínio do backend passa a ter a carga da simulação (`Load`, doc-fonte § 10.2): identificador
opcional, descrição, peso, dimensões (comprimento, largura e altura) e centro de gravidade opcional,
validados na criação, mais uma função pura que diz qual peso é comparado com a capacidade. O caso de
uso de avaliação ainda não usa a `Load` (leva B).

## 2. Contexto

- RF-011 ("Criar/configurar carga com peso e dimensões", Must) e doc-fonte § 10.2: "Carga da
  simulação, com peso e dimensões. O centro de gravidade permanece opcional até validação do
  escopo." A entrada conceitual do motor (§ 14.2) só tem `load_weight_kg`.
- PEND-006 (acessórios, moitões, cabos e pesos auxiliares) está pendente em
  `docs/business-rules.md`: o peso da `Load` é o informado pelo usuário; nada é somado a ele.
- `EvaluateOperation` (`backend/app/application/use_cases/evaluate_operation.py`) recebe hoje só
  `load_weight: Mass`; integrá-lo à `Load` fica para a leva B.
- Leva A (TASK-022..028) em paralelo: esta tarefa só cria arquivos **novos** em
  `backend/app/domain/` e `backend/tests/domain/`, além deste arquivo e de `handoffs/TASK-028.md`.
  Não edita `handoffs/current.md`, `README.md` nem `docs/*.md` (as mudanças de documentação ficam
  listadas no handoff, § 10).
- Dados de teste FICTÍCIOS, rotulados como tal (ADR-012).

## 3. Critérios de aceite

- [ ] **CA-1** — Dados uma descrição, um peso (`Mass`) e dimensões (`Length`) FICTÍCIOS válidos,
  quando crio uma `Load`, então ela guarda os valores informados, com identificador e centro de
  gravidade opcionais (`None` quando omitidos).
- [ ] **CA-2** — Dado um peso igual a zero, uma dimensão igual a zero, um campo com tipo errado, uma
  descrição vazia ou um identificador vazio, quando crio a `Load`, então recebo um erro de domínio
  (`InvalidLoadError`); valores não finitos ou negativos continuam barrados por `Length`/`Mass`
  (`InvalidQuantityError`).
- [ ] **CA-3** — Dado um centro de gravidade com coordenadas finitas no referencial da própria carga
  e dentro da caixa definida pelas dimensões, quando crio a `Load`, então ele é aceito; fora da
  caixa ou não finito, recebo erro de domínio.
- [ ] **CA-4** — Duas `Load` com os mesmos valores são iguais; a `Load` e seus value objects são
  imutáveis (atribuir a um campo levanta `FrozenInstanceError`).
- [ ] **CA-5** — Dada uma `Load`, quando obtenho o peso a comparar com a capacidade, então recebo
  exatamente o peso informado, sem acessórios, moitões, cabos nem pesos auxiliares (PEND-006).
- [ ] **CA-6** — Nenhum arquivo existente é alterado; nenhum teste existente quebra.
- [ ] **CA-7** — `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`,
  `uv run mypy app`, `uv run lint-imports` e `uv run pytest` passam em `backend/`, sem dependência
  nova, e `bash scripts/check-structure.sh` não tem erro.
- [ ] **CA-8** — `handoffs/TASK-028.md` registra comandos, saídas reais, decisões provisórias, as
  pendências e as mudanças de documentação necessárias.

## 4. Escopo

### Dentro do escopo

- `Load`, `LoadDimensions`, `LoadCenterOfGravity`, `InvalidLoadError` e a função do peso comparado,
  em arquivos novos de `backend/app/domain/`.
- Testes unitários novos em `backend/tests/domain/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Integrar a `Load` ao `EvaluateOperation`, à API, à persistência ou ao frontend (leva B).
- Somar acessórios, moitões, cabos ou pesos auxiliares ao peso (PEND-006).
- Orientação da carga na cena, conversão de unidades, uso do centro de gravidade em cálculos.
- Alterar `docs/*.md`, `README.md` ou `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/domain/entities/load.py` | criar | sim |
| `backend/app/domain/value_objects/load_dimensions.py` | criar | sim |
| `backend/app/domain/value_objects/load_center_of_gravity.py` | criar | sim |
| `backend/app/domain/exceptions/load_errors.py` | criar | sim |
| `backend/app/domain/services/compared_load_weight.py` | criar | sim |
| `backend/tests/domain/test_load.py` | criar | sim |

## 6. Riscos e dependências

- Depende de PEND-006 (composição da carga bruta) e de respostas às perguntas do handoff § 8
  (peso e dimensões iguais a zero, referencial do centro de gravidade). As escolhas atuais são as
  mais restritivas e estão documentadas como provisórias.
- Risco: a leva B precisar de outra forma para a `Load` → mitigação: nada existente depende dela.

## 7. Teste manual (se houver)

Não há: tudo é coberto por testes unitários.

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Registrar a tarefa e o handoff inicial | este arquivo, `handoffs/TASK-028.md` | `bash scripts/check-structure.sh` | [ ] |
| 2 | Exceção, value objects, `Load` e função do peso comparado | § 5 (domínio) | `uv run mypy app`, `uv run lint-imports` | [ ] |
| 3 | Testes unitários | `backend/tests/domain/test_load.py` | `uv run pytest` | [ ] |
| 4 | Gates e handoff | `handoffs/TASK-028.md` | todos os gates | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum (só arquivos novos).
- Regras de negócio aplicáveis: RN-006 (unidades internas: m e kg), PEND-006 (pendente).
- Decisões necessárias: handoff § 8.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| cria carga válida, com e sem id e CG | CA-1 | unitário | `backend/tests/domain/test_load.py` | — |
| recusa peso/dimensão zero, tipos errados, textos vazios | CA-2 | unitário | idem | — |
| aceita CG dentro da caixa (inclusive na face), recusa fora ou não finito | CA-3 | unitário | idem | — |
| igualdade por valor e imutabilidade | CA-4 | unitário | idem | — |
| peso comparado = peso informado | CA-5 | unitário | idem | — |

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** —

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
