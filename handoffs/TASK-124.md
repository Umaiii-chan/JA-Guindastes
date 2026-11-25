# Handoff — TASK-124 — implementação (IA do cenário: orientação da carga)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-124.md`; `handoffs/current.md` não foi
> editado.

| Campo | Valor |
|-------|-------|
| **Data** | 2026-11-25 |
| **Tarefa** | `tasks/in-progress/TASK-124-ia-orientacao-da-carga.md` |
| **Etapa concluída** | implementação com teste |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-124-ia-orientacao-da-carga`, a partir de `development` @ `7e74435` |

## 1. Causa

Verifiquei que `planning.scene.direction(0)` é `(0, 1)`: com giro 0, o comprimento da carga fica ao
longo de +Z. O prompt (`SCENARIO_SYSTEM`) não dizia isso, e as convenções falam em ângulos "a partir
do eixo +X". Para uma viga de 10 m com "entrega 3 m ao lado", a IA (deepseek-flash) devolveu carga em
(-3, 0) e entrega em (-3, 3), ambas com giro 0, declarando nas suposições "comprimento ao longo do
eixo X": 3 m em Z, ou seja, ao longo da própria viga, com a área de entrega sobre ela.

## 2. O que foi feito

- `backend/app/application/use_cases/ai_prompts.py`: regra nova em `SCENARIO_SYSTEM` com a orientação
  da carga, o sentido de "ao lado" e "à frente" e a folga mínima da entrega ao lado.
- `backend/tests/application/test_ai_assistant.py`: teste que amarra o texto à convenção de
  `direction`.

## 3. Comandos executados (saída real, resumida)

- Mesmo pedido, 3 chamadas reais ao `POST /api/v1/ai/scenario-from-text` (deepseek-flash) depois da
  mudança: as três com carga em (0, 0) e entrega em (3, 0), giro 0 (deslocamento na largura).
- `uv run ruff check`, `ruff format --check`, `pytest` de `tests/application` e `tests/presentation`
  filtrados por IA/cenário: passam. Suíte inteira: ver o PR/CI.

## 4. O que NÃO foi feito

- Não testado na tela nem com OpenAI, Groq ou Gemini.
- A frase "ângulos a partir do eixo +X, no sentido anti-horário" das convenções não foi alterada: não
  verifiquei como o giro dos OBSTÁCULOS é desenhado na cena, então não sei se ela está certa para eles.
- É instrução ao modelo, não garantia: a IA ainda pode errar a posição.

## 5. Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff `development...task/TASK-124-ia-orientacao-da-carga`
e conferir a convenção de giro dos obstáculos na cena.
