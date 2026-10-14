# TASK-067 — Fatores do ambiente na utilização e no risco de tombamento

- **Regra:** RN-015 (ADR-033). **Origem:** pedido de Anderson Sehnem em chat, 2026-10-14.
- **Escopo:** backend (domínio, avaliação, área de operação, catálogo, migration) e frontend
  (catálogo do guindaste, clientes REST/WS, painel de resultado).

## Critérios de aceite

- CA-1 — A capacidade efetiva usa os fatores de inclinação e de vento; `capacity_limit` os devolve.
- CA-2 — Inclinação acima da máxima: risco alto, nível "acima do limite", alerta "Terreno inclinado demais para operar".
- CA-3 — Vento: sem efeito até 9,8 m/s; queda linear até 50 % em 13,8 m/s; acima, bloqueio.
- CA-4 — Solo sob as sapatas: alto acima do suporte, atenção acima de 80 %.
- CA-5 — Obstáculos no raio de giro: atenção com o alerta dos ids.
- CA-6 — Campos novos opcionais no REST e no WebSocket; ausentes não mudam nada.
- CA-7 — A área de operação aplica inclinação e vento.
- CA-8 — Catálogo e tela do guindaste editam os 3 campos novos.
- CA-9 — O painel avisa "reduzida pelo vento" e "reduzida pela inclinação".

## Testes a escrever depois

- REST/WS ponta a ponta com `soil_kinds`, `wind_speed_ms` e `obstacle_conflicts`.
- Área de operação com inclinação e vento.
- Migration no Postgres (CI) e mapeamento das colunas novas.
- Painel: textos de redução e e2e com os campos do guindaste.
- Tela do simulador enviar solo, vento e obstáculos (hoje só os tipos e os clientes aceitam).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
