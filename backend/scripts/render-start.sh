#!/bin/sh
set -eu

: "${ADMIN_USERNAME:?ADMIN_USERNAME precisa estar definida no Render}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD precisa estar definida no Render}"
: "${FILE_STORAGE_DIR:?FILE_STORAGE_DIR precisa estar definida no Render}"

# O seed e a criação do admin são idempotentes. Eles rodam no processo da aplicação porque o
# pre-deploy do Render não tem acesso ao disco persistente que guarda os arquivos importados.
python -m app.demo_seed
python -m app.create_admin \
  --username "$ADMIN_USERNAME" \
  --display-name "${ADMIN_DISPLAY_NAME:-Administrador da apresentação}"

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}"
