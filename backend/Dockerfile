# Imagem do backend (TASK-027): Python 3.14 + uv (ADR-012), dependências do uv.lock, usuário não-root.
#
# Construir (na raiz):  docker build -t ja-guindastes-backend:local backend
# Rodar a API:          CMD padrão (uvicorn app.main:app na porta 8000); precisa de DATABASE_URL.
# Migrations:           docker compose run --rm backend alembic upgrade head   (ver docker-compose.yml)
# Demo FICTÍCIA:        docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"
#                       (TASK-035; roteiro em docs/demo.md)

# --- Estágio 1: resolve as dependências no ambiente virtual /app/.venv ---
FROM python:3.14-slim-trixie AS builder

# uv com a mesma versão usada na máquina de desenvolvimento (ADR-012: uv 0.12.18).
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /bin/uv

# Usa o Python da imagem (não baixa outro), compila bytecode e copia os arquivos para o .venv
# (hardlink não funciona entre camadas).
ENV UV_PYTHON_DOWNLOADS=never \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# Só os arquivos de dependência primeiro: a camada fica em cache enquanto o uv.lock não mudar.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

# --- Estágio 2: imagem final, sem o uv ---
FROM python:3.14-slim-trixie AS runtime

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Usuário sem privilégio, sem shell de login e sem home gravável.
# /data/load-charts: FILE_STORAGE_DIR do container (TASK-035; arquivo-fonte das tabelas importadas,
# TASK-031). Criado com o dono "app" para que o volume nomeado do docker-compose.yml, na primeira
# montagem, herde esse dono e o processo não-root consiga gravar.
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p /data/load-charts \
    && chown 10001:10001 /data/load-charts

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
# Código da aplicação e das migrations (os testes ficam fora da imagem; ver .dockerignore).
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# UID numérico (usuário "app" criado acima): o runtime consegue verificar que não é root (hadolint DL3066).
USER 10001:10001

EXPOSE 8000

# Rota de saúde da TASK-029 (TASK-035). Responde 200 enquanto o processo atende, mesmo com o banco
# DOWN (o campo `database` é informativo; pendência 1 do handoff da TASK-029).
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"]

# API completa = raiz de composição app.main:app (TASK-019). 0.0.0.0 só dentro do container; a porta
# publicada no host fica em 127.0.0.1 (docker-compose.yml).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
