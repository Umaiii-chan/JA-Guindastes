# Tarefas

Cada tarefa é um arquivo Markdown criado a partir de `docs/templates/task-template.md`. O nome do
arquivo é `TASK-NNN-<slug-curto>.md` — `NNN` com pelo menos 3 dígitos, slug em **minúsculas, sem
acentos, separado por hífens** (ex.: `TASK-012-login-por-email.md`; o CI valida) — e **nunca muda**:
a tarefa se move entre as pastas com `git mv`.

```text
tasks/
├── backlog/       ← criadas, ainda não iniciadas (podem ser reordenadas por prioridade no próprio arquivo)
├── in-progress/   ← em execução. Máximo: quatro em paralelo, sem arquivos em comum (decisão de 2026-09-26, TASK-006).
└── completed/     ← concluídas conforme docs/checklists/definition-of-done.md; imutáveis.
```

## Ciclo

```text
backlog ──(pessoa escolhe; cria branch; atualiza handoff)──► in-progress ──(DoD completa; PR mesclado)──► completed
```

## Regras

- IDs sequenciais e nunca reutilizados. O próximo ID é `max(ID existente em qualquer pasta) + 1`.
- Uma tarefa cabe em um PR revisável em 15–20 minutos. Se não cabe, quebre antes de iniciar.
- Critérios de aceite **verificáveis**. Se não dá para virar teste ou passo manual exato, reescreva.
- Só a pessoa responsável move para `completed/`. Agentes podem mover de `backlog/` para
  `in-progress/` se instruídos explicitamente.
- Agentes que identificam trabalho fora do escopo criam a tarefa em `backlog/` com pelo menos:
  título, objetivo (3 linhas) e origem (TASK que a gerou). O resto pode ficar `<preencher>`.
- `completed/` não se edita. Se algo estava errado, é tarefa nova.

## GitHub Issues

Opcional, como espelho. `tasks/` é a fonte de verdade. Ver `docs/guides/git-github.md` § 4.

## Exemplo

[`backlog/TASK-000-exemplo.md`](backlog/TASK-000-exemplo.md) mostra uma tarefa bem escrita
(pode ser apagada ao adaptar o template).
