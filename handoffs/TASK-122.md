# Handoff — TASK-122 — implementação (planejar: giro pela traseira do chassi)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-122.md`; `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data** | 2026-11-25 |
| **Tarefa** | `tasks/in-progress/TASK-122-planejar-giro-pela-traseira.md` |
| **Etapa concluída** | implementação com teste |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-122-planejar-giro-pela-traseira`, a partir de `development` |

## 1. O que foi feito

- `backend/app/domain/services/planning/planner.py`: `_HEADING_STEPS_DEG` passou de
  `(0, 90, 180, 270)` para `(180, 90, 270, 0)`. O rumo-base continua o que centra o giro curto em
  ψ = 0°; a ordem dos rumos testados é que mudou. Como `_routes` ordena por tempo com ordenação
  estável e `plan_crane` fica com a primeira rota que atende, em empate vale agora a traseira, depois
  os lados e, por último, a frente (sobre a cabine).
- `backend/tests/application/test_recommend_lift_plan.py`: teste novo
  `test_o_giro_passa_pela_traseira_do_chassi_e_nao_pela_frente_da_cabine`.

## 2. Comandos executados (saída real, resumida)

- `uv run pytest -q tests/application/test_recommend_lift_plan.py`: passa com a mudança; com
  `planner.py` revertido (stash), o teste novo FALHA (verificado).
- `uv run ruff check .`, `uv run ruff format --check .`: sem erros.
- `uv run mypy app`: `Success: no issues found in 183 source files`.
- `uv run lint-imports`: `Contracts: 3 kept, 0 broken.`
- `uv run pytest -q`: suíte inteira passa (testes de integração com banco pulados, sem
  `DATABASE_URL` no shell).
- API local (`POST /api/v1/planning/recommend`, carga de 2 t, coleta (0,0), entrega (8,8)): o
  "Guindaste Telescópico 80 t" passou de ψ −90° → 90° (pela frente) para ψ 105° → 270° (pela traseira).

## 3. Decisões

- Só a ordem de preferência mudou; nenhuma rota foi proibida. A frente continua valendo quando é a
  única que atende.
- Configuração com `turret_rotation_min/max` na ficha segue com um único rumo, centrado no arco
  permitido (comportamento anterior).

## 4. O que NÃO foi feito

- Não testado na tela (só testes e API).
- `docs/business-rules.md` não foi alterado (protegido): a preferência pela traseira não está escrita
  lá. Sem ADR: não houve decisão de arquitetura, só a ordem de preferência pedida.
- Com tabelas por zona em que a zona traseira tem capacidade menor (caso das tabelas FICTÍCIAS da
  demo), a traseira dá utilização maior que a frente; a recomendação continua válida, com número pior.
- No tandem, cada guindaste é planejado sozinho e herda a mesma preferência; não conferi o efeito
  nos pares.

## 5. Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff `development...task/TASK-122-planejar-giro-pela-traseira`.
Ler primeiro: `planner.py` (`_HEADING_STEPS_DEG`, `_sites`, `_routes`, `plan_crane`).
