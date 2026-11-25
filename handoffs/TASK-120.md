# Handoff — TASK-120 — recomendar e planejar com 2 guindastes

> Tarefa em paralelo: este handoff é `handoffs/TASK-120.md`; `handoffs/current.md` não foi editado.

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-120-planejar-com-dois-guindastes.md` |
| **Etapa concluída** | planejamento + implementação (frontend) + testes |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (uma sessão; revisão independente pendente) |
| **Ferramenta/agente** | Claude Code |
| **Branch** | `task/TASK-120-planejar-com-dois-guindastes`, de `origin/development` @ `af0f2a6` |

## 1. Achado do mapeamento (verifiquei no código)

O recurso já existia pela metade: RN-016 e ADR-037/038/041 aceitos; `RecommendLiftPlan` tenta o tandem
quando nenhum guindaste sozinho é válido (`recommend_lift_plan.py`, testes em
`test_recommend_lift_plan*.py`) e devolve duas posições, duas trajetórias e `details` por guindaste.
**Backend e API não mudaram.** Faltava na tela: o aviso na avaliação de um guindaste, a divisão por
guindaste na recomendação, e ligar o tandem ao "Aplicar" (antes a pessoa tinha de ligar à mão).

## 2. O que foi feito

- `application/planning/singleCraneShortfall.ts` (novo, puro): gatilho (ADR-054 § 2).
- `BackendEvaluationPanel`: aviso "Recomendamos operar com 2 guindastes" + botão que abre a folha
  Planejar (`useSimulatorLayout`); sem layout (fora do simulador) não aparece.
- `PlanningPanel`: aviso quando só há tandem; lista a divisão por guindaste; texto do "Aplicar" atualizado.
- `PlanningSection`: `onApplied(kind)`; passo "Posicionar" lista as duas posições no tandem.
- `SimulatorRoute`: `onApplied` liga (`activateTandem`) ou desliga (`deactivateTandem`) o içamento com dois.
- ADR-054 (Aceito), TASK-120, índice de ADRs.

## 3. Verificação (saída real)

- `npx tsc -b && npx tsc -p e2e` → OK. `npx eslint src tests` → sem avisos.
- `npx vitest run tests/application/planning tests/presentation` → 270 testes; com 32 workers 2 a 4 falham
  por **timeout de 5 s** (arquivos diferentes a cada rodada: `tablesZones`, `planningRunStrip`,
  `simulatorLayout`); com `--maxWorkers=4`, `tests/presentation/simulator` + `tablesZones` → 8 arquivos, 46
  testes passando. Ou seja, instabilidade por carga da máquina, não regressão (mesma família da TASK-114).
- Suíte completa do frontend, backend (`pytest`) e e2e: **NÃO EXECUTADO** (backend não foi alterado).
- **Fluxo na tela com backend real (planejar → aplicar → executar com dois): NÃO EXECUTADO.** O que está
  provado: o gatilho, o aviso, a divisão e o texto (testes); o contrato do tandem do backend (testes
  existentes). Não está provado: a ligação `onApplied → activateTandem` na tela e o engate dos dois pela
  trajetória.

## 4. Decisões e dúvidas para a pessoa responsável (ADR-054)

**Atualização 2026-11-25:** a pessoa confirmou o gatilho (item 1) em chat; ADR-054 passou a Aceito. Itens 2 e 3 seguem em aberto.

1. O gatilho (> 100 % do limite, ou além da tabela: `POINT_NOT_IN_CHART`, `BOOM_LENGTH_ABOVE_CHART_MAX`,
   `RADIUS_ABOVE_CHART_MAX`; fora disso, não recomenda) é o desejado?
2. Registrar o gatilho como RN em `docs/business-rules.md` (protegido; não editei).
3. O Guindaste 2 acompanha o 1 na trajetória (ADR-037); o passo a passo de fases é só o do 1. Basta?

## 5. O que não foi feito

- Teste e2e (Playwright) do fluxo; teste de `SimulatorRoute` (arquivo grande, sem teste de unidade hoje).
- Nenhuma mudança de backend/regra de cálculo.

## 6. Próximo passo

**Papel:** Revisor, depois pessoa responsável. Conferir na tela (carga pesada → aviso → Planejar → Aplicar →
Executar) e responder § 4. **Ler primeiro:** ADR-054, `PlanningSection.tsx`, `singleCraneShortfall.ts`.
