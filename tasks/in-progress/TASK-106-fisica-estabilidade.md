# TASK-106 — estabilidade por física (decisão D1 da auditoria)

O Anderson decidiu (D1, 2026-10-16) trocar a RN-013 (tombamento por regras) e a RN-015 (fatores de
inclinação, vento e solo) por **física, o mais próximo do real possível**. Ver o ADR-050 e a RN-017.

## Critérios de aceite

- [x] **CA-1** — Tombamento por momento estabilizante × momento de tombamento sobre o polígono real das
  sapatas (diagonal e lateral), com margem da norma (carga ≤ 85 % da carga de tombamento).
- [x] **CA-2** — Reação em cada sapata pela estática do polígono (substitui o 0,5 fictício).
- [x] **CA-3** — Vento da EN 13000: rajada de 3 s no ponto mais alto e
  `v_max = v_tab · √(1,2 ÷ (A_W / m_H))` com a área de vento da carga e da lança.
- [x] **CA-4** — Inclinação residual como momento adicional (flecha e CG deslocado), e não só % por grau.
- [x] **CA-5** — RN-013 e RN-015 marcadas como substituídas; RN-017 e ADR-050 (Aceito, decisão D1).
- [x] **CA-6** — Valores sem dado oficial rotulados FICTÍCIOS; testes com contas feitas à mão.
- [ ] **CA-7** — PR no fork (base `development`), revisão da Coruja e merge só por `safe-merge.sh`.
