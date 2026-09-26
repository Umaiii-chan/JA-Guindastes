# Definição de pronto (Definition of Done)

Uma tarefa só sai de `tasks/in-progress/` para `tasks/completed/` quando **todos** os itens forem
verdadeiros. Quem marca é a **pessoa responsável**, na etapa de aprovação. Um agente pode preparar
este checklist, mas não pode marcar a tarefa como concluída.

## Funcional

- [ ] Todos os critérios de aceite da tarefa atendidos, com evidência (teste automatizado ou teste manual executado e registrado)
- [ ] Comportamento confere com as regras de negócio (`RN-*`) referenciadas
- [ ] Nada do "Fora do escopo" foi implementado
- [ ] Nenhuma funcionalidade extra sem tarefa própria

## Qualidade

- [ ] Suíte de testes completa passa (localmente **e** no CI)
- [ ] Testes novos cobrem o comportamento novo/alterado e não são tautológicos
- [ ] Cobertura ≥ mínimo de `docs/testing-strategy.md`
- [ ] Lint, formatação, tipos (se aplicável) e build passam localmente **e** no CI
- [ ] `scripts/check-structure.sh` passa
- [ ] Nenhum teste `skip`/`ignore` sem justificativa aceita

## Revisão

- [ ] Revisão feita por sessão/ferramenta **diferente** da que implementou
- [ ] Parecer registrado com `docs/templates/code-review-template.md`, com verificação independente executada
- [ ] Todos os itens 🔴 bloqueantes resolvidos; 🟡 importantes resolvidos ou explicitamente aceitos pela pessoa responsável
- [ ] PR aprovado pela pessoa responsável no GitHub

## Segurança

- [ ] Nenhum segredo, token ou dado pessoal real entrou no repositório (histórico incluído)
- [ ] Nenhum commit da tarefa leva rodapé de co-autoria de IA
- [ ] Dependências novas justificadas, fixadas e sem vulnerabilidade conhecida
- [ ] Checklist de segurança do revisor completo

## Documentação

- [ ] `docs/` reflete o código (arquitetura, comandos, regras, variáveis de ambiente)
- [ ] ADR criado e **aceito** para toda decisão relevante tomada na tarefa (ou ADR proposto rejeitado com motivo)
- [ ] `.env.example` atualizado
- [ ] `docs/known-gaps.md` atualizado (limitações novas registradas; resolvidas movidas para § 7)
- [ ] `docs/business-rules.md` atualizado pela pessoa responsável se alguma pergunta em aberto foi respondida

## Processo

- [ ] Branch `task/TASK-NNN-*` mesclada na `development` via PR (squash) e apagada
- [ ] Tarefa movida para `tasks/completed/` com § 11 (Encerramento) preenchido
- [ ] `handoffs/current.md` arquivado em `handoffs/history/AAAA-MM-DD-TASK-NNN-encerramento.md`
- [ ] `handoffs/current.md` reescrito apontando para o próximo passo (ou "nenhuma tarefa em andamento")
- [ ] Itens que ficaram de fora viraram tarefas em `tasks/backlog/`
- [ ] Aprendizados sobre o processo anotados (na tarefa § 11 e, se universais, no template)

---

**Regra de desempate:** se algum item não puder ser marcado, a tarefa **não está pronta**. Se o item
não faz sentido para o projeto, a pessoa responsável remove o item deste checklist — via commit,
para que a mudança fique registrada — em vez de ignorá-lo.
