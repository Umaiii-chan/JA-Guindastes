# Requisitos

Requisitos são o **contrato** entre a pessoa responsável e os agentes. Uma tarefa referencia
requisitos por ID; um teste referencia requisitos por ID; um agente que implementa algo sem
requisito está fora do escopo.

## Como organizar

Um arquivo por área ou módulo, ou um único arquivo se o projeto for pequeno:

```text
requirements/
├── README.md              ← este índice
├── functional.md          ← RF-001, RF-002... (ou um arquivo por módulo)
└── non-functional.md      ← RNF-001, RNF-002...
```

## Formato de um requisito

```markdown
### RF-001 — <título curto>

**Prioridade:** Must | Should | Could | Won't (MoSCoW)
**Status:** Proposto | Aprovado | Implementado | Cancelado
**Descrição:** o que o sistema deve fazer, do ponto de vista de quem usa.
**Critérios de aceite:**
  - [ ] dado <contexto>, quando <ação>, então <resultado observável>
  - [ ] ...
**Regras de negócio relacionadas:** RN-00X, RN-00Y
**Tarefas:** TASK-00X (preenchido quando a tarefa é criada)
**Origem:** quem pediu / documento
```

Requisitos não funcionais (`RNF-*`) seguem o mesmo formato, mas os critérios de aceite são
mensuráveis: "responde em < 300 ms no p95", "suporta 500 usuários simultâneos", "conforme LGPD".

## Regras

- IDs nunca são reutilizados. Requisito cancelado fica com status `Cancelado`.
- Critério de aceite ambíguo é critério de aceite errado. Se um agente não consegue transformar um
  critério em teste, ele registra a dúvida no handoff e a pessoa responsável reescreve o critério.
- Requisito ≠ tarefa. Um requisito pode gerar várias tarefas; uma tarefa raramente cobre vários requisitos.

## Índice

| Arquivo | Conteúdo | Status |
|---------|----------|--------|
| [`functional.md`](functional.md) | RF-001..RF-024, transcritos da doc-fonte § 4 | Proposto |
| [`non-functional.md`](non-functional.md) | RNF-001..RNF-012, transcritos da doc-fonte § 5 | Proposto |
