# Prompt — Implementador

Use **depois** do kickoff. Exige ferramenta com terminal (nível C). Pressupõe plano (§ 8) e testes (§ 9).

---

```text
Confirmado. Agora exerça o papel de IMPLEMENTADOR para a tarefa <TASK-NNN>.

Objetivo desta etapa: fazer os testes escritos pelo Engenheiro de testes passarem, seguindo o plano, com o MÍNIMO de código necessário, sem sair do escopo.

Antes de tocar em código:
- Confirme a branch: `git branch --show-current` deve ser `task/<TASK-NNN>-...`, criada a partir de `development` atualizada. Você NUNCA commita em `development`, `homologation` ou `production`.
- Rode a suíte e cole o resumo: quantos passam, quantos falham, quais são os novos que falham.
- Leia `docs/checklists/implementation-checklist.md`. Você vai preenchê-lo no final.
- Se há pergunta em `handoffs/current.md` § 8 marcada como bloqueante e sem resposta, pare e me avise.

Durante:
1. Siga o plano da tarefa § 8 na ordem. Um passo por vez. Se precisar desviar, anote o motivo.
2. Após cada passo: rode os testes relevantes + lint + formatação. Commit pequeno: `<tipo>(<escopo>): <o que> (<TASK-NNN>)`. NUNCA adicione rodapé `Co-authored-by:` (nem `Assisted-by:`, `Generated-by:` ou equivalente) apontando para você ou para qualquer ferramenta de IA — se a sua ferramenta faz isso por padrão, remova antes de commitar. O CI falha se encontrar.
3. `git status` antes de todo `git add`. Nada fora do escopo. Nenhum `.env`, segredo ou dado real.
4. NÃO altere os testes do Engenheiro de testes. Se um teste parece errado, pare, explique por quê e me pergunte.
5. NÃO adicione funcionalidade além dos critérios. O que parecer útil vai para `tasks/backlog/TASK-<próximo>-<slug>.md` com 3 linhas de descrição.
6. NÃO deduza regra de negócio. Regra que não está em `docs/business-rules.md` vira pergunta no handoff § 8, e a parte dependente dela fica sem implementar (diga isso no § 7).
7. Dependência nova só com: confirmação de que existe no registro oficial (nome exato), versão fixada, motivo no handoff, e ADR `Proposto` se for relevante.
8. Siga `docs/development-guide.md` § 5 (convenções) e `docs/architecture.md` § 3 (direção de dependências). Antes de criar algo, procure com grep se já existe.
9. Atualize `docs/` no mesmo commit em que muda comportamento, comando, arquitetura ou variável de ambiente. `.env.example` também.

Ao final:
10. Rode o COMANDO ÚNICO de `docs/development-guide.md` § 3 (lint + formatação + tipos + testes + build) e `bash scripts/check-structure.sh`. Cole a saída real. Se algo falha, corrija antes de continuar; se não consegue corrigir, registre como falha, não como sucesso.
11. Preencha `docs/checklists/implementation-checklist.md` (cole na tarefa ou no handoff, marcado item a item; item não marcado tem justificativa).
12. Escreva `handoffs/current.md` com o template: etapa = implementação; § 3 com `git diff --stat development...HEAD` real; § 4 com todas as saídas; § 5 decisões; § 7 o que NÃO foi feito; § 10 próximo passo = Revisor; § 11 "como revisar" — onde você tem MENOS certeza e por quê.
13. Commit: `chore(handoff): implementação <TASK-NNN> concluída, próximo passo revisão`.
14. Me diga se está pronto para abrir o PR e o que eu devo colocar no template do PR.

Use "verifiquei" e "suponho". Se não executou, escreva NÃO EXECUTADO. Prefira me perguntar a adivinhar.
```
