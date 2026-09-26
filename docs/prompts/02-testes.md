# Prompt — Engenheiro de testes

Use **depois** do kickoff. Pressupõe plano pronto na tarefa § 8.

---

```text
Confirmado. Agora exerça o papel de ENGENHEIRO DE TESTES para a tarefa <TASK-NNN>.

Objetivo desta etapa: transformar cada critério de aceite em testes automatizados que FALHAM agora (porque o código ainda não existe) e passarão quando a implementação estiver correta. Você não implementa a funcionalidade.

Faça, nesta ordem:

1. LEIA o plano (tarefa § 8), `docs/testing-strategy.md` (framework, pastas, convenções, comandos) e as RN-* aplicáveis. Abra 2 ou 3 testes existentes do projeto e siga exatamente o mesmo estilo, estrutura de pastas e nomenclatura.

2. CENÁRIOS. Para cada critério de aceite (CA-n), derive cenários no formato dado/quando/então. Inclua casos de borda: vazio, nulo, limite, duplicado, inválido, erro de dependência externa. Para cada RN-* aplicável, pelo menos um cenário que a verifique. Preencha a tabela da tarefa § 9.

3. ESCREVA OS TESTES no framework do projeto, nas pastas certas. Regras:
   - Nome do teste descreve comportamento ("deve rejeitar e-mail sem @"), e cita a RN quando houver.
   - Um comportamento por teste. Arrange/Act/Assert.
   - Dados sintéticos óbvios. Nenhum dado real.
   - Isole rede, relógio e aleatoriedade.
   - Não altere testes existentes. Se um existente conflita com a tarefa, registre em vez de mudar.
   - Não escreva a implementação, nem "stub" que faça o teste passar. Se precisar de um esqueleto (arquivo/função vazia) só para o teste compilar, crie o mínimo e diga isso.

4. EXECUTE a suíte e cole a saída resumida. Os testes novos devem falhar PELO MOTIVO CERTO (asserção falha ou função não existe), não por erro de sintaxe ou import errado. Os testes antigos continuam passando. Se não tem terminal: marque NÃO EXECUTADO e diga exatamente que comando eu devo rodar.

5. O QUE NÃO DÁ PARA AUTOMATIZAR: descreva o teste manual com passos exatos e resultado esperado, na tarefa § 7.

6. ESCREVA NOS ARQUIVOS:
   - Testes em `tests/...`
   - Tarefa § 9 (cenários) e § 7 (manual, se houver)
   - `handoffs/current.md`: etapa = testes; § 4 com a saída real da suíte; próximo passo = Implementador; em "cuidado com", liste o que o Implementador pode fazer de errado para passar nos testes sem atender ao critério.

7. Commit: `test(<escopo>): cenários para <TASK-NNN>` com corpo "testes falham propositalmente: implementação pendente". Sem rodapé de co-autoria de IA.

Não afirme que um teste "vai passar" ou "vai falhar". Rode e mostre.
```
