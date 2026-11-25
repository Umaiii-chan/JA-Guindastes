# Handoff — TASK-119 — implementação (repetir a simulação)

> Tarefa em paralelo: este handoff fica em `handoffs/TASK-119.md`; `handoffs/current.md` não foi editado.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-11-25 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-119-repetir-simulacao.md` |
| **Etapa concluída** | implementação com testes |
| **Papel exercido** | Planejador + Engenheiro de testes + Implementador (um só agente); revisão fica para outra sessão |
| **Ferramenta/agente** | Claude Code (Sonnet 5.5) |
| **Branch** | `task/TASK-119-repetir-simulacao`, a partir de `development` @ `af0f2a6` (worktree própria) |

## 1. Objetivo

Depois de finalizar uma simulação pelo planejamento, permitir simular de novo sem recarregar nem refazer o cenário.

## 2. O que foi feito

- Verifiquei que a carga de um guindaste só mantém a posição de coleta (`CargoOperation.placement`) e que
  `CargoOperation.reset()` já a devolvia ao chão; faltava expô-la na cena (`resetCargo`) e na tela.
- Verifiquei que no tandem soltar grava a entrega em `scenario.spec.cargo` (a coleta se perde): a tela
  (`SimulatorRoute`) agora guarda a coleta ao engatar e a devolve ao repetir, só se a carga ainda
  estiver onde foi solta.
- `usePlanPlayback` ganhou `reset()` (para e zera progresso e fase; antes o progresso ficava em 100 %).
- `PlanningSection` orquestra: `playback.reset`, limpa o aviso, `onResetCargo`, guindaste ao 1º quadro
  (só com a recomendação aplicada), passo a passo ao passo 0; tecla R (mesmas guardas das teclas de câmera).
- `PlanningPanel`: botão "Repetir simulação" (`aria-keyshortcuts="R"`). `typingInControl` extraído para
  `presentation/simulator/typingInControl.ts` (era privado de `CameraPresetButtons`).
- ADR-053 (Proposto) e este handoff. Nenhuma regra de negócio nova (`business-rules.md` intocado).

## 3. Arquivos modificados

`frontend/src/{app/planning/PlanningSection.tsx, app/planning/usePlanPlayback.ts, app/routes/SimulatorRoute.tsx,
presentation/components/CraneViewport.tsx, presentation/simulator/{CameraPresetButtons,PlanningPanel}.tsx,
presentation/simulator/typingInControl.ts (novo), three/scene/mountCraneScene.ts}`; testes em
`frontend/tests/{three/scene/cargoOperationScene.test.ts, app/usePlanPlayback.test.tsx,
presentation/simulator/planningPanel.test.tsx}`; `docs/decisions/{ADR-053..., README.md}`; tarefa e handoff.
Nada fora do escopo.

## 4. Comandos e resultados

| Comando (em `frontend/`) | Resultado |
|---|---|
| `npx eslint .` | ✅ sem erros |
| `npx tsc -b` e `npx tsc -p e2e` | ✅ sem erros |
| `npx prettier --check .` | ✅ |
| `npx vitest run` (3 arquivos novos/alterados) | ✅ 20 passed |
| `npx vitest run` (suíte inteira) | 1ª execução: ✅ 1359 passed, 1 skipped. Execuções seguintes, com a máquina ocupada: ⚠️ 3 a 19 falhas por timeout de 5 s só em `authFlow`, `appRoutes`, `catalog*`, `tables*` (conjuntos diferentes a cada vez); esses arquivos passam isolados. Instabilidade sob carga, não ligada a esta mudança (mesma família da TASK-114) |
| `bash scripts/check-structure.sh` | ✅ 0 erros |

## 4b. Correções da revisão do PR (Sourcery)

Aceitas: desfazer o engate do tandem ao repetir (`MultiCrane.disengage`), coleta nova a cada viagem,
memória da viagem zerada ao trocar de cenário, coleta que acompanha o caminhão movido
(`CargoOperation.start`), `reset` sem efeito durante reprodução, teste com entrega longe da coleta,
L-020 em `known-gaps.md`. Não feito: Guindaste 2 voltar ao início (L-020); aceitar o ADR-053 (é da pessoa
responsável); testes do tandem e da tela (sem execução manual registrada, escrito em § 6).

## 5. Decisões

- Tecla R, sem modificadores, fora de campos/sliders/modal: segue o padrão das teclas 1–4.
- Repetir também vale com a trajetória parada no meio (volta ao início).

## 6. Não feito

- **E2E: não coube.** O fluxo exige mockar `/planning/recommend` e conduzir a trajetória na cena (o
  `cargoDelivery.spec.ts` só usa os controles manuais). Não rodei o navegador: NÃO EXECUTADO.
  Os testes unitários cobrem a cena, a execução e o botão; **a tecla R e o roteamento da tela
  (`PlanningSection`, `SimulatorRoute`, inclusive o tandem) não têm teste automatizado.**
- Revisão independente e aceite da pessoa responsável (ADR-053 está Proposto).

## 7. Próximo passo

Revisor: ler `PlanningSection.tsx` (`restart`) e `SimulatorRoute.tsx` (`resetCargoForRepeat`,
`tandemTripRef`), e testar à mão: Aplicar → Executar trajetória → "Repetir simulação" (e R) → Executar de novo,
com guindaste só e com tandem.
