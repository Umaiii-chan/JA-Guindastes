# Imagem do frontend (TASK-027): build com Node 24 + npm + Vite (ADR-012) e nginx sem root servindo dist/.
#
# Construir (na raiz):  docker build -t ja-guindastes-frontend:local frontend
# Porta do container:   8080 (nginx-unprivileged não pode abrir portas abaixo de 1024).
#
# URL da API: o bundle não guarda URL nenhuma. O frontend chama caminhos relativos /api/... e o nginx
# encaminha /api/ para o backend (proxy reverso, mesma origem, sem CORS). O destino é a variável
# API_UPSTREAM, lida quando o container sobe (padrão http://backend:8000, o serviço do Compose).

# --- Estágio 1: build ---
FROM node:24-trixie-slim AS build

WORKDIR /app

# Só os manifestos primeiro: a camada do npm ci fica em cache enquanto o package-lock.json não mudar.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Estágio 2: servidor estático ---
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

# O entrypoint da imagem aplica envsubst nos arquivos de /etc/nginx/templates e grava o resultado em
# /etc/nginx/conf.d (substitui o default.conf da imagem). Só variáveis definidas são substituídas, então
# as variáveis do próprio nginx ($uri, $host...) ficam intactas.
ENV API_UPSTREAM=http://backend:8000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]
