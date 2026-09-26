# Prompt — Fechar a etapa com handoff

Use quando a IA terminou o trabalho mas o handoff veio fraco, incompleto ou sem evidência.
Também serve para qualquer papel no fim da etapa.

---

```text
Antes de encerrar, escreva o handoff seguindo EXATAMENTE `docs/templates/handoff-template.md`, para `handoffs/current.md`. Regras:

1. Escreva para alguém que não viu esta conversa e não tem memória de nada. Só o que está no repositório existe para essa pessoa.
2. § 2 (o que foi feito): verbos concretos no passado. "Criei X", "alterei Y para Z", "verifiquei que W". Nada de "trabalhei em", "ajustei algumas coisas".
3. § 3 (arquivos): cole a saída REAL de `git diff --stat development...HEAD`. Marque o que está fora do escopo e por quê.
4. § 4 (comandos): cole a saída REAL, resumida. Se um comando que deveria ter rodado não rodou, escreva NÃO EXECUTADO e o motivo. Não escreva "passou" sem números.
5. § 5 (decisões): cada decisão com motivo; se for arquitetural/tecnológica, aponte o ADR.
6. § 7 (o que NÃO foi feito): seja honesto e específico. É a seção mais útil para o próximo agente.
7. § 8 (pendências): perguntas objetivas para a pessoa responsável, uma por linha, com "bloqueia? sim/não".
8. § 10 (próximo passo): papel + lista concreta do que fazer + "ler primeiro" com caminhos completos e o motivo de cada + "cuidado com".
9. § 11 (como revisar): se a etapa foi implementação/correções, onde você tem menos certeza e por quê.
10. Use "verifiquei" / "suponho" / "não encontrei". Nada de "deve funcionar".

Depois:
- Arquive o handoff anterior (o que estava em `current.md` antes de você começar) em `handoffs/history/<AAAA-MM-DD>-<TASK-NNN>-<etapa-anterior>.md`, se ainda não foi arquivado.
- Commit: `chore(handoff): <etapa> <TASK-NNN> concluída, próximo passo <papel>`.
- Me mostre o handoff final.
```
