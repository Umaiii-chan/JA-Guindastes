# Segurança — contexto do projeto

> **Status deste documento:** preenchido na TASK-037 (2026-09-26) com o estado da leva C
> (TASK-033..036) integrada; §§ 1–4 atualizadas na TASK-038 (login e perfis, ADR-016); frontend,
> modelo 3D servido e dependências da leva D acrescentados na TASK-045. O sistema roda
> **só em ambiente local**, com limites de
> upload **provisórios** (P-008): não deve ser exposto fora da máquina. Este arquivo descreve a
> situação de segurança **deste projeto**. As regras universais que todo agente segue estão em
> [`policies/security.md`](policies/security.md) e não precisam ser repetidas aqui.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037; §§ 1–4 atualizadas na TASK-038; complementos da leva D na TASK-045) |
| Responsável por segurança | PENDENTE: não designado (equipe e papéis em aberto, [`known-gaps.md`](known-gaps.md) P-012); até lá, a pessoa responsável pelo projeto ([`project-overview.md`](project-overview.md)) |

---

## 1. Dados tratados pelo sistema

Desde a TASK-038, o sistema tem **contas de acesso** (`app_user`): nome de usuário, nome de exibição,
perfil e hash da senha. É o único dado pessoal tratado; não há outro cadastro de pessoas.

| Dado | Classificação | Onde é armazenado | Base legal / observação |
|------|---------------|-------------------|-------------------------|
| Catálogo (fabricantes, modelos, configurações e ficha técnica geométrica) | interno (técnico) | PostgreSQL (`manufacturers`, `cranes`, `crane_configurations`) | hoje só dados FICTÍCIOS de teste e demo |
| Tabelas de carga e seus pontos | interno (técnico; dado oficial do fabricante, quando chegar) | PostgreSQL (`load_charts`, `load_chart_points`) | se os dados oficiais podem ir ao repositório e a agentes de IA está **PENDENTE** (P-007) |
| Arquivo-fonte das tabelas importadas (CSV/XLSX) | interno (técnico) | disco local em `FILE_STORAGE_DIR`, nomeado pelo SHA-256; no Docker Compose, `/data/load-charts` no volume `ja-guindastes_load-chart-files` | fora do repositório; retenção e limpeza de arquivos órfãos **PENDENTES** (TASK-031 § 8 item 8) |
| Contas de acesso (nome de usuário, nome de exibição, perfil, situação) e hash Argon2id da senha | pessoal (identificação mínima) + credencial | PostgreSQL (`app_user`) | criadas só por admin (ADR-016 § 2); a senha nunca é gravada nem registrada em log, só o hash; retenção de contas desativadas não definida |
| Sessões de login | credencial | PostgreSQL (`user_session`): só o SHA-256 do token, dono, criação e expiração (8 h) | o token fica só no cookie do navegador; logout e desativação apagam a sessão; sessões expiradas são apagadas a cada login |
| Logs do backend | interno | saída do processo (uvicorn / `docker compose logs`) | a verificação de saúde registra só o tipo do erro; erros de configuração não repetem a `DATABASE_URL`; retenção não definida |

Regra para agentes: dados classificados como **pessoal** ou **sensível** nunca aparecem em logs,
mensagens de erro, fixtures de teste ou documentação.

---

## 2. Autenticação e autorização

