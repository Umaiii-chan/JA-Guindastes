# ADR-009 — Tabelas estruturadas no banco

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-006" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.193–196.
Ela é renumerada aqui como ADR-009 porque os números ADR-001..003 já existem neste repositório
(ADR-006 da doc-fonte = ADR-009 deste repositório).

Relaciona-se com: RF-006..RF-009, RNF-005, RNF-006, RN-005; fluxo e validações de importação na doc-fonte § 13.

## Decisão

Texto literal da doc-fonte:

> **Decisão:** CSV/XLSX serão importados e normalizados; o documento original será preservado separadamente.  
> **Motivo:** cálculo não deve depender de leitura de planilha a cada frame/interação.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Tabelas estruturadas no banco (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- "Tabelas com formatos diferentes" (doc-fonte § 25) → importer por adapter e formato normalizado interno. Formato real das tabelas: PEND-008.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Proposto`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.193–196).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
