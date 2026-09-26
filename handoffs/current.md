# Handoff — estado inicial do template

> Nenhuma tarefa em andamento. Este é o estado do repositório logo após a adaptação do template.
> Ao criar a primeira tarefa, reescreva este arquivo com `docs/templates/handoff-template.md`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | AAAA-MM-DD HH:MM |
| **Tarefa** | nenhuma em `tasks/in-progress/` |
| **Etapa concluída** | preparação do repositório |
| **Papel exercido** | Pessoa |
| **Ferramenta/agente** | pessoa |
| **Branch** | `development` |

## 1. Objetivo desta etapa

Deixar o repositório pronto para o primeiro ciclo de trabalho com IAs.

## 2. O que foi feito

- Template copiado e renomeado.
- *(preencher conforme avança em `docs/guides/adapting-template.md`)*

## 3. Arquivos modificados

```text
(saída de git status --short ou git diff --stat)
```

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `bash scripts/check-structure.sh` | ⚠️ NÃO EXECUTADO | |

## 5. Decisões tomadas

- Adoção do workflow baseado em arquivos — `docs/decisions/ADR-001-workflow-baseado-em-arquivos.md`.
- Modelo de três branches por ambiente — `docs/decisions/ADR-002-modelo-de-branches-por-ambiente.md`.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- `docs/` ainda tem marcadores `<preencher>` — nenhum agente deve implementar até que
  `project-overview.md`, `architecture.md`, `business-rules.md` e `development-guide.md` estejam preenchidos.
- `.github/workflows/ci.yml` ainda com comandos genéricos — ajustar à stack.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Qual é a primeira tarefa? (sugestão: `tasks/backlog/TASK-000-exemplo.md` como TASK-001) | sim | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável

**O que fazer, concretamente:**
1. Seguir `docs/guides/adapting-template.md` Fases 1 a 5.
2. Criar as branches `development`, `homologation` e `production` no GitHub e definir `development`
   como default (ver `docs/guides/git-github.md` § 8.1).
3. Criar `tasks/in-progress/TASK-001-<slug>.md`.
4. Reescrever este arquivo apontando para a TASK-001 com próximo passo = Planejador.

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. `docs/guides/adapting-template.md`
3. `docs/guides/workflow.md`

**Cuidado com:**
- Não acione nenhuma IA como Implementador antes de o contexto mínimo estar preenchido.

## 11. Como revisar este trabalho

- não se aplica (nenhuma implementação)
