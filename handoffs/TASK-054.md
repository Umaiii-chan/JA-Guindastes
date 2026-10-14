# Handoff — TASK-054 — implementação (patolas animadas)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-10-14 (BRT) |
| **Tarefa** | `tasks/in-progress/TASK-054-patolas.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-054-patolas` (a partir de `leva-e/contratos`) |

## 1. Objetivo desta etapa

Patolas animadas vindas do modelo 3D (decisão: nada desenhado por código como substituto).

## 2. O que foi feito

- Analisei o GLB: as quatro malhas do chassi (`chassi-amarelo/branco/preto/vidro`) foram separadas
  em componentes conexos (27, 32, 48 e 6). **Não há vigas, macacos nem sapatas**: as 20 peças de
  y 0 a 0,94 m são pneus (cinco eixos, rodado duplo, z de -1,63 a 4,16); as peças mais largas em X
  são o quadro (z -2,26 a 3,77) e a carroceria traseira; o resto é para-lama, para-choque, faróis,
  cabine. Nenhuma tem a forma de patola nem está nos cantos junto ao chão. Conforme a regra, **não
  modelei nada** e não criei script de geração; o GLB e o SHA do teste ficam como estão.
- Criei `OutriggerController` (`frontend/src/three/crane/`): extensão 0–100 %, descida dos macacos
  até o terreno (`groundHeightAt`, plano por padrão), nivelamento até o máximo; invalida o render
  enquanto anima; move só os nós `crane-outrigger-*` que existirem.
- `setOutriggers` (aditivo) no handle de `mountCraneScene` e prop `outriggers` em `CraneViewport`.
- `OutriggerPanel` (estender, recolher, apoiar e nivelar; aviso "Patolas não prontas") na etapa
  Posição do simulador.
- Clientes REST e WS enviam `outriggers: {extension_percent, jacks_set}` (omitido sem patolas).
- Backend: `OutriggersRequest` (`outrigger_schemas.py`) opcional em `EvaluationRequest` e no payload
  do WS; validado, sem uso.
- ADR-024.

## 3. Arquivos modificados

Aditivos nos de integração: `SimulatorRoute.tsx`, `mountCraneScene.ts`, `CraneViewport.tsx`,
`evaluationContract.ts`, `evaluationMessages.ts` (frontend), `evaluation_schemas.py`,
`evaluation_messages.py` (backend). `evaluate_operation.py` não foi tocado (campo sem uso).

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` / `format:check` / `typecheck` | passou | sem erros |
| `npm test` | passou | 74 arquivos, 737 passed, 1 skipped |
| `npm run build` | passou | built |
| `npm run e2e` | passou | 13 passed, 11 skipped (exigem backend) |
| `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | passou | 3 contratos mantidos |
| `uv run pytest` | passou, salvo a falha conhecida | só `test_create_admin.py::test_main_with_an_invalid_database_url_does_not_echo_it` |

## 5. Decisões tomadas

- ADR-024. `max_leveling_deg` ainda não existe no tipo: constante FICTÍCIA de 3°
  (`FICTITIOUS_MAX_LEVELING_DEG`); curso das vigas FICTÍCIO de 1,2 m. Trocar pelos valores do
  catálogo quando a TASK-051 entrar.
- "Apoiar e nivelar" aplica a correção máxima; a correção real será min(inclinação do terreno, máximo)
  quando a TASK-052 trouxer o terreno (`residualSlopeDeg` já existe).
- `ground_slope_deg` não é enviado ainda (depende do terreno).

## 6. Regras de negócio aplicadas

- RN-013 (entradas): o estado das patolas vai ao backend; "prontas" = 100 % e apoiadas
  (`outriggersReady`), com aviso na tela.

## 7. O que NÃO foi feito e por quê

- Patolas visíveis na cena e captura em `docs/assets/screenshots/leva-e/`: o modelo não as tem.
- Inclinar o guindaste no nivelamento: depende do terreno (TASK-052).
- Teste do controller contra o GLB real: não há nós; os testes usam nós de teste com os nomes do contrato.

## 8. Pendências / decisões necessárias

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Qual modelo 3D de terceiros (com licença) tem guindaste com patolas, ou existe o FBX original com elas? Download só com sua confirmação. | sim, para ver as patolas | | |
| 2 | Com o modelo: escrever script determinístico que o converta para `crane-outrigger-{fl,fr,rl,rr}-{beam,jack,pad}`, atualizar o GLB, o SHA em `tests/three/loaders/truckCraneModel.test.ts` e o development-guide. | sim | | |

## 10. Próximo passo

**Papel:** Pessoa responsável (pendência 1), depois Implementador.

**Ler primeiro:** `AGENTS.md`, este handoff, `docs/decisions/ADR-024-patolas-animadas.md`,
`frontend/src/three/crane/OutriggerController.ts`, `docs/leva-e/contratos.md` § 6.

**Cuidado com:** o controller mede o repouso dos nós na primeira vez que os vê; o modelo novo deve
trazer as patolas recolhidas. Conflitos prováveis com outras tarefas da leva E em `mountCraneScene.ts`
(handle) e `SimulatorRoute.tsx` (props do viewport e painel da etapa Posição).

## 11. Como revisar

Comece por `OutriggerController.ts` e seu teste; depois o painel e o envio nos clientes. Menos certeza:
o cálculo da descida (`apply`) sem modelo real para confrontar.
