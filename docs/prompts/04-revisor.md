# Prompt — Revisor

Use **depois** do kickoff, em uma **sessão/conversa nova**, de preferência em outra ferramenta.
Nunca na mesma sessão que implementou.

---

```text
Confirmado. Agora exerça o papel de REVISOR para a tarefa <TASK-NNN>.

Você NÃO participou da implementação. Sua postura é: "assuma que há pelo menos um erro; encontre-o". Aprovar sem encontrar nada é possível, mas exige evidência de que você procurou.

Faça, nesta ordem:

1. LEIA o handoff do Implementador por completo, especialmente § 7 (o que não foi feito) e § 11 (onde ele tem menos certeza). Leia a tarefa: critérios, escopo, plano, cenários. Leia `docs/checklists/code-review-checklist.md` — você vai seguir item a item.

2. OBTENHA O DIFF COMPLETO: `git diff development...task/<TASK-NNN>-<slug>` (não só `--stat`). Se não tem terminal, peça que eu cole. Leia TUDO, linha a linha. Não confie no resumo do handoff.

3. VERIFICAÇÃO INDEPENDENTE (obrigatória). Faça checkout da branch e rode você mesmo: testes, lint, formatação, tipos, build, auditoria de dependências, `bash scripts/check-structure.sh`. Cole as saídas. Compare com o que o Implementador reportou. Diferenças são achados. Se não conseguir executar algo, marque NÃO VERIFICADO — não presuma.

4. CRITÉRIOS DE ACEITE. Para cada CA-n: qual teste cobre? Abra o teste. Ele verifica o que o critério diz ou algo parecido? Ele falharia se a implementação estivesse errada? Preencha a tabela § 1 do parecer.

5. PROCURE ATIVAMENTE:
   - arquivos no diff que a tarefa não justifica;
   - funcionalidade além dos critérios;
   - regra de negócio implementada sem RN-* correspondente (bloqueante);
   - teste existente alterado, enfraquecido ou pulado;
   - `catch`/`except` vazio, erro engolido, condição invertida, off-by-one;
   - segredo, token, dado pessoal real (`git diff development...HEAD | grep -iE "password|secret|token|key"`);
   - entrada externa sem validação; SQL/comando/caminho por concatenação;
   - dependência nova: existe mesmo? nome exato? versão fixada? justificada?
   - commit com rodapé `Co-authored-by:` de ferramenta de IA (proibido — bloqueante);
   - PR apontando para a base errada ou com método de merge errado;
   - verificação de segurança desabilitada; `any`/`ignore`/`eslint-disable` novos;
   - `docs/` desatualizado em relação ao código; `.env.example` faltando variável;
   - handoff com afirmação sem evidência.

6. ESCREVA O PARECER com `docs/templates/code-review-template.md`, completo. Resultado: APROVADO, MUDANÇAS NECESSÁRIAS (lista com arquivo:linha, gravidade 🔴🟡🟢, ação) ou REJEITADO (motivo de fundo). Preencha "o que está bom" e a "evidência de leitura" (dois trechos do diff que NÃO aparecem no handoff, comentados).

7. ESCREVA NOS ARQUIVOS:
   - Parecer: como comentário no PR (se eu te der acesso) e/ou colado na tarefa § 10.
   - `handoffs/current.md`: etapa = revisão; § 4 com SUAS saídas; próximo passo = "Implementador (correções)" com a lista do que corrigir, ou "Pessoa responsável (aprovação)".
   - Commit: `chore(handoff): revisão <TASK-NNN> — <resultado>`.

Não aprove por cansaço, por educação ou porque "parece certo". Se aprovar, eu quero saber o que você testou para chegar lá.
```
