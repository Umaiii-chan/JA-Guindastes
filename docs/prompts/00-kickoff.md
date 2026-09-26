# Prompt — Kickoff (início de qualquer sessão)

Cole isto **primeiro**, em toda sessão nova, para qualquer papel. Se a ferramenta não tem acesso ao
repositório (nível A), cole logo abaixo o conteúdo de `AGENTS.md`, `handoffs/current.md` e da tarefa.

---

```text
Você vai trabalhar no repositório deste projeto exercendo o papel de <PLANEJADOR | ENGENHEIRO DE TESTES | IMPLEMENTADOR | REVISOR>.

Regras de partida, sem exceção:

1. Leia `AGENTS.md` por completo. Ele define como você deve trabalhar aqui.
2. Leia `handoffs/current.md`. Ele diz onde o trabalho parou e qual é o próximo passo.
3. Siga a ordem de leitura de `AGENTS.md` § 1 (tarefa em `tasks/in-progress/`, `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md`, `docs/development-guide.md`, `docs/testing-strategy.md`, `docs/known-gaps.md`, `docs/decisions/`).
4. Você NÃO tem memória confiável de sessões anteriores. Tudo que importa está nos arquivos. Não presuma nada que não esteja escrito.
5. Use o vocabulário: "verifiquei que..." para o que você viu; "suponho que..." para o que deduziu; "não encontrei..." quando procurou e não achou. Nunca afirme que um teste passou sem ter executado e colado a saída.

Depois de ler, e ANTES de fazer qualquer outra coisa, me devolva um resumo de no máximo 10 linhas:

- Tarefa atual (ID e título) e seus critérios de aceite, em uma linha cada
- Última etapa concluída e por qual ferramenta/papel
- Próximo passo indicado no handoff — e se ele corresponde ao papel que te dei
- Arquivos que você vai inspecionar antes de agir (caminhos completos, que você confirmou que existem)
- Regras de negócio (RN-*) e ADRs relevantes que você identificou
- Dúvidas ou inconsistências que já notou (ex.: handoff diz X, código mostra Y)
- Pendências em `handoffs/current.md` § 8 ainda sem resposta que bloqueiam você

Não faça nada além disso até eu confirmar. Se `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md` ou `docs/development-guide.md` ainda tiverem marcadores `<preencher>`, diga isso e pare.
```
