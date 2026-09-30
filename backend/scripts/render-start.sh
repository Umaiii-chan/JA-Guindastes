#!/bin/sh
set -eu

: "${ADMIN_USERNAME:?ADMIN_USERNAME precisa estar definida no Render}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD precisa estar definida no Render}"
: "${FILE_STORAGE_DIR:?FILE_STORAGE_DIR precisa estar definida no Render}"

# O plano gratuito não oferece pre-deploy. Migrations, seed e admin são idempotentes e rodam antes
# da API em cada inicialização, inclusive depois de o serviço acordar do modo ocioso.
alembic upgrade head
python -m app.demo_seed
python -m app.create_admin \
  --username "$ADMIN_USERNAME" \
  --display-name "${ADMIN_DISPLAY_NAME:-Administrador da apresentação}"

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}"
