# Deploy no Railway (alternativa ao Render e à Vercel)

Front, back e banco num único projeto do Railway, com as mesmas imagens Docker do
`docker-compose.yml`. O frontend (nginx) encaminha `/api` para o backend pela rede privada, então o
site fica na mesma origem, como em `http://127.0.0.1:8080`.

## 1. Projeto e banco

1. railway.app → **New Project** → **Deploy PostgreSQL**.
2. No mesmo projeto: **+ Create** → **GitHub Repo** → `Anderson-Sehn3m/JA-Guindastes`, duas vezes (um serviço para o backend e outro para o frontend). Renomeie os serviços para `backend` e `frontend`. Os nomes importam nas referências abaixo.

## 2. Serviço `backend`

**Settings**
- Source → Branch: `development`; Root Directory: `/backend`.
- Config-as-code → Railway Config File: `/backend/railway.json`.
- Networking: não precisa de domínio público. O acesso é pelo frontend.

**Variables**

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `PORT` | `8000` |
| `HOST` | `::` |
| `FILE_STORAGE_DIR` | `/data/load-charts` |
| `SESSION_COOKIE_SECURE` | `true` |
| `ADMIN_USERNAME` | `admin-apresentacao` |
| `ADMIN_DISPLAY_NAME` | `Administrador da apresentação` |
| `ADMIN_PASSWORD` | (senha forte; só no painel) |
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | (chave do Groq; só no painel) |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |

`GEMINI_API_KEY` é opcional. Com `AI_PROVIDER=auto` em vez de `groq`, o Gemini vira reserva do Groq.

## 3. Serviço `frontend`

**Settings**
- Source → Branch: `development`; Root Directory: `/frontend`.
- Config-as-code → Railway Config File: `/frontend/railway.json`.
- Networking → **Generate Domain** → porta `8080`. Esse é o endereço da apresentação.

**Variables**

| Variável | Valor |
|---|---|
| `PORT` | `8080` |
| `API_UPSTREAM` | `http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000` |

## 4. Conferir

- `https://<domínio-do-frontend>/api/v1/health` responde 200.
- Login com `admin-apresentacao` e a senha do painel, depois Simulador → guindaste de demonstração.
- Assistente de IA → "Respondido por openai/gpt-oss-120b".

## Limitações

- Os arquivos de tabela de carga enviados pela tela ficam no disco do container e somem num novo
  deploy. O seed recria a tabela de demonstração a cada inicialização. Para guardar uploads, anexe um
  volume em `/data/load-charts`; o container roda como usuário 10001, então confira a permissão.
- O frontend sobe antes do backend no primeiro deploy, e o nginx pode reiniciar até o endereço
  privado do backend existir. A política de reinício cobre isso.
