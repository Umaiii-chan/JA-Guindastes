# Handoff — TASK-NNN — <etapa concluída>

> Este arquivo é o ponto de continuidade entre agentes. Quem lê deve conseguir continuar o trabalho
> **sem** ter acesso à conversa anterior. Escreva para alguém que não sabe nada além do que está no
> repositório. Copie este template para `handoffs/current.md` e, ao encerrar a etapa, arquive uma
> cópia em `handoffs/history/AAAA-MM-DD-TASK-NNN-<etapa>.md`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | AAAA-MM-DD HH:MM (fuso) |
| **Tarefa** | `tasks/in-progress/TASK-NNN-<slug>.md` |
| **Etapa concluída** | criação \| planejamento \| testes \| implementação \| revisão \| correções \| encerramento |
| **Papel exercido** | Planejador \| Engenheiro de testes \| Implementador \| Revisor \| Pessoa |
| **Ferramenta/agente** | ex.: Claude Code 1.x \| ChatGPT (GPT-5, web) \| Gemini CLI \| Codex \| pessoa |
| **Branch** | `task/TASK-NNN-<slug>` @ `<hash curto do último commit>` |
| **Duração aproximada** | ex.: 40 min |

---

## 1. Objetivo desta etapa

Uma frase: o que esta etapa deveria produzir.

## 2. O que foi feito

Lista objetiva, no passado, com verbos concretos. Fatos, não intenções.

- Verifiquei que ...
- Criei `src/...` com ...
- Alterei `src/...` para ...
- Escrevi testes em `tests/...` cobrindo CA-1 e CA-2
- Atualizei `docs/...` § N

## 3. Arquivos modificados

Cole a saída real de `git diff --stat development...HEAD` (ou `git status --short` se não commitou).
Marque o que está **fora do escopo** da tarefa e por quê.

```text
<saída do comando>
```

Fora do escopo (justificar cada um):
- `caminho/arquivo` — motivo

## 4. Comandos executados e resultados

Cole a saída **real**, resumida (últimas linhas ou o resumo). Sem saída = NÃO EXECUTADO.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `<comando de teste>` | ✅ passou / ❌ falhou / ⚠️ NÃO EXECUTADO | `12 passed, 0 failed` |
| `<lint>` | | |
| `<build>` | | |
| `bash scripts/check-structure.sh` | | |

```text
<saída relevante colada aqui, se precisar de mais espaço>
```

## 5. Decisões tomadas

Cada decisão com o motivo. Se for arquitetural ou tecnológica → ADR (`Proposto`) e link aqui.

- Decidi X em vez de Y porque ... (verifiquei que ... / hipótese: ...)
- ADR proposto: `docs/decisions/ADR-NNN-...md`

## 6. Regras de negócio aplicadas

- RN-00X — como foi aplicada / onde está o teste
- Regra **não documentada** encontrada: <descrição> → registrada em § 8 (Pendências)

## 7. O que NÃO foi feito e por quê

Ser explícito aqui evita que o próximo agente presuma que está pronto.

- CA-3 não implementado porque depende de decisão P-00X
- Teste e2e NÃO EXECUTADO: ambiente sem Docker
- Refatoração de `src/...` identificada mas fora do escopo → `tasks/backlog/TASK-MMM` criada

## 8. Pendências / decisões necessárias (para a pessoa responsável)

Perguntas objetivas. Uma por linha. A pessoa responde **aqui mesmo** ou no documento certo
(`business-rules.md`, ADR) e marca como respondida.

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | | sim/não | | |

## 9. ⚠️ Segurança (se houver algo)

Só preencher se encontrou segredo exposto, vulnerabilidade, dado pessoal indevido. Mínimo necessário.

## 10. Próximo passo

**Papel:** Planejador \| Engenheiro de testes \| Implementador \| Revisor \| Pessoa responsável

**O que fazer, concretamente:**
1. ...
2. ...

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-NNN-<slug>.md` § N
4. `src/...` (por quê)
5. `docs/...` § N (por quê)

**Cuidado com:**
- ... (armadilha, comportamento não óbvio, teste flaky, etc.)

## 11. Como revisar este trabalho (só quando a etapa for implementação/correções)

Para o Revisor: por onde começar, o que é mais arriscado, o que você (Implementador) tem menos certeza.

- Comece por `src/...` — é onde está a lógica principal
- Tenho menos certeza sobre ... porque ...
- O teste `...` cobre o caso X mas não o caso Y (fora do escopo / não sei se importa)
