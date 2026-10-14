# Handoff — TASK-080 (deploy no Railway)

- O site da apresentação está no Railway desde 2026-10-14: o Render teve builds parados por incidente da plataforma, e a Vercel estourou o limite diário de deploys.
- Serviços: `ja-guindastes-db` (Postgres), `ja-guindastes-api` (`/backend`) e frontend (`/frontend`, nginx na porta 8080). Passo a passo e variáveis em `docs/deployment-railway.md`.
- Armadilhas encontradas:
  - `HOST=::` deixa o uvicorn só em IPv6, e o healthcheck (IPv4) falha. Use o padrão `0.0.0.0`.
  - `DATABASE_URL` precisa referenciar o serviço do banco pelo nome real.
  - O nginx agora re-resolve o endereço da API (`resolver` + variável). Antes, cada deploy da API exigia redeploy do frontend.
- Pendente: CA-4, conferir a IA (Groq) no site publicado.
