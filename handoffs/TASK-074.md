# Handoff — TASK-074 — içamento com dois guindastes (tandem)

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-074-tandem.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-074-tandem` (a partir de `anderson/development`) |

Depende só da base atual (`anderson/development`). Conflitos esperados com as tarefas paralelas da leva F
(072, 073, 075, 076): `environment.ts` e `scenario.py` (campos `cranes` e `cargo`), `scenarioRestClient.ts`,
`SimulatorRoute.tsx`, `CraneViewport.tsx`, `mountCraneScene.ts` e `docs/business-rules.md`.

## O que foi feito

- Regra RN-016 registrada em `docs/business-rules.md` (origem: Anderson Sehnem, em chat em 2026-10-14) e ADR-037.
- Backend:
  - `domain/services/tandem_load_split.py`: divisão pela alavanca (CG projetado na reta dos pontos; fora do trecho, partes limitadas e alerta).
  - `EvaluateOperation.execute(..., capacity_factor=1.0)` e `evaluate_capacity_limit(..., extra_factor=1.0)`: o fator multiplica a capacidade efetiva junto à inclinação e ao vento. O padrão não muda nada.
  - `application/use_cases/evaluate_tandem.py` e `POST /api/v1/evaluations/tandem` (`presentation/api/tandem.py`); alertas em pt-BR; 422 com pontos iguais.
  - Cenário: `cranes` (até 3) e `cargo` em `entities/scenario.py`, nos schemas e no JSON gravado.
- Frontend:
  - Domínio: `domain/tandem/tandem.ts` (pontos de içamento, gancho no mundo, cinemática inversa, quadro e engate), `domain/collision/multiCraneCollisions.ts`, `cranes?`/`cargo?` no `ScenarioSpec`.
  - Cena: `ExtraCrane` (rig completo do mesmo GLB, controller, colisões e patolas próprios), `MultiCrane` (guardas de colisão, engate, sincronia, soltar), `TandemCargo` (carga no chão com marcadores e içada com lingas). `SwitchableCrane` ganhou `applyUnguarded` e `setAppliedListener`.
  - Editor: botão "Adicionar guindaste" (janela com fabricante, guindaste e configuração) e seleção, arrasto, giro e exclusão dos guindastes adicionais.
  - Simulador: seletor "Guindaste 1 / Guindaste 2", seção "Içamento com dois guindastes" (ativar, posicionar a carga, engatar, soltar) e ficha `TandemHud` (divisão em kg e %, uso do permitido, alertas).

## Decisões

- O contrato de `cargo` da TASK-073 não existia neste branch: criei `cargo?: { x, z, rotationYDeg }` exatamente como no contrato (sem o editor da carga, que é da 073; aqui a carga se posiciona por campos X, Z e giro na seção do tandem).
- Arranjo padrão: o segundo guindaste entra a 8 m, ao lado e com o mesmo rumo; a carga fica a 10,5 m à frente, com o comprimento na linha dos dois. De frente um para o outro, as lanças (caixas medidas no modelo) se tocam com ganchos a menos de ~4 m.
- `tandem_ok`: os dois avaliáveis, nenhum acima do limite do tandem e nenhum com risco alto; a faixa de atenção conta como permitido, com alerta.
- O tandem usa os dois primeiros guindastes (o 1 e o primeiro adicional).

## Gates

| Comando | Resultado |
|---------|-----------|
| backend: `ruff check`, `ruff format --check`, `mypy app`, `lint-imports` | OK |
| backend: `pytest` | 1549 passaram, 88 pulados (integração, sem Docker local); o teste `test_main_with_an_invalid_database_url_does_not_echo_it` foi excluído (já falha localmente) |
| frontend: `npm run lint`, `typecheck`, `build` | OK |
| frontend: `npm test` | 95 arquivos, 884 passaram, 1 pulado |
| frontend: `npm run e2e` | 15 passaram, 11 pulados (precisam do backend) |
| frontend: `format:check` | OK |

## Validação no navegador

Backend desta branch na porta 8074 (o Docker em 8000 não tem a rota nova), Vite com proxy para ele, banco e seed do Docker. Demonstração: carga de 4.600 kg (8 m × 2 m × 1,5 m) a ~10,7 m de raio.
- Um guindaste só: 117,5 % da capacidade, acima do limite (`tandem-0-um-guindaste-nao-levanta.png`).
- Tandem: 2.300 kg e 50 % para cada; uso do permitido 85,4 %; capacidade efetiva de cada um 2.929 kg (3.905 kg da tabela × 0,75); içamento permitido (`tandem-4-engatado.png`, `tandem-5-carga-icada.png`).
- 6.000 kg: 109 % do permitido em cada um, içamento não permitido (`tandem-6-acima-de-75-por-cento.png`).
- Centro de gravidade deslocado 1 m: 25 % e 75 % (1.150 e 3.450 kg), o segundo passa dos 75 % (`tandem-7-cg-deslocado.png`).
- Lança do guindaste 2 contra a do 1: comando bloqueado no último estado seguro (`tandem-8-colisao-bloqueada.png`).

## Testes a escrever depois

- e2e do fluxo completo (adicionar guindaste, ativar, engatar, içar, soltar) com backend.
- Teste de componente de `TandemSection`, `TandemHud`, `AddCraneDialog` e `CraneSelector`.
- Teste do `SceneEditor` com os guindastes adicionais (selecionar, arrastar, excluir).
- Teste de `useTandemEvaluation` (debounce e descarte de resposta antiga).
- Caso de uso `EvaluateTandem` isolado (hoje coberto pela rota e pelo serviço).

## Pendências

- A gravação e a reprodução (TASK-057) gravam só o guindaste 1 e a carga do passo Carga; não registram o segundo guindaste nem o tandem.
- Só um segundo guindaste participa do tandem; os outros (até 3) só ficam na cena.
- O corpo para colisão são caixas medidas no modelo (a lança é uma caixa), então o arranjo de frente acusa colisão cedo. Capsulas ou malha dariam mais folga.
- O guindaste adicional trabalha com patolas estendidas e apoiadas; o risco por patolas só vale para o guindaste 1.
- O fator 0,75 e os limites usados são os informados pela pessoa responsável e os FICTÍCIOS do seed; não há tabela oficial no repositório.
