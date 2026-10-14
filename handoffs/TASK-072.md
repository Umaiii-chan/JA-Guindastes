# Handoff — TASK-072 — biblioteca de objetos reais no editor 3D

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (UTC-3) |
| **Tarefa** | `tasks/in-progress/TASK-072-objetos-reais.md` |
| **Papel exercido** | Implementador (sem revisor independente ainda) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-072-objetos-reais`, a partir de `anderson/development` |

## O que foi feito

- Domínio: `environment/objectLibrary.ts` (18 objetos, escala real, caixas de colisão por objeto) e
  `Obstacle.kind = 'model'` com `modelId`. `collision/collisions.ts` ganhou `obstacleObbs` (uma caixa
  por caixa da biblioteca, com giro, escala e a base no terreno); o alerta de cabo e lança sai uma vez
  por objeto.
- GLBs: `scripts/build-object-library.mjs` converte os kits CC0 da Kenney (fora do Git) para
  `public/models/objetos/` (escala real, base em y = 0, centro na origem, quantizados; cerca de
  660 KB) e gera o barracão aberto por código (porta de 8 × 6 m, piso e telhado translúcido). O
  guindaste estacionado usa `guindaste-80t.glb`. Créditos em `public/models/objetos/CREDITS.md`.
- Cena: `ObjectModels.ts` (cache, cópias que dividem geometria e material), `ObstacleMeshes.ts`
  (modelo na escala do obstáculo, assentado no terreno, com sombra, bloco de espera enquanto carrega e
  contorno de seleção), `SceneEditor.ts` (ferramenta `add-model`, seleção por contorno, base como
  origem ao arrastar), `objectThumbnails.ts` (miniaturas desenhadas dos próprios modelos).
- UI: ferramenta "Biblioteca" na faixa do editor, com a paleta `ObjectLibraryPalette` (abas por
  categoria, miniaturas ou ícones); `addModelAt` em `editorOps.ts`; os campos numéricos do painel
  "Ambiente" valem para os objetos; avisos de colisão sem frases repetidas.
- Backend: `ObstacleKind.MODEL` e `model_id` no cenário (validação, JSON e schema); cliente REST do
  frontend em `scenarioRestClient.ts`.
- ADR-036 e índice; `docs/development-guide.md` (árvore de pastas).

## Comandos

| Comando | Resultado |
|---------|-----------|
| frontend: `npm run lint`, `format:check`, `typecheck`, `build` | passou |
| frontend: `npm test` | passou: 95 arquivos, 883 testes (1 pulado) |
| frontend: `npm run e2e` (preview local, sem backend) | passou: 16 testes, 11 pulados (precisam de backend); inclui `objetosReais.spec.ts` |
| backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | passou |
| backend: `pytest` (sem `test_create_admin::..._does_not_echo_it`, falha conhecida) | passou; os de integração pulam sem Postgres |

Validação no navegador (vite dev, catálogo FICTÍCIO do e2e, sem backend): cenário com barracão,
três árvores, caminhão plataforma e carro colocados pela paleta; lança por dentro da porta e carga
dentro do barracão sem aviso (vista de cima, do operador e lateral); lança alta e cabo longo: o gancho
bate no teto, o comando é barrado e o aviso cita o barracão. Capturas em
`docs/assets/screenshots/leva-f/`: `biblioteca-paleta`, `barracao-selecionado`,
`carga-dentro-do-barracao-topo`, `-operador`, `-lateral` e `carga-barrada-pelo-telhado`.

## Decisões e limites

- Os galpões da Kenney são maciços (portão pintado): o barracão aberto é gerado por código (ADR-036).
- O forro do barracão é um sólido em degraus do beiral (7 m) até a água do telhado: a carga e o
  gancho não atravessam o teto de cima para baixo. O cabo e os estropos só avisam (ADR-028).
- As caixas de árvores e veículos são aproximações em camadas ou trechos; servem à pré-visualização.
- O backend Docker em execução não tem a mudança: salvar um cenário com objetos responde 422 até a
  imagem ser refeita. Sem salvar, tudo funciona.
- Não executei a avaliação real com `obstacle_conflicts` de objetos contra o backend Docker (a
  validação foi com o catálogo FICTÍCIO, sem backend); o envio do id é coberto por teste unitário.
- A ordem importa ao montar o cenário de teste: com o barracão no lugar, a guarda barra comandos que
  levam o gancho ao teto (comportamento esperado, RN-012).

## Próximo passo

Revisor: usar o mouse no editor com um monitor maior (selecionar e arrastar objetos, ajustar a
escala) e refazer a imagem do backend para salvar cenários com objetos.