| Aspecto | Como funciona neste projeto | Onde está no código |
|---------|-----------------------------|---------------------|
| Autenticação | login por usuário e senha (ADR-016; TASK-038), **só com `DATABASE_URL`**. Sem cadastro aberto: o primeiro admin é criado no servidor por `python -m app.create_admin` (senha por `ADMIN_PASSWORD` ou `getpass`, nunca por argumento; idempotente) e os demais pelo admin (`/api/v1/users`). Falha de login responde sempre `401 INVALID_CREDENTIALS`, sem dizer se o usuário existe ou está inativo; a senha é conferida mesmo sem usuário (tempo constante). Limite de 5 falhas por usuário em 15 min → `429 TOO_MANY_ATTEMPTS`, **em memória, por processo** (dívida para mais de uma réplica; reiniciar zera) | `backend/app/application/use_cases/authentication.py`, `backend/app/presentation/api/auth.py`, `backend/app/create_admin.py`, `backend/app/infrastructure/security/` |
| Autorização | perfis `ADMIN` e `OPERATOR`. `GET /api/v1/health` e `GET /api/v1/auth/session` públicos; leituras do catálogo e das tabelas, `load-charts/validate` e avaliação (REST e WebSocket): qualquer perfil; cadastros do catálogo, `load-charts/import`, `activate` e `/api/v1/users*`: só `ADMIN`. Sem sessão → `401 NOT_AUTHENTICATED`; perfil insuficiente → `403 FORBIDDEN`. Um admin não pode se desativar nem perder o próprio perfil (`409 OWN_ADMIN_ACCESS`), e o sistema nunca fica sem admin ativo (`409 LAST_ADMIN`; conferência e escrita atômicas no repositório, com `SELECT ... FOR UPDATE` nos admins ativos). `/docs` e `/openapi.json` continuam públicos (não expõem dados) | `backend/app/presentation/api/authorization.py`, `backend/app/presentation/api/main.py`, `backend/app/presentation/api/users.py` |
| Sessão | opaca no banco: token de 32 bytes (`secrets.token_urlsafe`), só o SHA-256 gravado; expira em 8 h desde o login (absoluto); logout e desativação revogam. Cookie `crane_session`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` por `SESSION_COOKIE_SECURE` (padrão `true`). **Risco:** `SESSION_COOKIE_SECURE=false` fora do desenvolvimento local faz o cookie trafegar sem HTTPS: só use em `http://127.0.0.1`/`localhost`. WebSocket: exige o mesmo cookie e `Origin` com o mesmo host do `Host` (a porta não é comparada, por causa dos proxies do nginx e do Vite); fecha com `4401` sem sessão e `4403` com origem diferente. A sessão do WebSocket só é conferida na abertura | `backend/app/presentation/api/authorization.py`, `backend/app/presentation/websocket/evaluation.py` |
| CSRF | além do `SameSite=Strict`, todo `POST`/`PUT`/`PATCH`/`DELETE` exige `X-Requested-With: crane-simulator` → sem ele `403 CSRF_HEADER_MISSING` (só com autenticação ligada) | `CsrfHeaderMiddleware` em `backend/app/presentation/api/authorization.py` |
| Senhas | hash **Argon2id** (`argon2-cffi`, parâmetros padrão da biblioteca); 10 a 128 caracteres; nunca em log, resposta ou mensagem de erro (o 422 das rotas `/auth` e `/users` não repete a entrada) | `backend/app/infrastructure/security/argon2_password_hasher.py`, `backend/app/presentation/api/validation_errors.py` |
| Sem banco | sem `DATABASE_URL` **não há login** (ADR-016 § 5): `GET /api/v1/auth/session` responde `authEnabled: false`, as rotas de usuário não existem e as demais ficam abertas, como antes. Só para desenvolvimento | `backend/app/main.py` |
| CORS | nenhum middleware CORS configurado; o frontend usa a mesma origem (proxy do Vite ou do nginx) | `frontend/vite.config.ts`, `frontend/nginx.conf.template` |
| Frontend (TASK-040) | o JavaScript não lê nem guarda o token (cookie `HttpOnly`). Todo pedido passa por `apiFetch`: `credentials: 'same-origin'` e, nos métodos inseguros, o cabeçalho `X-Requested-With: crane-simulator`; um 401 `NOT_AUTHENTICATED` leva ao login e um 403 `FORBIDDEN` vira o aviso "Sem permissão". As guardas de rota (`RequireAuth`, `RequireRole`) e a ocultação das ações de escrita para o Operador são **só apresentação**: quem autoriza é o backend. A conferência da sessão só cai no "modo sem autenticação" quando o backend está ausente (erro de rede ou 404/502/503/504 do proxy); qualquer outra falha leva ao login. Mesmo nesse modo, um backend com banco continua recusando com 401 | `frontend/src/infrastructure/api/apiFetch.ts`, `frontend/src/app/auth/` |

Mitigação adicional: todas as portas do Docker Compose são publicadas só em `127.0.0.1`
(`docker-compose.yml`), e os containers do backend e do frontend rodam sem root. O limite de taxa de
mensagens do WebSocket continua ausente.

