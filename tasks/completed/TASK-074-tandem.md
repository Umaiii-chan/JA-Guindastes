# TASK-074 — içamento com dois guindastes (tandem)

Pedido: levantar com dois guindastes uma carga que um só não levanta. Regra (RN-016, ADR-037): cada
guindaste usa no máximo 75 % da própria capacidade, e a carga se divide pela posição dos pontos de
içamento em relação ao centro de gravidade (alavanca). Os dois se movem sincronizados.

## Critérios de aceite

- [x] **CA-1** — Serviço de domínio da divisão da carga (`peso × distância do outro ponto ao CG ÷ distância entre os pontos`).
- [x] **CA-2** — `POST /evaluations/tandem` reaproveita a avaliação de cada guindaste, com a parte dele mais o gancho, e o fator 0,75 sobre a capacidade efetiva; `tandem_ok` só com os dois OK; alertas em pt-BR.
- [x] **CA-3** — Cenário com `cranes?` (guindastes adicionais) e `cargo?`; o editor tem "Adicionar guindaste" (fabricante, guindaste, configuração), posicionar e girar.
- [x] **CA-4** — A cena desenha um segundo rig completo (mesmo GLB) com o próprio controller; seletor "Guindaste 1 / Guindaste 2" para os controles.
- [x] **CA-5** — Modo Tandem: os dois ganchos engatam nos pontos da carga (a 1/4 e 3/4 do comprimento) e os movimentos ficam sincronizados; o 1 conduz, o 2 acompanha.
- [x] **CA-6** — A ficha mostra a divisão (kg e %) e a avaliação de cada guindaste.
- [x] **CA-7** — Colisão entre os guindastes (lança contra lança, carga contra o outro corpo) com `src/domain/collision`.
- [x] **CA-8** — Validado no navegador com uma carga que um só não levanta (capturas em `docs/assets/screenshots/leva-f/tandem-*.png`).

Testes essenciais: `backend/tests/domain/test_tandem_load_split.py`,
`backend/tests/presentation/test_evaluations_tandem.py`, `frontend/tests/domain/tandem/tandem.test.ts`,
`frontend/tests/domain/collision/multiCraneCollisions.test.ts`,
`frontend/tests/three/scene/MultiCrane.test.ts`.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PR #28). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
