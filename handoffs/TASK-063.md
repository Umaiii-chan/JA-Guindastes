# Handoff — TASK-063 — implementação

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-063-colisoes-reais.md` |
| **Etapa concluída** | implementação (prioridade: entrega rápida; testes só do essencial) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-063-colisoes-reais` (a partir de `anderson/development`) |

## 1. Objetivo

Corrigir o relato: a carga ainda entrava na terra e no caminhão (RN-012).

## 2. O que foi feito

- Causa raiz: a guarda (`SwitchableCrane.command`) liberava todo comando quando o estado anterior já
  colidia, e a pose inicial já raspa a cabine. O gancho sem carga não era testado contra o corpo.
- `CollisionReport.penetrationM` (soma das profundidades: terreno, corpo, obstáculos), com
  `obbPenetration` (SAT) e `obbTerrainDepth`.
- A guarda aceita um comando se não houver colisão ou se a penetração não aumentar; senão corta por
  busca binária no último estado aceitável. Partindo colidindo, só passam comandos que reduzem/mantêm
  (ex.: subir o cabo).
- O gancho sem carga passa a ser testado contra o chassi e a torre (não a lança).
- e2e: `collision.spec.ts` (cabo no fim + giro/lança sem estado em colisão). `catalogMock.ts` responde
  404 a `/api/v1/**` sem backend, senão o `vite preview` encaminhava ao backend local e mandava ao login.
  `simulatorEvaluation.spec.ts`: a lança agora vai ao máximo e recua 0,2 m (encolher até 10 m levaria a
  carga contra a cabine, que a guarda agora bloqueia).

## 3. Comandos

| Comando | Resultado |
|---------|-----------|
| `npm run lint` / `format:check` / `typecheck` | passou |
| `npm test` | 86 arquivos, 813 passaram, 1 pulado |
| `npm run build` | passou |
| `E2E_PREVIEW_PORT=5263 npm run e2e` | 14 passaram, 11 pulados (precisam de backend) |

## 4. Pendências e próximos passos

Ver "Testes a escrever depois" na tarefa. Dependências: PR #3 (TASK-050) e o commit de contratos da leva E
já estão em `development`.
