# ADR-008 — GLB/glTF como formato 3D interno

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-26 |
| **Autor** | equipe do projeto (decisão na doc-fonte v0.1 § 7); formato ADR redigido pelo agente Claude Code 2.1.280, sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-003 |
| **Substitui** | — |

## Contexto

Decisão consolidada nas discussões do projeto e registrada como "ADR-005" na
[documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md) (13/08/2026), § 7, l.188–191.
Ela é renumerada aqui como ADR-008 porque os números ADR-001..003 já existem neste repositório
(ADR-005 da doc-fonte = ADR-008 deste repositório).

Relaciona-se com: RF-003, RF-004, RNF-004, RN-003; fluxo do modelo 3D e requisitos do asset na doc-fonte § 12.

## Decisão

Texto literal da doc-fonte:

> **Decisão:** arquivos CAD originais podem vir em outros formatos, mas o runtime web trabalhará com GLB/glTF preparado.  
> **Motivo:** hierarquia de nós, materiais e integração direta com Three.js.

## Alternativas consideradas

A doc-fonte não registra alternativas para esta decisão. Se a equipe quiser registrá-las, isso deve
ser feito antes do aceite, porque depois o ADR fica imutável.

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **GLB/glTF como formato 3D interno (escolhida)** | ver "Decisão" | não registradas na doc-fonte | — |

## Consequências

**Positivas:**
- as registradas em "Decisão" (motivo/regra), quando houver.

**Negativas / custos:**
- não registradas na doc-fonte.

**Riscos e como mitigar:**
- "Modelo CAD muito pesado ou inadequado para web" e "Pivôs/nós do modelo não preparados" (doc-fonte § 25) → pipeline de conversão/otimização para GLB; checklist de preparação e mapeamento configurável.

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Aceito`
- [ ] `docs/development-guide.md`: não se aplica até existir código
- [ ] `docs/known-gaps.md`: sem limitação nova
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- **Verificado:** o texto de "Decisão" é cópia literal da doc-fonte § 7 (l.188–191).
- **Não feito:** a decisão não foi reavaliada tecnicamente nesta tarefa; o ADR só a registra no
  formato do repositório.
