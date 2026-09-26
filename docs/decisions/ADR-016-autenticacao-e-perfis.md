# ADR-016 — Autenticação por sessão em cookie e perfis Admin/Operador

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), registrando as escolhas da pessoa responsável |
| **Decisores** | Anderson Sehnem (em chat, 2026-09-26: perfis "Admin + Operador"; contas "Admin cria as contas") |
| **Tarefa relacionada** | TASK-038 (backend), TASK-040 (frontend) |
| **Substitui** | — (resolve a "autenticação futura" da doc-fonte § 8.4; P-009, L-003) |

## Contexto

Até a leva C, qualquer cliente que alcançasse a API podia cadastrar guindastes, importar e **ativar
tabelas de carga**, e a ativação muda a capacidade calculada (`docs/security.md` § 2). A pessoa
responsável pediu login, com dois perfis, e contas criadas só por um administrador.

## Decisão

### 1. Perfis

| Perfil | Pode |
|--------|------|
| `ADMIN` | tudo do Operador + cadastrar fabricante/guindaste/configuração, validar/importar/ativar tabelas, gerenciar usuários |
| `OPERATOR` | ver o catálogo e as tabelas, validar um arquivo sem gravar, avaliar (REST e WebSocket) |

`GET /api/v1/health` continua público. Toda outra rota exige sessão válida.

### 2. Contas

- Não há cadastro aberto. O **primeiro admin** é criado no servidor por
  `python -m app.create_admin --username <nome> [--display-name <nome>]`; a senha vem da variável
  `ADMIN_PASSWORD` ou é pedida com `getpass`. Nunca por argumento de linha de comando.
- Depois, o admin cria, edita, troca a senha e desativa usuários pela API/tela.
- Proteções: um admin não pode se desativar nem tirar o próprio perfil de admin. O sistema nunca fica sem
  nenhum admin ativo.
- `username`: 3–64 caracteres `[a-z0-9._-]`, guardado em minúsculas, único. Senha: mínimo 10
  caracteres, máximo 128.

### 3. Senhas e sessões

- Hash **Argon2id** (`argon2-cffi`, parâmetros padrão da biblioteca). Nenhuma senha em log ou resposta.
- Sessão **opaca no banco**: token aleatório de 32 bytes (`secrets.token_urlsafe`); o banco guarda só o
  **SHA-256** do token. Expira em **8 h** desde o login (absoluto). Logout e desativação do usuário revogam.
- Cookie `crane_session`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` controlado por
  `SESSION_COOKIE_SECURE` (padrão `true`; `false` só em desenvolvimento local sem HTTPS).
- **CSRF:** além do `SameSite=Strict`, todo método inseguro (`POST`, `PUT`, `PATCH`, `DELETE`) exige o
  cabeçalho `X-Requested-With: crane-simulator`. Sem ele: `403 CSRF_HEADER_MISSING`.
- **WebSocket:** o handshake lê o mesmo cookie e confere que o `Origin` bate com o `Host`. Sem sessão
  válida, a conexão é fechada com o código `4401`; com `Origin` diferente, com `4403`.
- **Tentativas de login:** limite em memória de 5 falhas por `username` em 15 min →
  `429 TOO_MANY_ATTEMPTS`. É por processo, e basta para o MVP (dívida registrada).
- Falha de login responde sempre `401 INVALID_CREDENTIALS`, sem dizer se o usuário existe ou está inativo.

### 4. Contrato da API (JSON em camelCase, como o resto da API)

```
GET  /api/v1/auth/session          → 200 { "authEnabled": bool, "user": User | null }
POST /api/v1/auth/login            { "username", "password" } → 200 { "user": User } + Set-Cookie
                                   → 401 INVALID_CREDENTIALS | 429 TOO_MANY_ATTEMPTS
POST /api/v1/auth/logout           → 204 (idempotente; limpa o cookie)
GET  /api/v1/users                 (ADMIN) → 200 { "items": User[] }
POST /api/v1/users                 (ADMIN) { "username", "displayName", "password", "role" } → 201 User
                                   → 409 USERNAME_TAKEN | 422 validação
PATCH /api/v1/users/{id}           (ADMIN) { "displayName"?, "role"?, "active"?, "password"? } → 200 User
                                   → 404 | 409 LAST_ADMIN | 422

User = { "id", "username", "displayName", "role": "ADMIN" | "OPERATOR", "active": bool,
         "createdAt": ISO-8601 }
```

Sem sessão: `401 NOT_AUTHENTICATED`. Perfil insuficiente: `403 FORBIDDEN`. O corpo de erro segue o
formato já usado pela API.

### 5. Sem banco

Sem `DATABASE_URL`, a API já sobe sem persistência (TASK-029). Nesse modo **não há login**:
`GET /auth/session` responde `{ "authEnabled": false, "user": null }`, as rotas de usuário não são
registradas e as rotas que já existiam nesse modo continuam abertas. O frontend mostra o aviso "modo
sem autenticação (sem banco)". Serve só para desenvolvimento.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Sessão opaca no banco + cookie HttpOnly (escolhida)** | revogação imediata; o token não fica no JS; simples | uma consulta por requisição | — |
| JWT no `localStorage` | sem estado no servidor | exposto a XSS; revogação difícil | risco sem ganho no MVP |
| JWT em cookie | sem consulta por requisição | revogação exige lista negra | complexidade sem necessidade |
| Provedor externo (OIDC) | SSO | depende de serviço externo e de conta | fora do escopo acadêmico/local |

## Consequências

**Positivas:**
- a ativação de tabela e os cadastros ficam restritos ao admin;
- o frontend não manipula token.

**Negativas / custos:**
- duas tabelas novas (`app_user`, `user_session`) e uma dependência (`argon2-cffi`, MIT);
- o limite de tentativas é por processo (dívida para mais de uma réplica);
- os testes e o E2E precisam criar um usuário (no CI, com uma senha que só existe no CI).

**Riscos:**
- se `SESSION_COOKIE_SECURE=false` vazar para produção, o cookie trafega sem HTTPS. `docs/security.md`
  deve marcar isso.
