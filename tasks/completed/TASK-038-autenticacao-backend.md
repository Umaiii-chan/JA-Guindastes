# TASK-038 — Autenticação no backend: usuários, sessões e perfis (ADR-016)

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-038-autenticacao-backend` |
| **PR** | — |
| **Requisitos** | pedido da pessoa responsável em chat (login, perfis Admin/Operador, contas criadas pelo admin); doc-fonte § 8.4; P-009, L-003 |
| **Regras de negócio** | ADR-016 (contrato completo); ADR-004 (camadas) |
| **Estimativa** | L |

---

## 1. Objetivo

A API passa a exigir login conforme o **ADR-016**:
- usuários com perfil `ADMIN` ou `OPERATOR`;
- sessão opaca em cookie `HttpOnly`;
- rotas de escrita só para admin;
- gestão de usuários e o comando `python -m app.create_admin`.

## 2. Contexto

Leva D (design, login e fluxo). Paralelas: TASK-039 (fundação do frontend, `frontend/src`) e TASK-041
(cena 3D, `frontend/src/three`). O frontend de login fica com a TASK-040 (leva D2), que usa o contrato
do ADR-016 § 4 **exatamente como está**. Se o contrato precisar mudar, registre no handoff; não mude em
silêncio.

## 3. Critérios de aceite

- [ ] **CA-1** — Domínio e aplicação: testes unitários sem banco para:
  - a entidade `User`, com perfil e flag de ativo;
  - as portas de repositório de usuários e sessões e o hasher de senha;
  - os casos de uso login, logout, sessão atual, listar, criar e atualizar usuário, com as regras do
    ADR-016 § 2 (nome, senha, último admin, não se desativar).
- [ ] **CA-2** — Infraestrutura:
  - tabelas `app_user` e `user_session` numa **migration Alembic nova**, sem alterar a existente;
  - repositórios SQLAlchemy;
  - Argon2id via `argon2-cffi`, dependência nova registrada no handoff;
  - testes de integração com o marcador `integration`.
- [ ] **CA-3** — API: rotas `/api/v1/auth/*` e `/api/v1/users*` no contrato do ADR-016 § 4, e
  autorização aplicada a **todas** as rotas existentes:
  - `health`: pública;
  - GETs do catálogo e das tabelas, `load-charts/validate` e avaliação REST: qualquer perfil;
  - POSTs do catálogo, `load-charts/import` e `activate`: `ADMIN`.
- [ ] **CA-4** — Cookie e segurança:
  - flags do cookie e `SESSION_COOKIE_SECURE`;
  - cabeçalho CSRF `X-Requested-With: crane-simulator` em métodos inseguros;
  - limite de 5 falhas em 15 min;
  - resposta 401 genérica;
  - nenhuma senha ou token em log.
- [ ] **CA-5** — WebSocket `/api/v1/ws/evaluation`: exige a sessão do cookie e `Origin` igual ao
  `Host`. Fecha com `4401` sem sessão e `4403` com origem diferente, com testes para os dois casos.
- [ ] **CA-6** — Sem `DATABASE_URL`:
  - `GET /auth/session` responde `{authEnabled:false, user:null}` e as rotas de usuário não existem;
  - o comportamento atual se mantém;
  - os testes existentes continuam passando; os que precisarem de sessão ganham uma fixture de login.
- [ ] **CA-7** — `python -m app.create_admin`:
  - senha por `ADMIN_PASSWORD` ou `getpass`;
  - idempotente: se o usuário já existe, mostra mensagem e sai com código 0, sem trocar a senha;
  - erros claros quando não há banco.
- [ ] **CA-8** — Demo e CI:
  - `docs/demo.md` ganha o passo de criar o admin;
  - no job `e2e` do `.github/workflows/ci.yml`, um passo cria o admin com um `ADMIN_PASSWORD` que só
    existe no CI e exporta `E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD` para os testes;
  - os specs E2E **não** mudam aqui (ficam para a TASK-040).
- [ ] **CA-9** — Gates do backend (ruff, format, mypy strict, lint-imports, pytest) e
  `scripts/check-structure.sh` passam. `docs/security.md` § 2 descreve o novo estado.

## 4. Escopo

### Dentro do escopo

`backend/**`, `.github/workflows/ci.yml` (só o job `e2e`), `.env.example`, `docs/demo.md`,
`docs/security.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

`frontend/**`, `handoffs/current.md`, ADRs (o ADR-016 não muda), `README.md` e os demais docs.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `backend/app/domain/entities/user.py` e portas/casos de uso em `application/` | criar | não |
| `backend/alembic/versions/<nova>_usuarios_e_sessoes.py` | criar | não |
| `backend/app/infrastructure/repositories/sqlalchemy_user_*`, `infrastructure/security/*` | criar | não |
| `backend/app/presentation/api/auth.py`, `users.py`, dependências de autorização | criar | não |
| `backend/app/presentation/api/main.py`, `backend/app/main.py` | alterar | sim |
| `backend/app/create_admin.py` | criar | não |

## 6. Riscos e dependências

- Proteger as rotas quebra os testes E2E até a TASK-040 (tela de login). A integração da leva D junta as
  duas antes do PR final.
- O banco e o Docker não rodam localmente, então a integração só roda no CI.

## 7. Teste manual (se houver)

Seguir `docs/demo.md`: criar o admin e fazer login pela API com `curl -c cookies.txt`.

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).
