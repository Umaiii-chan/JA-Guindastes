# ADR-010 — REST + WebSocket

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-007" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.198–201.
Ela é renumerada aqui como ADR-010 porque os números ADR-001..003 já existem neste repositório
(ADR-007 da doc-fonte = ADR-010 deste repositório).

Relaciona-se com: RF-015..RF-019, RNF-003; API e mensagens na doc-fonte § 15 (o campo `sequence` permite ignorar respostas antigas).

## Decisão

Texto literal da doc-fonte:

> **REST:** cadastros, uploads, consultas, criação/carregamento de simulações.  
> **WebSocket:** ciclo interativo de atualização operacional e retorno de capacidade/alertas.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **REST + WebSocket (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- "Cálculo correto, mas resposta visual atrasada" (doc-fonte § 25) → debounce/throttle, sequence IDs.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Proposto`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.198–201).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
