# Handoff — TASK-062 — auditoria visual

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (Opus 5.5) |
| **Branch** | `task/TASK-062-auditoria-visual` |

## O que foi feito

- Auditoria no navegador a 1440 × 900, com a stack Docker. Um detector de overflow mostrou a barra
  da cena vazando 77 px; foi corrigida.
- `SimulatorPage`:
  - tela cheia (Fullscreen API e, se bloqueada, `position: fixed`);
  - painel recolhível;
  - coluna de controles com rolagem;
  - acessórios em `<details>`.
- Textos de produto final em toda a interface:
  - script de troca só em linhas que não são comentário, aplicado também aos testes;
  - reescrita manual dos avisos de Início, Ajuda, Login, Tabelas, Catálogo e HUD;
  - `reasonLabels.ts` traduz os motivos.
- ADR-022..028 aceitos (decisão da pessoa em chat) e índice de ADRs atualizado.

## Comandos

| Comando | Resultado |
|---------|-----------|
| `npm run lint`, `format:check`, `typecheck`, `build` | ✅ |
| `npm test` | ✅ 86 arquivos; 811 passaram e 1 pulado na última rodada completa. Os 352 testes de `tests/app` e `tests/presentation` foram reexecutados depois dos ajustes finais |
| `npm run e2e`, com o backend do Docker parado | ✅ 13 passaram e 1 falhou (Início); o spec `scene.spec` foi corrigido e rodado de novo: 7 passaram |

## Observação

Com a stack Docker no ar, o e2e local cai no login, porque o `vite preview` encaminha para o
backend real. O PR #15 (TASK-063) corrige isso no `catalogMock.ts`.
