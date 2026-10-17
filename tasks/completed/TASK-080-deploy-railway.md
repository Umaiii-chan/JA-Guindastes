# TASK-080 — deploy alternativo no Railway

Pedido da pessoa usuária em 2026-10-14: o Render está com builds parados (incidente da plataforma) e a
Vercel atingiu o limite diário de deploys. Para a apresentação, front, back e banco sobem no Railway
com as mesmas imagens Docker do `docker-compose.yml`. O deploy no Render/Vercel continua valendo.

## Critérios de aceite

- [x] **CA-1** — `backend/railway.json` e `frontend/railway.json` (Dockerfile, healthcheck, reinício em falha, watch por pasta).
- [x] **CA-2** — `render-start.sh` aceita `HOST` (no Railway, `::`, porque a rede privada usa IPv6); o resto da inicialização é igual (migrations, seed, admin).
- [x] **CA-3** — Passo a passo e variáveis em `docs/deployment-railway.md`.
- [ ] **CA-4** — Site publicado no Railway com login, simulação e IA (Groq) verificados.

## Testes a escrever depois

- Teste de fumaça do site publicado (login, avaliação, IA) rodando contra a URL do Railway.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PRs #33 e #34). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1). A tarefa foi encerrada sem `handoffs/TASK-080.md`; o histórico dela está nos PRs #33 e #34.
