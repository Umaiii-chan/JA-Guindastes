# TASK-057 — gravar, salvar e reproduzir simulações

ADR-027 · RN-005 · depende do PR #3 (TASK-050) e do commit de contratos da leva E.

## Critérios de aceite
- [x] Gravador puro (10 Hz, estado inicial, cópia opcional do ScenarioSpec, campos opcionais).
- [x] Backend: entidade, limites provisórios (10 min / 5 MB), migration `d7a3c5e8f1b4`, rotas `/api/v1/simulations`.
- [x] Frontend: gravar/parar/salvar com nome, lista, player (0,5×–4×, linha do tempo com marcadores), controles travados e HUD com quadros gravados.
- [x] Integração pequena no SimulatorRoute (hook + painel).
- [ ] Testes do frontend e e2e com capturas (adiados por decisão da pessoa responsável; ver handoff).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
