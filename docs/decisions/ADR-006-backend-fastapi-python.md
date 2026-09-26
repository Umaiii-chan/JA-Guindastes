# ADR-006 — Backend FastAPI + Python

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-003" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.179–182.
Ela é renumerada aqui como ADR-006 porque os números ADR-001..003 já existem neste repositório
(ADR-003 da doc-fonte = ADR-006 deste repositório).

Relaciona-se com: RNF-002, RNF-007, RNF-008; estrutura do backend na doc-fonte § 18.

## Decisão

Texto literal da doc-fonte:

> **Decisão:** FastAPI será o delivery mechanism HTTP/WebSocket.  
> **Regra:** schemas Pydantic ficam na camada de apresentação; entidades de domínio permanecem independentes.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Backend FastAPI + Python (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- nenhum risco específico listado na doc-fonte § 25.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Aceito`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.179–182).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
