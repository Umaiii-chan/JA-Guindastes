# Handoffs

O handoff é o mecanismo de continuidade entre agentes. Como nenhuma IA tem memória confiável entre
sessões, **tudo que o próximo agente precisa saber está em `current.md`**.

```text
handoffs/
├── current.md     ← o estado ATUAL: o que foi feito, o que falta, quem faz o quê a seguir
└── history/       ← um arquivo por etapa concluída: AAAA-MM-DD-TASK-NNN-<etapa>.md (imutáveis)
```

## Regras

1. **Todo agente lê `current.md` antes de agir** (é o item 2 da ordem de leitura em `AGENTS.md`).
2. **Todo agente reescreve `current.md` ao encerrar sua etapa**, usando
   `docs/templates/handoff-template.md`. Trabalho sem handoff é trabalho perdido.
3. Antes de reescrever `current.md`, o conteúdo anterior é copiado para
   `history/AAAA-MM-DD-TASK-NNN-<etapa>.md`. Assim o histórico completo fica preservado.
4. `history/` é imutável. Erro em um handoff antigo se corrige no handoff seguinte, não editando o antigo.
5. Saídas de comando no handoff são **reais e coladas**. "Passou" sem números = NÃO EXECUTADO.
6. A seção "Pendências / decisões necessárias" é respondida **pela pessoa responsável no próprio
   arquivo** (ou no documento certo, com link) antes de acionar o próximo agente.

## Fluxo

```text
Agente A termina ──► copia current.md para history/ ──► reescreve current.md ──► commit
                                                                  │
Pessoa lê, responde pendências, commita ◄─────────────────────────┘
                │
                ▼
Agente B lê current.md ──► trabalha ──► repete
```

## Tarefas em paralelo

Decisão da pessoa responsável em 2026-09-26 (TASK-006, ampliada na TASK-021): até 15 tarefas podem ficar em
`tasks/in-progress/` ao mesmo tempo, desde que não toquem os mesmos arquivos. Nesse caso:

1. cada tarefa escreve o próprio handoff em `handoffs/TASK-NNN.md` (mesmo template);
2. a branch da tarefa **não** edita `handoffs/current.md`, que vira o índice geral (estado do projeto,
   autorizações permanentes da pessoa e pendências gerais);
3. quando a tarefa vai para `tasks/completed/`, o `handoffs/TASK-NNN.md` vai para
   `history/AAAA-MM-DD-TASK-NNN-<etapa>.md`;
4. o `scripts/check-structure.sh` aceita o handoff da tarefa em `handoffs/TASK-NNN.md` ou uma menção
   ao ID dela em `current.md`.

## Convenção de nome no histórico

`AAAA-MM-DD-TASK-NNN-<etapa>.md`, onde etapa ∈ {criacao, planejamento, testes, implementacao,
revisao, correcoes, encerramento}. Se houver mais de uma etapa igual no mesmo dia (ex.: duas rodadas
de correções), acrescente `-2`, `-3`.

## Validação automática

`scripts/check-structure.sh` (rodado pelo CI) falha se `current.md` estiver vazio ou sem as seções
mínimas. Isso não garante qualidade, mas garante que ninguém esqueceu.
