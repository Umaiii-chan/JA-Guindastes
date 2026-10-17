# Handoff — TASK-101 (soltar a carga sobre a carroceria do caminhão)

- **Agente/papel:** Claude Code (Sonnet), implementador. Sem revisão independente ainda.
- **Etapa:** implementação e testes unitários completos; E2E NÃO EXECUTADO (prazo curto da pessoa
  responsável; confiar no CI).

## O que foi feito
- `objectLibrary.ts`: campo opcional `loadBed` (só no `caminhao-plataforma`, = caixa da carroceria) e
  `scaledLoadBed`.
- `domain/cargo/loadBeds.ts` (novo): carrocerias no mundo e sobreposição da pegada (eixos separadores).
- `cargoOperation.ts`: `cargoBaseY`, `checkEngage`, `engageCargo`, `checkRelease`, `releaseCargo` e
  `cargoStatusOf` recebem `obstacles` (último parâmetro, opcional); a superfície de apoio é o maior
  entre terreno e topo da carroceria sob a pegada. `RELEASE_MAX_HEIGHT_M` segue 0,2 m.
- `three/scene/CargoOperation.ts`: passa `spec.obstacles`; a carga solta assenta na carroceria e a
  caixa de colisão da carga no chão usa essa altura.
- ADR-046 (Proposto), TASK-101, testes `tests/domain/cargo/loadBeds.test.ts` (12 casos).

## Fatos / decisões
- A caixa da biblioteca é arredondada ao centímetro: topo 1,86 m e carroceria até z = +0,005 m.
- `heightAboveGroundM` agora significa "acima da superfície de apoio" (nome mantido; contrato da UI).
- Texto de `cargoGuidance.ts` ("do chão") e a mensagem de `SimulatorRoute.tsx` ("perto do chão")
  não foram alterados: o segundo está fora do escopo (outra branch). Sobre a carreta o texto fica
  impreciso, mas o valor mostrado já é o certo.

## Verificação (saída real)
- `npm run lint`, `npm run format:check`, `npm run typecheck`: sem erros.
- `npm test`: 132 arquivos, 1180 passam, 1 ignorado. Uma primeira execução teve 12 falhas
  intermitentes (suspeita: timeout por pouca memória; não investigado); as duas seguintes passaram.
- `npm run build`: OK (só o aviso de chunk grande).
- E2E: NÃO EXECUTADO.

## Pendências
- Outros objetos de topo plano (caçamba de picape, contêiner, baú) não recebem carga: decisão da
  pessoa responsável.
- Ajustar os textos "do chão" na dica e em `SimulatorRoute.tsx` (outra branch).
- Carga solta sobre o caminhão não o acompanha se o caminhão for movido no editor.
- E2E curto da soltura sobre a carreta.

## Próximo passo
Revisão independente (Coruja) e CI.
