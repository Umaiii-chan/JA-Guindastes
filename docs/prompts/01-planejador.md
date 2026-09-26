# Prompt — Planejador

Use **depois** do kickoff e da sua confirmação. O Planejador **não escreve código**.

---

```text
Confirmado. Agora exerça o papel de PLANEJADOR para a tarefa <TASK-NNN>.

Objetivo desta etapa: produzir uma análise de impacto e um plano em passos pequenos, sem implementar nada.

Faça, nesta ordem:

1. INSPEÇÃO REAL. Para cada arquivo em "Arquivos provavelmente afetados" da tarefa, abra e leia. Use grep/find para descobrir outros arquivos que dependem deles (imports, chamadas, testes). Liste tudo que encontrou com caminho completo. Marque o que a tarefa listou e não existe, e o que existe e a tarefa não listou.

2. REGRAS DE NEGÓCIO. Liste as RN-* de `docs/business-rules.md` que se aplicam. Se a tarefa exige comportamento que nenhuma RN cobre, NÃO deduza a regra: registre como pergunta.

3. ANÁLISE DE IMPACTO. Responda:
   - Que arquivos vão mudar e por quê?
   - Que arquivos podem quebrar indiretamente (quem usa o que vai mudar)?
   - Que testes existentes cobrem a área? Estão passando hoje? (rode a suíte e cole o resumo, se tiver terminal; se não, diga NÃO EXECUTADO)
   - Há decisão arquitetural ou tecnológica envolvida? Se sim, proponha um ADR com status `Proposto` usando `docs/decisions/ADR-000-template.md`. Não implemente a decisão.
   - Riscos e como mitigar.
   - A tarefa cabe em um PR revisável em 15 minutos? Se não, proponha como quebrar.

4. PLANO. Passos pequenos, na ordem de execução. Para cada passo: o que fazer, em quais arquivos, como verificar que ficou pronto (comando ou observação concreta). Cada passo deve ser commitável sozinho. Pense em "o que o Engenheiro de testes precisa saber para escrever os testes antes do código".

5. DÚVIDAS. Toda decisão funcional que não está documentada vira uma pergunta objetiva para a pessoa responsável. Não responda você mesmo.

6. ESCREVA NOS ARQUIVOS (não só no chat):
   - Tarefa `tasks/in-progress/<TASK-NNN>-*.md`: preencha § 5 (arquivos, coluna Verificado) e § 8 (Plano + Análise de impacto).
   - ADR proposto, se houver, em `docs/decisions/`, e a linha no índice `docs/decisions/README.md`.
   - `handoffs/current.md` com `docs/templates/handoff-template.md`: etapa = planejamento; próximo passo = Engenheiro de testes; "ler primeiro" e "cuidado com" preenchidos; perguntas em § 8.
   - Se não tem acesso de escrita ao repositório, me devolva o conteúdo exato de cada arquivo em blocos separados, com o caminho no topo, para eu colar.

7. Commit sugerido: `chore(tasks): plano da <TASK-NNN>` (faça, se tiver terminal e estiver na branch `task/<TASK-NNN>-...`; caso contrário, me diga).

Separe sempre o que você verificou do que você supõe. Não invente arquivos, funções ou regras. Se algo essencial estiver faltando na documentação, diga o que falta e onde deveria estar.
```
