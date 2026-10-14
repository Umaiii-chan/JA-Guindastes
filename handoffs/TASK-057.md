# Handoff — TASK-057 (gravar, salvar e reproduzir simulações)

- **Agente/papel:** Claude Code (Sonnet), implementador. Sem revisão independente ainda.
- **Etapa:** implementação completa; testes do frontend adiados.

## Arquivos
Backend: domínio `simulation_recording.py` e `recording_errors.py`; porta e caso de uso
`manage_simulation_recordings`; modelo, repositório e migration `d7a3c5e8f1b4` (down_revision
`b4e1d7c93a52`); `presentation/api/simulations.py`; ligações em `presentation/api/main.py` e `app/main.py`.
Frontend: `application/recording/*`, `infrastructure/api/simulationRecordingRestClient.ts`,
`app/simulator/useSimulationRecording.ts`, `presentation/simulator/RecordingPanel*`, mudanças aditivas em
`SimulatorRoute.tsx` e `SimulatorPage.tsx` (slot `recording`). ADR-027.

## Verificação (saída real)
- Backend: `ruff check`, `ruff format`, `mypy app`, `lint-imports` OK; `pytest`: tudo passa exceto
  `test_main_with_an_invalid_database_url_does_not_echo_it` (falha preexistente). Testes de backend (rotas,
  caso de uso, mapeamento, migration offline) já estavam escritos antes da mudança de prioridade.
- Frontend: lint, format:check, typecheck, `npm test` (727 passam), build OK. `npm run e2e` NÃO EXECUTADO.
- Integração com PostgreSQL (migration/compare_metadata e repositório) NÃO EXECUTADA localmente; roda no CI.

## Decisões
Travamento da UI na reprodução com `<fieldset disabled>`; a reprodução chama `commands.set*` por quadro
(sem avaliar). Nome de exibição do autor copiado na gravação. FK do autor sem `ON DELETE` (evita mexer no
teste que conta RESTRICT na migration inicial).

## Testes a escrever depois
- Vitest: `SimulationRecorder` (10 Hz, pendente no stop, limites de duração/tamanho, estado inicial);
  `playback.ts` (frameIndexAt, advancePosition, timelineMarkers, loadChartRefsOf, formatClock);
  cliente REST (`toRequestBody`, erros 413/422/403/404); hook `useSimulationRecording`.
- Componente `RecordingPanel` (jsdom): botões, nome obrigatório, lista, apagar só autor/admin, marcadores.
- E2E com `page.route` (gravar, salvar, reproduzir, controles travados) e capturas em
  `docs/assets/screenshots/leva-e/`.
- Integração PostgreSQL do repositório de gravações.

## Pendências
Limite do corpo da requisição antes do parse (hoje o 5 MB é conferido após o parse); versão do formato dos
quadros; colisões (TASK-053) gravadas como vierem; cenário ainda não alimentado (TASK-052).

## Próximo passo
Revisor independente; escrever os testes acima.
