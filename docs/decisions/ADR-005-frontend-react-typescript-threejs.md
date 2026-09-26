# ADR-005 — Frontend React + TypeScript + Three.js

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-002" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.174–177.
Ela é renumerada aqui como ADR-005 porque os números ADR-001..003 já existem neste repositório
(ADR-002 da doc-fonte = ADR-005 deste repositório).

Relaciona-se com: RNF-008, RNF-009; regra de integração React/Three.js e `CraneController` na doc-fonte §§ 12.2 e 17.3.

## Decisão

Texto literal da doc-fonte:

> **Decisão:** React gerencia UI e estado de aplicação; Three.js gerencia cena 3D e interação gráfica.  
> **Regra:** evitar componentes React contendo diretamente toda a lógica Three.js; usar controllers/adapters próprios para a cena.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Frontend React + TypeScript + Three.js (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- "Cálculo correto, mas resposta visual atrasada" (doc-fonte § 25) → debounce/throttle, sequence IDs, perfil de performance.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Proposto`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.174–177).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
