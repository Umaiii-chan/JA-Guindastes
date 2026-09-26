# ADR-011 — Monorepo

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-008" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.203–205.
Ela é renumerada aqui como ADR-011 porque os números ADR-001..003 já existem neste repositório
(ADR-008 da doc-fonte = ADR-011 deste repositório).

Relaciona-se com: RNF-011; estrutura recomendada na doc-fonte § 9, adaptada à raiz do repositório (`frontend/` e `backend/`) por decisão da pessoa responsável em 2026-09-26 (TASK-002).

## Decisão

Texto literal da doc-fonte:

> **Decisão:** manter frontend, backend e documentação em um único repositório acadêmico.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Monorepo (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

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

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.203–205).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
