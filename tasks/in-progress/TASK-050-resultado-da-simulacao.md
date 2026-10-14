# TASK-050 — corrigir "durante a simulação não retorna o resultado"

| Campo                 | Valor                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| **Status**            | in-progress                                                           |
| **Prioridade**        | alta                                                                  |
| **Criada em**         | 2026-10-14 por Anderson Sehnem (pedido em chat)                       |
| **Iniciada em**       | 2026-10-14                                                            |
| **Concluída em**      | —                                                                     |
| **Branch**            | `task/TASK-050-resultado-da-simulacao` (a partir de `development`)    |
| **PR**                | —                                                                     |
| **Requisitos**        | RF de avaliação em tempo real (doc-fonte §§ 15.4 e 17.2), RNF-003      |
| **Regras de negócio** | RN-004, RN-007, RN-008 (nenhuma nova)                                 |
| **Estimativa**        | P                                                                     |

---

## 1. Objetivo

Fazer o simulador mostrar o resultado do backend enquanto a pessoa opera o guindaste, em vez de
"Não avaliável" quase o tempo todo ou "atualizando…" sem fim.

## 2. Contexto

Primeira tarefa da leva E (pedido da pessoa responsável em 14/10/2026: colisão, tombamento, limite
de capacidade por modelo, acessórios, patolas, obstáculos, área de operação, terreno, gravação e
reprodução). Plano da leva no handoff desta tarefa, § 9.

Causas verificadas no código:

1. A consulta conservadora só avalia um comprimento de lança que seja coluna da tabela (ADR-015;
   known-gaps L-004), mas o slider anda de 0,1 em 0,1 m. Com a tabela demo (12, 17 e 22 m), quase
   toda posição volta `BOOM_LENGTH_NOT_IN_CHART`.
2. O peso só ia para a avaliação com o formulário de carga inteiro válido (L-009).
3. Sem tempo máximo no REST nem espera de resposta no WebSocket: um canal meio aberto ou o backend
   do Render acordando (~1 min) deixavam "atualizando…" sem explicação.
4. No modo só REST (Vercel), a barra dizia "Conexão fechada".

## 3. Critérios de aceite

- [x] **CA-1** — O slider da lança é livre (0,1 m). Para um comprimento entre colunas, o backend usa a
  coluna da próxima lança mais longa (ADR-029, decisão de 14/10/2026). Acima da maior coluna, "não
  avaliável" com `BOOM_LENGTH_ABOVE_CHART_MAX`. Nada é interpolado (RN-004). (Uma primeira versão
  encaixava o slider nas colunas; foi rejeitada pela pessoa.)
- [x] **CA-2** — O peso válido vai para a avaliação mesmo com os outros campos da carga incompletos.
- [x] **CA-3** — Sem resposta do WebSocket em 8 s, o mesmo `sequence` é repetido por REST.
- [x] **CA-4** — O REST desiste em 75 s com o código `TIMEOUT`, e o erro aparece no HUD.
- [x] **CA-5** — Com um envio sem resposta há mais de 4 s, o HUD e a barra avisam que o backend está
  demorando (pode estar acordando).
- [x] **CA-6** — No modo só REST, a barra mostra "Avaliação por REST".
- [x] **CA-7** — Testes unitários e um E2E no navegador (dados FICTÍCIOS) cobrem CA-1..CA-6.

## 4. Fora do escopo

Tudo o mais da leva E (TASK-051..057). Interpolação entre comprimentos (PEND-001..003).
