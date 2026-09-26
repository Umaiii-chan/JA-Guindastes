# TASK-040 — Login, guardas de rota e página de usuários no frontend (ADR-016/017)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D2, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-040-login-e-usuarios-frontend` |
| **PR** | — |
| **Requisitos** | pedido da pessoa responsável em chat (login; perfis Admin/Operador; admin cria as contas) |
| **Regras de negócio** | ADR-016 § 4 (contrato), § 5 (sem banco); ADR-017 § 1 (rotas e perfis) |
| **Estimativa** | M |

---

## 1. Objetivo

Página de login no visual escuro, sessão guardada no `AuthProvider` real, rotas guardadas por perfil,
menu do usuário com "sair" e página **Usuários** (admin): listar, criar, editar perfil e nome, trocar
senha, ativar e desativar.

## 2. Contexto

Leva D2. Começa depois da TASK-038 (API de autenticação) e da TASK-039 (casca e design system), sobre a
integração das duas. Paralela à TASK-042.

## 3. Critérios de aceite

- [ ] **CA-1** — Cliente de `/auth` e `/users` conforme o contrato:
  - `credentials: 'same-origin'`;
  - cabeçalho `X-Requested-With: crane-simulator` em métodos inseguros;
  - um 401 em qualquer chamada leva ao login, preservando o destino.
- [ ] **CA-2** — Página `/login`:
  - campos acessíveis e mostrar/ocultar senha;
  - mensagens para 401 e 429;
  - estado de carregando;
  - sem `authEnabled` (modo sem banco), a página redireciona para o Início com um aviso.
- [ ] **CA-3** — Guardas por perfil conforme o ADR-017 § 1: o Operador não vê as ações de escrita
  (botões ocultos ou desabilitados com explicação) e não acessa `/usuarios`.
- [ ] **CA-4** — Página Usuários:
  - tabela com busca;
  - criar e editar num Drawer;
  - confirmação antes de desativar;
  - os erros 409 `USERNAME_TAKEN` e `LAST_ADMIN` explicados.
- [ ] **CA-5** — E2E:
  - helper de login que usa `E2E_ADMIN_USERNAME` e `E2E_ADMIN_PASSWORD`;
  - specs de login (sucesso, falha, sair) e de perfil;
  - os specs existentes passam a fazer login antes.
- [ ] **CA-6** — Gates do frontend e `scripts/check-structure.sh` passam.

## 4. Escopo

### Dentro do escopo

`frontend/**`, exceto `src/three/**`.

### Fora do escopo (explicitamente — o agente NÃO faz)

`backend/**`, as páginas de catálogo e tabelas (TASK-042), ADRs e `handoffs/current.md`.