Limitações conhecidas da autenticação (detalhes em [`known-gaps.md`](known-gaps.md) § 2 e § 4):
- o limite de tentativas de login é em memória e por processo: com mais de uma réplica, cada uma
  conta à parte, e reiniciar zera;
- o `PATCH /api/v1/users/{id}` monta o estado novo a partir de uma leitura feita antes da trava: um
  campo não enviado pode sobrescrever uma mudança simultânea desse campo (a regra do último admin
  não é afetada);
- trocar a senha não revoga as outras sessões do usuário (o ADR-016 não pede; pergunta aberta,
  TASK-038 § 8 item 5);
- a sessão do WebSocket só é conferida na abertura; revalidar durante a conexão ficou fora do
  ADR-016 (TASK-038 § 7).

---

## 3. Segredos e configuração

| Segredo | Local | CI | development | homologation | production | Rotação |
|---------|-------|----|-------------|--------------|------------|---------|
| `POSTGRES_PASSWORD` (e `POSTGRES_USER`, `POSTGRES_DB`) | `.env` da raiz (lido pelo Docker Compose) | valor descartável no próprio workflow (`ci_only_not_a_secret`, só para os containers efêmeros dos jobs `backend`, `docker` e `e2e`) | PENDENTE (sem implantação; P-011) | PENDENTE | PENDENTE | PENDENTE |
| `DATABASE_URL` (contém a senha) | `.env`, exportado no shell para backend, Alembic e testes | idem, no ambiente do job `backend` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| `BACKEND_DATABASE_URL` (opcional) | `.env` (lido pelo Compose) | não usada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| `ADMIN_PASSWORD` (senha do primeiro admin, TASK-038) | preferir não guardar: `create_admin` pede sem eco; se usada, só no shell do comando | valor descartável no job `e2e` (`ci_only_admin_password_not_secret`, admin `e2e-admin` do banco efêmero), exportado também como `E2E_ADMIN_PASSWORD` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

Os *secrets* de cada ambiente ficariam no GitHub Environment de mesmo nome da branch; o job `deploy`
do CI ainda é placeholder e nenhum Environment está configurado. Ver
[`guides/git-github.md`](guides/git-github.md) § 8.3.

**Nunca** no repositório. `.env.example` lista os nomes, sem valores. O `repr` das configurações do
banco mascara a senha e as mensagens de erro não ecoam a URL (`backend/app/infrastructure/database/config.py`).

---

## 4. Superfície de ataque conhecida

Todos os limites abaixo são **PROVISÓRIOS — A VALIDAR (P-008)**, escolhidos para o ambiente local.

