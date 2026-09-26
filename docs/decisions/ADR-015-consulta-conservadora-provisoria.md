# ADR-015 — Consulta conservadora provisória entre pontos da tabela de carga

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (**provisório**: vale até a Guindastes Ribas responder PEND-001 e PEND-003) |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), registrando a escolha da pessoa responsável |
| **Decisores** | Anderson Sehnem (escolheu a opção "conservador provisório" em chat, em 2026-09-26) |
| **Tarefa relacionada** | TASK-020 |
| **Substitui** | — |

## Contexto

A avaliação operacional (TASK-015) consulta a tabela de carga com o **raio calculado** pela geometria
do ADR-013. A única estratégia existente, `ExactPointLookup` (TASK-008), só aceita pontos idênticos aos
da tabela, e o raio calculado quase nunca coincide com um raio tabelado (ex.: `11.500000000000002`
contra `11.5`). Na prática, quase todo estado real saía "não avaliável".

O método de interpolação (PEND-001), o arredondamento (PEND-002) e o uso de valor conservador (PEND-003)
continuam pendentes com a empresa. O ADR-013 (C-6) prevê uma tolerância na comparação de comprimentos,
mas não fixa o valor.

## Decisão

Até a empresa responder, a consulta de capacidade usa a estratégia **conservadora provisória** abaixo,
escolhida pela pessoa responsável:

1. **Tolerância numérica ε = 1·10⁻⁶ m**, só para absorver ruído de ponto flutuante. Não é tolerância
   de engenharia: valores que diferem mais que ε são valores diferentes.
2. **Comprimento de lança:** precisa coincidir (±ε) com um comprimento tabelado. Caso contrário, a
   consulta é "não suportada" (RN-007). Não há interpolação nem arredondamento de comprimento; lança
   telescópica em comprimento intermediário fica fora do domínio (ADR-013).
3. **Raio**, dentro do comprimento encontrado:
   - coincide (±ε) com um raio tabelado → usa a capacidade desse ponto;
   - fica **entre** dois raios tabelados → usa a **menor** capacidade entre os dois pontos vizinhos.
     Numa tabela típica, é a capacidade do próximo raio maior. Se a tabela for atípica e o vizinho maior
     tiver capacidade maior, vale o menor valor, sempre do lado seguro;
   - fica abaixo do menor raio ou acima do maior raio tabelado (além de ε) → "fora do domínio" (RN-007).
4. O resultado informa o **raio consultado**, o **ponto tabelado efetivamente usado** e a marca de
   estratégia **provisória conservadora**, para que nenhuma tela apresente o valor como definitivo.
5. A capacidade sempre é um valor que está na tabela oficial vinculada à configuração (RN-004). Nada é
   extrapolado nem inventado.

A `ExactPointLookup` continua existindo. A troca de estratégia acontece na composição do caso de uso
(ela é injetada pela porta `LoadChartInterpolator`), sem mudar o domínio nem o caso de uso.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Conservador provisório (escolhida)** | valor sempre da tabela e do lado seguro; a demo passa a mostrar capacidade | pode subestimar a capacidade entre pontos | — |
| Só tolerância técnica | mais estrito | a avaliação quase nunca mostra capacidade | pouco útil para o MVP |
| Interpolação linear provisória | atende o roteiro ("algoritmo de interpolação") | pode dar capacidade acima do que o fabricante permite; depende de validação | risco de segurança antes da resposta da empresa |
| Esperar a empresa | nenhum risco novo | avaliação inútil até a resposta | atrasa o MVP |

## Consequências

**Positivas:**
- a avaliação passa a dar capacidade para qualquer raio dentro da faixa tabelada;
- o valor nunca fica acima do que a tabela permite nos pontos vizinhos.

**Negativas / custos:**
- entre pontos, a capacidade pode ficar abaixo da real (conservadorismo);
- a interpolação exigida pelo roteiro acadêmico continua pendente (PEND-001).

**Riscos e como mitigar:**
- *Valor provisório tratado como definitivo* → marca "provisório conservador" no resultado e na UI; a
  pendência continua em `docs/business-rules.md` (PEND-001, PEND-003).
- *O raio da tabela incluir deflexão da lança* (ADR-013, pergunta G-1) → o raio calculado sem deflexão
  fica menor que o real. É um risco que esta estratégia não resolve; continua aberto com a empresa.

## Impacto na documentação

- [x] índice em `docs/decisions/README.md`
- [x] `docs/architecture.md` § 8
- [x] `docs/known-gaps.md` (L-004 aponta para esta estratégia)
- [ ] `docs/business-rules.md`: PEND-001 e PEND-003 continuam abertas (arquivo protegido; nada muda)

## Evidências

- **Verificado:** a limitação da busca exata, documentada e testada na TASK-015
  (`handoffs/history/2026-09-26-TASK-015-implementacao.md`).
- **Hipótese:** que as tabelas da empresa têm capacidade decrescente com o raio (típico). A regra do
  menor vizinho protege mesmo se não tiverem.
