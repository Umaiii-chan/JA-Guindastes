# Handoff — TASK-069 — ajustes do modelo 80 t (integra TASK-064 e TASK-066)

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Ferramenta/agente** | Claude Code (Opus 5.5) |
| **Branch** | `task/TASK-069-ajustes-modelo` (inclui os PRs #20 e #21) |

## O que foi feito

1. **Eixo de giro real (ADR-034):** a = 0,46 m no conversor, no padrão do frontend, no seed e no
   modelo de exemplo. O seed migra a ficha antiga. Os números da demonstração foram recalculados.
2. **Modelo:** o chassi foi girado 180° (a lança fica sobre a cabine) e a cabeça da lança ganhou
   material liso na cor da lança. O GLB foi regenerado e o SHA atualizado.
3. **Aviso "comando bloqueado":** fica 2 s visível, com o contato que bloqueou. O E2E voltou a
   conferir o aviso.
4. **Arquivos antigos:** removidos `guindaste-caminhao.glb` e `convert-crane-model.mjs`; docs
   atualizadas.
5. **Navegador (stack Docker, seed migrado):** a página completa do simulador com o modelo novo foi
   conferida; raio de 10,29 m na pose inicial, lança sobre a cabine e cabeça clara.

## Comandos

- frontend: lint, typecheck (app e e2e) e `npm test` passaram (836 testes); o e2e com o backend
  parado passou (15, inclusive o de colisões).
- backend: ruff, mypy e pytest passaram (`tests/test_demo_seed.py` com 25).

## Pendências

- Os nomes dos dados de demonstração (fabricante, zonas) ainda contêm "FICTÍCIO", porque vêm do banco.