| Entrada | Validação existente | Riscos considerados |
|---------|---------------------|---------------------|
| Upload de tabela CSV para validação (`POST /api/v1/load-charts/validate`) | arquivo ≤ 1 MiB e corpo ≤ 1 MiB + 16 KiB, recusados com 413 antes de ler o formulário; UTF-8 obrigatório; nada é gravado | tamanho; conteúdo malformado vira relatório de inconsistências, sem exceção |
| Upload de tabela CSV/XLSX com gravação (`POST /api/v1/load-charts/import`) | mesmos limites de tamanho; formato escolhido pelo nome/tipo do arquivo (415 se não reconhecido); XLSX: ≤ 10 MiB descompactado e ≤ 10 000 linhas, conferidos antes do openpyxl; openpyxl com `read_only`, `data_only`, `keep_vba=False`, `keep_links=False`; fórmulas nunca avaliadas; tabela inválida não é gravada | zip bomb, macros, links externos; `defusedxml` **não** está instalado (TASK-023 § 8 item 4); CSV sem limite de linhas além do tamanho |
| Arquivo-fonte gravado no disco | nome derivado só do SHA-256 calculado (nunca do nome enviado); URI `local://<sha256>` validada por regex e caminho resolvido dentro de `FILE_STORAGE_DIR`; escrita em temporário + `os.link` (nunca sobrescreve) | path traversal, sobrescrita, arquivo trocado (erro de integridade) |
| Login (`POST /api/v1/auth/login`) | username acima de 64 ou senha acima de 128 caracteres falham como credencial inválida sem chegar ao banco nem ao Argon2 (e contam no limite); resposta sempre `401 INVALID_CREDENTIALS`; senha conferida contra um hash descartável quando o usuário não existe; 5 falhas por username em 15 min → `429` | força bruta distribuída entre usuários ou réplicas (o limite é por username e por processo); custo do Argon2 com entradas enormes |
| JSON da avaliação e do catálogo (REST) | schemas Pydantic estritos, sem campos extras, sem `NaN`/infinito; handler do 422 que não quebra com números não finitos | payload malformado; nomes sem limite de tamanho nem normalização (TASK-030 § 8) |
| WebSocket de avaliação | mensagem ≤ 8 KiB (bytes UTF-8); JSON recusando `NaN`/`Infinity`; validação estrita; qualquer recusa vira `simulation.error` sem fechar a conexão | com banco: cookie de sessão e `Origin` conferidos na abertura (4401/4403); sem limite de taxa; `--ws-max-size` do uvicorn não configurado (TASK-025 § 8) |
| nginx do frontend (container) | `client_max_body_size 10m`, `server_tokens off`, `X-Content-Type-Options: nosniff` | — |
| Modelo 3D (GLB/glTF) | carregado só no navegador a partir de arquivo do repositório; **sem upload** para o backend. O modelo do caminhão (`frontend/public/models/guindaste-caminhao.glb`, 1,81 MiB) é servido publicamente pelo frontend em `/models/guindaste-caminhao.glb`; é derivado de um FBX comercial do CGTrader cuja licença, confirmada pela pessoa responsável em 2026-09-26, permite versionar o GLB e distribuí-lo embutido na aplicação (registrado nos `extras` do GLB). O FBX de origem não vai ao repositório (`assets/source/` no `.gitignore`), e o script de conversão recusa outro FBX pelo SHA-256 | limites de tamanho/polígonos para upload futuro **PENDENTES** (P-008); o teste confere o SHA-256 do GLB versionado |

---

## 5. Dependências

- Ferramenta de auditoria: **PENDENTE** (não definida; TASK-011 § 8 item 6) — comando: nenhum
  ([`development-guide.md`](development-guide.md) § 3, "A VALIDAR").
- Roda no CI? não.
- Dependabot habilitado? não (não há `.github/dependabot.yml`).
- Dependências novas e licenças são registradas nos handoffs (ex.: psycopg 3 é LGPL-3.0, aceitação
  **PENDENTE** em `handoffs/current.md` § 7; `openpyxl` MIT, TASK-023).
- Leva D:
  - backend: `argon2-cffi` 25.1.0 (MIT, PyPI), com `argon2-cffi-bindings`, `cffi` e `pycparser`
    (TASK-038);
  - frontend, no runtime: `react-router`, `lucide-react`, `@fontsource-variable/inter` e
    `@fontsource-variable/jetbrains-mono` (MIT/OFL). As fontes e os ícones são locais, sem CDN
    (ADR-017; TASK-039);
  - frontend, só nos testes: `jsdom`, `@testing-library/react` e `@testing-library/dom` (MIT;
    TASK-039);
  - asset de terceiro: o modelo 3D do CGTrader (ver § 4). A TASK-043 não acrescentou dependência:
    o conversor usa o `three` já instalado.

---

## 6. Checklist de segurança por tarefa

O revisor verifica (também está em [`checklists/code-review-checklist.md`](checklists/code-review-checklist.md)):

- [ ] nenhuma credencial, token ou dado pessoal real no diff;
- [ ] entradas externas validadas antes do uso;
- [ ] erros não vazam detalhes internos (stack trace, SQL, caminhos);
- [ ] dependências novas justificadas no handoff e sem vulnerabilidade conhecida;
- [ ] autorização verificada em toda operação nova que toca dado de usuário.

---

## 7. Incidentes e reporte

PENDENTE: não há canal definido pela equipe. O que já vale para agentes
([`policies/security.md`](policies/security.md) §§ 1 e 9): não corrigir em silêncio nem expor
detalhes em issue pública; registrar o achado, com o mínimo necessário, na seção "⚠️ Segurança" do
handoff da tarefa; a pessoa responsável decide como tratar. Segredo já commitado é incidente e
precisa ser rotacionado, não só removido.
