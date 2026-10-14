# Handoff — TASK-073 — carga posicionável, ponto de entrega, engatar e soltar

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-073-coleta-e-entrega.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador (sem revisor independente ainda) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-073-coleta-e-entrega`, a partir de `anderson/development` |

---

## 1. Objetivo desta etapa

A pessoa define a posição inicial da carga na cena, como faz com os obstáculos; na simulação, vai até a
carga, engata, leva até um ponto de entrega e solta (ADR-035).

## 2. O que foi feito

- Contrato aditivo e opcional no cenário: `cargo` (`x`, `z`, `rotationYDeg`) e `delivery` (`x`, `z`,
  `rotationYDeg`, `radiusM`) em `environment.ts`, no cliente REST e no backend (`scenario.py`,
  `scenario_schemas.py`; raio de 0,5 a 30 m).
- Domínio puro em `src/domain/cargo/cargoOperation.ts`: apoio da base no terreno, condições de
  engatar (até 0,5 m acima do topo, 0,5 m na horizontal) e soltar (base a até 0,2 m do chão), posição
  relativa ao gancho, entrega dentro do raio, tempo da operação. `loadBox.ts` ganhou a posição engatada
  (deslocamento, giro e altura das lingas) e `collisions.ts` colide a carga engatada fora do eixo.
- Cena: `CargoOperation` (estado, carga no chão, ligação com `HookLoad` e com as colisões),
  `GroundCargo`, `DeliveryMarker` (anel, disco e cruz seguindo o relevo); a carga no chão é obstáculo
  das colisões (`SceneCollisions.setGroundCargo`) e não vai à avaliação como conflito.
- Editor: ferramentas "Posicionar carga" e "Ponto de entrega", seleção, mover, girar, raio pela
  escala, excluir e desfazer (`SceneEditor`, `useEnvironmentEditor`, `EnvironmentEditorToolbar`,
  `cargoEditing.ts`).
- Interface: faixa `CargoOperationPanel` (três passos como dicas, mensagem do que falta, botões Engatar
  e Soltar, sucesso com o tempo, aviso "fora do ponto de entrega"); textos em `cargoGuidance.ts`.
  `SimulatorRoute` manda peso 0 à avaliação com a carga no chão.
- Gravação: `cargo` aditivo no quadro, marcadores de engatar e soltar na linha do tempo, reprodução
  mostra a carga.
- ADR-035 e índice; tarefa; este handoff; capturas em `docs/assets/screenshots/leva-f/task-073-*`.
- Teste ponta a ponta `e2e/tests/cargoDelivery.spec.ts` (catálogo e avaliação FICTÍCIOS no navegador):
  posiciona, aproxima o gancho pela dica "faltam X m", engata, leva, solta no alvo, vê "Entregue", grava,
  salva e reproduz.

## 3. Arquivos modificados

Ver `git diff --stat development...HEAD`. Tudo está no escopo; os de integração tiveram só mudanças
aditivas (`SimulatorRoute`, `SimulatorPage`, `CraneViewport`, `mountCraneScene`, `buildCraneScene`,
`SceneEditor`, `SceneCollisions`, `HookLoad`, `collisions.ts`, `loadBox.ts`).

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| frontend: `npm run lint` | passou | sem avisos |
| frontend: `npm run format:check` | só um aviso, que já existia | `scripts/convert-crane-80t.mjs` (arquivo que não toquei) |
| frontend: `npm run typecheck` | passou | `tsc -b && tsc -p e2e` |
| frontend: `npm test` | passou | 94 arquivos, 871 testes (1 pulado) |
| frontend: `npm run build` | passou | |
| frontend: `npm run e2e` | E2E_RESULT | modo sem banco: os testes com banco pulam |
| backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | passou | |
| backend: `pytest` (sem `test_create_admin::...invalid_database_url...`) | passou | os de integração pulam sem Postgres |

Validação no navegador (vite dev na porta 5180, com a sessão do admin do backend Docker): vi a faixa,
o editor, a carga e o alvo colocados na cena e os botões; o ciclo completo foi feito pelo Playwright
(`cargoDelivery.spec.ts`) e as capturas estão em `docs/assets/screenshots/leva-f/`.

## 5. Decisões e limites

- Sem `cargo`, nada muda (a carga continua no gancho; peso sempre na avaliação).
- A altura das lingas ao engatar é a distância que havia até o topo, para a carga não pular nem entrar
  no chão ao subir.
- O tempo da operação conta do primeiro engate até a soltura no alvo.
- Valores (0,5 m, 0,2 m, raio padrão de 2 m) são FICTÍCIOS e configuráveis (ADR-012).
- O backend Docker em uso na validação ainda é o da imagem antiga: salvar um cenário com `cargo` ou
  `delivery` nele daria 422 (`extra="forbid"`) até a imagem ser refeita; o cenário em edição e a
  gravação funcionam (a gravação guarda o cenário como JSON livre).
- A faixa de coleta e entrega ocupa duas linhas sobre a cena; em 1280 × 720 o quadro 3D ficou com
  pouco mais de 300 px.

## 6. O que não foi feito

Ver "Testes a escrever depois" na tarefa. O `e2e` com o backend de verdade (`E2E_BACKEND=1`) não foi
rodado.

## 7. Próximo passo

Revisor: conferir no monitor maior o arrasto e o giro da carga e do alvo com o mouse, e o engate em
terreno inclinado. Depois, refazer a imagem Docker do backend para os cenários aceitarem `cargo` e
`delivery`.

Ler primeiro: `docs/decisions/ADR-035-carga-posicionavel-entrega-engatar-e-soltar.md`,
`frontend/src/domain/cargo/cargoOperation.ts`, `frontend/src/three/scene/CargoOperation.ts`.
