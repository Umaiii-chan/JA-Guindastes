# Handoff — TASK-071 — correção

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-071-acessorios-no-guindaste.md` |
| **Etapa concluída** | correções |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-071-acessorios-no-guindaste` |

## O que foi feito

- Reproduzi na tela (Fabricante de Demonstração, Guindaste Telescópico 80 t, Configuração padrão): o seletor, o botão Adicionar e o envio dos acessórios à avaliação já funcionavam (peso comparado 1.551 kg = 1.000 carga + 200 gancho + 351 acessórios).
- Causa: ao escolher um moitão, ele era pendurado abaixo do moitão que já vem no modelo de 80 t (`crane-hook`), ficando dois moitões, e o acessório parecia "não mudar" o guindaste.
- Correção: `SceneAccessory.replacesHook` (verdadeiro para o tipo moitão) -> `AccessoryChain.replacesHook` -> `HookLoad.setAccessories(root, dropM, replacesHook)`: esconde as malhas do moitão do modelo e faz a cadeia partir do fim do cabo. Sem moitão na cadeia, o do modelo volta.
- Teste novo em `frontend/tests/three/scene/HookLoad.test.ts`.

## Gates (frontend)

lint, typecheck, `npm test` (837 passaram) e `npm run build`: OK. `format:check` só acusa `scripts/convert-crane-80t.mjs`, que já era assim em `development` e não foi tocado. `npm run e2e`: NÃO EXECUTADO (prioridade de entrega rápida).

## Pendências

- O modelo 3D do moitão (Sketchfab) tem aparência de bloco cinza; é questão do arquivo, não do encaixe.
- A manilha tem 0,15 m e fica pequena na vista padrão.
