# TASK-065 — acessórios com modelos 3D gratuitos

Pedido da pessoa responsável em 2026-10-14: baixar modelos gratuitos e hospedar (Vercel e Render).

- [x] **CA-1** — Moitão, gancho giratório e manilha (Sketchfab, CC BY 4.0), otimizados em `frontend/public/models/acessorios/`, publicados pela Vercel.
- [x] **CA-2** — O seed (que roda na subida do Render) cadastra os 3 acessórios, com peso, altura de içamento, arquivo e crédito. É idempotente.
- [x] **CA-3** — Créditos CC BY em `CREDITS.md` e no painel de acessórios.
- [x] **CA-4** — O modelo é escalado pela maior dimensão (os modelos de terceiros vêm deitados).

Fontes originais (fora do Git): `assets/source/sketchfab/` (inclui as alternativas não publicadas).

## Testes a escrever depois
- Seed: cria os 3 acessórios e é idempotente.
- `fitModel` com modelo deitado.
