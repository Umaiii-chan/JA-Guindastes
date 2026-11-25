# Handoff — TASK-121 — busca do tandem

> Tarefa em paralelo: `handoffs/current.md` não foi editado.

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-121-busca-do-tandem.md` |
| **Etapa concluída** | diagnóstico + passo 1 implementado + testes |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma sessão; revisão pendente) |
| **Branch** | `task/TASK-121-busca-do-tandem`, de `origin/development` @ `89dacad` |

## 1. Diagnóstico (medido, com o catálogo fictício dos testes)

- Causa dominante: `_impossible_pair` (TASK-089/F-04) descartava todo par em sentidos opostos. Com a regra
  desligada, 5 t a 3 m fecham em tandem a 86 %; sem desligar, nada.
- **Não é a largura da busca:** `TANDEM_PLANS_PER_SIDE` 6 → 40 deu os mesmos resultados.
- A regra existe porque cada guindaste planeja o próprio arco; o que importa (distância constante entre
  os ganchos) pode ser medido. Medi 0,01–0,27 m nos casos curtos; 0,9–1,5 m nas translações laterais de 6–8 m.
- Os casos de 8 t / 12 t do diagnóstico da sessão coordenadora dependem da tabela do banco local (não li
  o banco): no catálogo fictício 6 e 8 t não têm opção válida mesmo sem a regra (capacidade).
- "Pior que o single" (4 t, entrega a 6 m: tandem 153 %): não reproduzi; no fictício o tandem venceu o single.

## 2. O que foi feito

- `recommend_lift_plan.py`: `_impossible_pair` mede a variação (`hook_separation_variation_m`, arcos da
  própria busca, 13 pontos) e só recusa sentidos opostos acima de `TANDEM_HOOK_POINT_TOLERANCE_M` (0,5 m).
- Testes novos em `test_recommend_lift_plan_zonas_tandem.py` (4 testes + 1 parametrizado ×2): casos curtos
  recomendam tandem; lateral longa continua recusada; medida unitária; sem pontos cai como antes.
- ADR-055 (Proposto) e TASK-121.

## 3. Verificação (saída real)

- `uv run ruff check app tests` → All checks passed; `uv run mypy app` → Success (183 arquivos).
- `uv run pytest tests/application tests/domain/services/planning` → todos passaram antes dos testes novos;
  `test_recommend_lift_plan_zonas_tandem.py` → passou com os novos. Suíte completa do backend: ver § 5.
- `mypy tests` acusa 42 erros em arquivos que não toquei (já existiam); não é gate do CI.

## 4. Pendências para a pessoa responsável (ADR-055)

(a) Refinar o critério da TASK-089 como no ADR (muda uma regra já entregue). (b) Tolerância de 0,5 m
(FICTÍCIA). (c) Abrir o passo 2 (trajetória rígida da carga, planejando o par em conjunto), que é o que
resolve translações laterais longas. **Não mexi** no limite 90 % → 80 % nem na RN-016.

## 5. Suíte completa

`uv run pytest -q` completo: passou (sem falhas; alguns testes de integração pulados por falta de banco).
