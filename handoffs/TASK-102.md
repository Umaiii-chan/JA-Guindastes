# Handoff — TASK-102 — implementação

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-17 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-102-pendencias-planejador.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador e Engenheiro de testes |
| **Ferramenta/agente** | Claude Code (Bigorna), worktree `C:\dev\JA-Guindastes-wt\pend-plano` |
| **Branch** | `task/TASK-102-pendencias-planejador` (de `anderson/development` @ `13da390`) |

## 1. Objetivo desta etapa

Fechar as pendências do planejador da revisão do PR #48 (known-gaps L-016): apoio na carroceria,
teste do giro da carga e teste de um plano válido com a carga dentro do barracão aberto.

## 2. O que foi feito

- **Apoio no caminhão plataforma (CA-1).** `library_boxes.py`: `platform_truck_bed()` (espelho de
  `loadBed`, `TRUCK_FLAT_COLLISION[0]` de `objectLibrary.ts`), `bed_contains` e
  `is_platform_truck`. `sweep.py`: `support_top_y` (topo da carroceria, `0,53·h`), `_supports_load`.
  Critério de apoio (decisão do maestro, igual ao do frontend, `loadBeds.ts`): a carga só se apoia
  na carroceria quando o CENTRO da pegada cai dentro do retângulo girado e escalado da carroceria;
  senão vale o terreno e o caminhão é obstáculo comum (recusa a entrega, como outro obstáculo). A
  isenção do cabo da TASK-088 vale só para quem é apoio por esse critério (`surface.supports`).
  `delivery_surface` e `delivery_cover` usam o mesmo critério.
- **Giro da carga na entrega (CA-2).** `test_giro_da_carga_na_entrega_respeita_o_sentido_do_giro`
  (dois sentidos: coleta (-6, 0), entrega (0, ±6), giro de ∓73,7°; muro de 0,04 m no canto da carga
  girada, que bloqueia só com esse giro).
- **Plano com a carga dentro do barracão (CA-3).**
  `test_carga_dentro_do_barracao_aberto_passa_por_baixo_do_arco` (`test_planner.py`): guindaste
  FICTÍCIO de uma só lança de 14,0 m em z = 24, carga em (0, 10) e entrega em (3, 10,5), dentro do
  barracão de 12 m de altura; sai plano válido, lança de 14 m, altura de transporte de 1,0 m,
  atravessando `BARRACAO`.
- **known-gaps L-016 (CA-4).**

## 3. Provas por mutação (FATO)

- Sinal do giro: `planner.py:414` `+ sign * arc_deg` → `- sign * arc_deg`: os dois casos do teste do
  giro falham (`AssertionError`); revertido (`git diff` do arquivo vazio).
- Passagem por baixo: em `_swings`, a condição `elevation_m > _VAO_MIN_M` → `False`: o teste do
  barracão falha (`IndexError`: sem plano); revertido.

## 4. Achado importante (FATO + HIPÓTESE)

Com o barracão do **tamanho padrão** (8,27 m) e a lança de 14,0 m, o plano NÃO fecha neste
planejador, ao contrário do que o parecer da revisora indica para a pose de coleta: o fato é que a
conferência da aproximação (`_approach_collision`, que desce o gancho da pose de partida até acima
da carga) faz o cabo atravessar o teto (`colisao_cabo`); a coleta e o giro dentro do barracão
passam. Por isso o teste usa o barracão de 12 m. Com lança fixa, tirar a carga pela porta também
não fechou nas posições testadas (a lança teria de subir ainda sob o teto). Hipótese: uma ficha
real com lança contínua fecha mais casos; não verifiquei. Registrado em L-016.

## 5. Comandos e resultados (em `backend/`)

| Comando | Resultado |
|---------|-----------|
| `uv run ruff check .` | ✅ `All checks passed!` |
| `uv run ruff format --check .` | ✅ `330 files already formatted` |
| `uv run mypy app` | ✅ `Success: no issues found in 177 source files` |
| `uv run lint-imports` | ✅ `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ 1862 passed, 88 skipped, 0 failed (contagem dos pontos da saída) |
| `bash scripts/check-structure.sh` (raiz) | ver o commit final: o único erro era este handoff ausente |

Um teste de tempo (`test_cenario_pequeno_responde_em_menos_de_3_segundos`) falhou uma vez numa
rodada com a máquina carregada (outras execuções em paralelo) e passa isolado em 0,26 s: falso alarme
de carga.

## 6. Pendências / decisões

- O critério de apoio por centro da pegada deve constar no ADR-046 (Proposto); quem edita o ADR é o
  Cinzel (TASK-103), que aplica o mesmo critério no frontend. Não editei o ADR aqui.
- Fora do escopo e não feito: o caminhão plataforma inteiro continua prisma cheio na conferência do
  cabo e da lança (a cabine é mais alta que a carroceria).

## 7. Próximo passo

**Papel:** Revisor. Ler: `AGENTS.md`, este handoff, `backend/app/domain/services/planning/sweep.py`
(`_supports_load`, `delivery_surface`, `delivery_cover`) e `library_boxes.py`.
