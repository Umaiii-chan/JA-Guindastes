# Handoff — TASK-107 — implementação (D4 e F-19)

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-17 |
| **Tarefa** | `tasks/in-progress/TASK-107-rede-eletrica-icamento-critico-linga.md` |
| **Etapa concluída** | implementação (aguarda revisão) |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (Implementador da equipe) |
| **Branch** | `task/TASK-107-rede-eletrica-icamento-critico-linga`, base `anderson/development` (`c84a386`), mesclada com `e01410b` (TASK-106) |

## 1. O que foi feito

- **F-19:** `backend/app/domain/services/rigging.py` e `frontend/src/domain/rigging/slingGeometry.ts` (mesma
  conta: `queda = r·tan α`, padrão 60°, 45° se a linga passar de 8 m, 30°–90°). Planejador, tandem, engate e
  guia da cena usam a geometria; o plano devolve `sling_length_m/angle_deg/drop_m`; `sling_angle_deg` opcional
  no pedido (422 fora de 30°–90°). Paridade: `backend/tests/fixtures/sling_geometry_cases.json` lido por pytest e vitest.
- **D4:** `power_line.py` (tabela, distância 3D, giro varrido, zona do planejador), `critical_lift.py`,
  `PowerLineSpec` no cenário (persistência e schemas), `site` no REST e no WebSocket, `power_lines` e
  `critical_lift` na resposta, alertas depois do `assess_safety` (sem tocar o `tipping_risk`). Frontend:
  editor com tensão selecionável, malha 3D (cabo, postes e zona), cliente REST, `site` sempre enviado,
  painel com distâncias e plano de içamento crítico, caixa "carga sobre pessoas ou estruturas ocupadas".
- ADR-051 (Aceito, decisão delegada pelo Anderson), `known-gaps.md` (L-018, L-019), índice dos ADRs.
- Mesclei `anderson/development` (TASK-106, estabilidade por física): o gatilho de vento usa agora
  `wind_limit_ms` da EN 13000 (a constante `WIND_BLOCK_LIMIT_MS` deixou de existir).

## 2. Comandos executados (saída real)

| Comando | Resultado |
|---------|-----------|
| `cd backend && pytest -q` | passou (suíte inteira, com 17 testes pulados de integração) |
| `ruff check app tests` / `ruff format --check` | passou |
| `mypy app` | `Success: no issues found in 183 source files` |
| `lint-imports` | `Contracts: 3 kept, 0 broken` |
| `cd frontend && npx vitest run` | `144 files, 1319 passed, 1 skipped` |
| `tsc -b`, `eslint .`, `prettier --check .` | passaram |
| `bash scripts/check-structure.sh` | `OK: 0 erros, 1 aviso(s)` |

## 3. Decisões e achados

- **⚠️ A tabela de distância decidida não confere com a Tabela A do OSHA 1926.1408** (10/15/20/25/35/45
  pés; conferido em osha.gov). Acima de 50 kV a implementada é menos conservadora. Implementei como decidido
  e registrei no ADR-051 e em L-018; a troca é local (`power_line.py`, `powerLine.ts`, JSON de casos).
- Lingas a 60° ficam mais altas que a heurística antiga: testes de cena/colisão que dependiam da altura
  antiga foram ajustados (cabo mais curto, lingas de 45° ou pose engatada com 2 m), com comentário em cada um.
- A regra de engate mudou: o gancho precisa estar perto do ponto em que as lingas esticam, não mais a até
  0,5 m do topo. A mensagem da guia mudou junto.

## 4. Não foi feito

- `docs/business-rules.md` (pessoa responsável); controle do ângulo da linga na tela; `hook_attach_m` no `site`;
  `safe-merge.sh` não foi localizado no repositório nem no PATH (o merge fica com a pessoa).

## 5. Próximo passo

**Papel:** Revisor (Coruja), depois a pessoa responsável: decidir a tabela (L-018) e fazer o merge.
**Ler primeiro:** `docs/decisions/ADR-051-...md`, `backend/app/domain/services/{rigging,power_line,critical_lift}.py`.
