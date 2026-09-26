# ADR-004 — Clean Architecture

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-001" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.168–172.
Ela é renumerada aqui como ADR-004 porque os números ADR-001..003 já existem neste repositório
(ADR-001 da doc-fonte = ADR-004 deste repositório).

Relaciona-se com: RNF-001, RNF-002, RNF-012; camadas e dependency rule na doc-fonte §§ 8.4 e 18.2.

## Decisão

Texto literal da doc-fonte:

> **Decisão:** adotar Clean Architecture no backend.  
> **Motivo:** isolar regras de domínio e motor de cálculo dos frameworks, banco e formatos de entrada.  
> **Consequência:** endpoints e repositórios tornam-se adapters; casos de uso orquestram o domínio.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Clean Architecture (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- "Frontend concentrar regras de segurança" (doc-fonte § 25) → backend como fonte de verdade e testes de domínio.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Proposto`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.168–172).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
