# TASK-054 — patolas animadas

| Campo                 | Valor                                                              |
| --------------------- | ------------------------------------------------------------------ |
| **Status**            | in-progress                                                        |
| **Prioridade**        | alta                                                               |
| **Criada em**         | 2026-10-14 por Anderson Sehnem (leva E, pedido em chat)            |
| **Iniciada em**       | 2026-10-14                                                         |
| **Branch**            | `task/TASK-054-patolas` (a partir de `leva-e/contratos`)           |
| **Regras de negócio** | RN-013 (entradas)                                                  |
| **ADR**               | ADR-024                                                            |

## 1. Objetivo

Patolas animadas no modelo 3D: estender as vigas, descer os macacos até o terreno e nivelar, com
controles na tela e o estado enviado ao backend. Nada desenhado por código como substituto.

## 2. Critérios de aceite

- CA-1 — A análise do GLB registra se há vigas, macacos e sapatas (ADR-024; handoff).
- CA-2 — Se não houver, nada é modelado: a pendência fica no handoff.
- CA-3 — `OutriggerController` anima extensão de 0 a 100 %, descida dos macacos e nivelamento até
  `max_leveling_deg` (constante FICTÍCIA de 3° se o tipo não existir), invalidando o render enquanto anima.
- CA-4 — `setOutriggers` no handle e prop `outriggers` no `CraneViewport`, aditivos.
- CA-5 — Controles estender/recolher e apoiar/nivelar, com aviso de "patolas não prontas".
- CA-6 — REST e WebSocket enviam `outriggers: { extension_percent, jacks_set }` (omitido sem patolas).
- CA-7 — O backend aceita o campo opcional, validado, sem uso.
- CA-8 — Testes unitários, de contrato e e2e; nenhum teste existente quebra.
- CA-9 — Captura em `docs/assets/screenshots/leva-e/` só se o modelo permitir (não permite).
