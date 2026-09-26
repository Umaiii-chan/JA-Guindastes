# Handoff — TASK-006 — implementação (tarefas em paralelo no protocolo)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:50 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-006-tarefas-paralelas.md` |
| **Etapa concluída** | planejamento + implementação |
| **Papel exercido** | Planejador + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-006-tarefas-paralelas`, a partir de `development` @ `c0955b2` |
| **Duração aproximada** | ~15 min |

---

## 1. Objetivo desta etapa

Permitir até 4 tarefas em paralelo, cada uma com o próprio handoff.

## 2. O que foi feito

- `scripts/check-structure.sh`: limite de tarefas em andamento de 2 para 4 (aviso a partir de 2), e o
  handoff de cada tarefa passa a ser aceito em `handoffs/TASK-NNN.md` (ou menção em `current.md`).
- `AGENTS.md` (§§ 1, 2 e 7), `tasks/README.md` e `handoffs/README.md` descrevem a nova regra.
- `handoffs/current.md` virou índice geral, com as 4 autorizações permanentes dadas pela pessoa em chat.
- TASK-005 movida para `completed/` (autorização permanente); o handoff dela foi arquivado em
  `handoffs/history/2026-09-26-TASK-005-implementacao.md`.

## 3. Arquivos modificados

```text
 M AGENTS.md
 M handoffs/README.md
 M handoffs/current.md
 M scripts/check-structure.sh
 M tasks/README.md
R  tasks/in-progress/TASK-005-corrigir-setup-uv-ci.md -> tasks/completed/TASK-005-corrigir-setup-uv-ci.md
?? handoffs/TASK-006.md
?? handoffs/history/2026-09-26-TASK-005-implementacao.md
?? tasks/in-progress/TASK-006-tarefas-paralelas.md
```

Fora do escopo: nenhum.

## 4. Comandos executados e resultados

Simulação com tarefas falsas temporárias (`TASK-901..904`, apagadas depois):

| Cenário | Resultado | Saída |
|---------|-----------|-------|
| `bash -n scripts/check-structure.sh` | ✅ | sintaxe OK |
| 4 tarefas, todas com `handoffs/TASK-NNN.md` | ✅ | `! há 4 tarefas ... confirme que não tocam os mesmos arquivos` / `OK: 0 erros, 1 aviso(s)` |
| 5 tarefas | ✅ (esperado falhar) | `✗ há 5 tarefas em tasks/in-progress/ (máximo: 4)` |
| tarefa sem handoff próprio nem menção em `current.md` | ✅ (esperado falhar) | `✗ tarefa em andamento TASK-904 sem handoff: crie handoffs/TASK-904.md ...` |
| `bash scripts/check-structure.sh` no estado final | ver o commit | rodado antes do commit |

## 5. Decisões tomadas

- Limite de 4: a pessoa escolheu "3 ou mais por vez"; 4 dá folga sem perder o controle.
- `current.md` continua com as seções que o script exige, mas como índice.
- Esta tarefa edita `current.md` porque é ela que o transforma em índice. As tarefas paralelas
  (007, 008, 009) não o editam.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- `docs/guides/workflow.md` ainda descreve o fluxo com um handoff só; a regra nova está em
  `AGENTS.md` e `handoffs/README.md`, que prevalecem. Atualizar o guia fica para tarefa futura.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

- ver `handoffs/current.md` § 7

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável — mergear este PR (squash) **antes** dos PRs das TASK-007, 008 e 009.

## 11. Como revisar este trabalho

- A mudança lógica está em ~10 linhas da seção 3 do `check-structure.sh`; o resto é texto.
