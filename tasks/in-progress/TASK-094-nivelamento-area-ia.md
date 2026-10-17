# TASK-094 — nivelamento na avaliação, acessórios na área de operação e layout da IA

Achados F-12, F-14, F-15 e F-29 da auditoria de 2026-10-16 (física, simulação e tela, base
`development` @ 784a9e1). Regras: RN-013, RN-014 e RN-015; ADR-025 e ADR-033.

## Critérios de aceite

- [ ] **CA-1** (F-12) — A avaliação recebe a inclinação **residual** (terreno − nivelamento, só com
  os macacos apoiados; RN-013), não a inclinação bruta do terreno. Terreno plano continua sem o
  campo (`undefined`). Mudar o nivelamento reenvia a avaliação.
- [ ] **CA-2** (F-15) — `POST /api/v1/configurations/{id}/operating-area` aceita `accessory_ids`
  (opcional) e soma os acessórios ao peso comparado, como a avaliação (RN-014); id desconhecido
  responde 422 com o id, em vez de subestimar o peso. A tela manda a cadeia de acessórios atual.
- [ ] **CA-3** (F-14) — O layout seguro da IA reserva a carga com o comprimento em Z local (como a
  cena) e o guindaste pelo corpo de `planning/crane_body.py` mais uma folga. Viga 12 × 1 m na
  origem com uma caixa 2 × 2 m em (0; 4,5): a caixa sai. Carro em (0; 8,3) na frente da cabine:
  o carro sai.
- [ ] **CA-4** (F-29) — Os docstrings e descrições que diziam que a composição usa a consulta
  conservadora passam a dizer a interpolação linear provisória do ADR-030.

## Testes a escrever depois

- Teste de componente do `SimulatorRoute` conferindo o `ground_slope_deg` enviado depois de
  "Apoiar e nivelar" (hoje o teste é da função pura).
