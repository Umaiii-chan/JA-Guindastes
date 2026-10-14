# TASK-071 — acessórios voltam a aparecer e a mudar o guindaste

Relato: "a inserção dos acessórios não está correta, eles não estão alterando no guindaste".

- [x] **CA-1** — O seletor e o botão Adicionar funcionam na seção recolhível "Acessórios de içamento" (verificado na tela).
- [x] **CA-2** — A cadeia aparece pendurada no gancho do modelo de 80 t e a carga desce pela altura dela.
- [x] **CA-3** — Ao escolher um moitão, o moitão do próprio modelo some e o escolhido toma o lugar dele (sem dois moitões); ao retirá-lo, o do modelo volta.
- [x] **CA-4** — A avaliação recebe os acessórios e o peso comparado soma o peso deles (1.000 + 200 + 351 = 1.551 kg no teste).

Teste essencial: `frontend/tests/three/scene/HookLoad.test.ts` (moitão esconde e devolve o do modelo).
Capturas: `docs/assets/screenshots/leva-e/acessorios-*.png`.
