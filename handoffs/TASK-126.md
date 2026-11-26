# Handoff — TASK-126 — implementação (área de operação segue o guindaste)

> **Tarefas em paralelo:** este handoff fica em `handoffs/TASK-126.md`; `handoffs/current.md` não foi
> editado. Não há `tasks/in-progress/TASK-126-*.md`: `tasks/in-progress/` já tem 15 tarefas (o máximo
> do `check-structure.sh`) e mover tarefas para `completed` é decisão da pessoa responsável. A tarefa
> chegou pelo relato dela (§ 1).

| Campo | Valor |
|-------|-------|
| **Data** | 2026-11-25 |
| **Tarefa** | TASK-126 (sem arquivo em `tasks/`; ver acima) |
| **Etapa concluída** | implementação com teste |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um único agente; AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-126-area-de-operacao-segue-o-guindaste`, a partir de `development` @ `66dc26b` |

## 1. Objetivo desta etapa

Relato da pessoa responsável (2026-11-25, com captura de tela): "a área de operação não muda quando
o planejar reposiciona o guindaste". Na captura, o guindaste foi levado para outra posição e a grade
verde e vermelha continuou centrada na origem da cena.

## 2. O que foi feito

- Causa (verificada em `frontend/src/three/scene/buildCraneScene.ts`): o anel de raio e os setores das
  zonas de giro são filhos de `craneAnchor`, que `applyCraneAttitude` posiciona e gira pelo cenário; a
  `OperatingAreaOverlay` era adicionada direto à `scene`, na origem, e nunca era movida.
- Correção: `craneAnchor.add(operatingArea.root)`. A grade é polar (ψ, R) no referencial do
  guindaste (ADR-013 C-2, como os setores), então passa a andar e girar com ele.

## 3. Arquivos modificados

- `frontend/src/three/scene/buildCraneScene.ts`
- `frontend/tests/three/scene/buildCraneScene.test.ts` (teste novo)
- `frontend/tests/three/scene/OperatingAreaOverlay.test.ts` (esperava a sobreposição na `scene`)
- `handoffs/TASK-126.md`

## 4. Comandos executados (saída real, resumida)

- `npx vitest run tests/three`: `Test Files 43 passed (43)`, `Tests 393 passed | 1 skipped (394)`.
- `npm run lint`, `npm run typecheck`, `prettier --check` nos arquivos tocados: sem erros.
- Suíte inteira do frontend, build e E2E: ficam para o CI.

## 5. Decisões

- Mesmo pai dos setores das zonas, em vez de copiar posição e rumo para a sobreposição: um só lugar
  define onde o guindaste está.

## 6. O que NÃO foi feito

- Não testado na tela.
- A sobreposição passa a inclinar com o guindaste em terreno inclinado, como os setores; não avaliei
  se isso é o desejado.
- Guindastes adicionais (tandem) não têm área de operação própria; nada mudou neles.

## 7. Próximo passo

Revisor (outra sessão/ferramenta): revisar o diff
`development...task/TASK-126-area-de-operacao-segue-o-guindaste` e conferir na tela.
