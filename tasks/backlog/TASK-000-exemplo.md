# TASK-000 — Adicionar endpoint de verificação de saúde (`/health`)

> **Este é um exemplo** de tarefa bem escrita. Apague ao adaptar o template, ou use como TASK-001
> real se fizer sentido para o seu projeto (é uma ótima primeira tarefa para testar o fluxo).

| Campo | Valor |
|-------|-------|
| **Status** | backlog |
| **Prioridade** | alta |
| **Criada em** | 2026-09-05 por Anderson |
| **Iniciada em** | — |
| **Concluída em** | — |
| **Branch** | `task/TASK-000-health-endpoint` |
| **PR** | — |
| **Requisitos** | RNF-001 (observabilidade) |
| **Regras de negócio** | — (nenhuma regra funcional envolvida) |
| **Estimativa** | P |

---

## 1. Objetivo

Permitir que um monitor externo (ou uma pessoa com `curl`) saiba se a aplicação está de pé,
consultando `GET /health` e recebendo um JSON estável.

## 2. Contexto

Primeira tarefa do projeto. Serve para validar que o fluxo (planejar → testar → implementar → revisar
→ CI) funciona ponta a ponta com uma mudança pequena e sem lógica de negócio. Também será usada
pelo orquestrador de deploy para verificar disponibilidade (ver `docs/architecture.md` § 7).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado que a aplicação está rodando, quando faço `GET /health`, então recebo HTTP 200.
- [ ] **CA-2** — Dado que a aplicação está rodando, quando faço `GET /health`, então o corpo é JSON
  com exatamente as chaves `status` (valor `"ok"`) e `version` (string não vazia, lida da configuração
  do projeto — não fixa no código).
- [ ] **CA-3** — Dado que a aplicação está rodando, quando faço `POST /health`, então recebo HTTP 405
  (ou o equivalente padrão do framework para método não permitido).
- [ ] **CA-4** — Existe teste automatizado para CA-1, CA-2 e CA-3.
- [ ] **CA-5** — Nenhum teste existente quebra.
- [ ] **CA-6** — `docs/architecture.md` § 2 lista o componente de health check e
  `docs/development-guide.md` § 3 tem o comando para testar manualmente (`curl`).

## 4. Escopo

### Dentro do escopo

- Rota `GET /health`, resposta JSON, testes, documentação.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Verificar dependências (banco, cache, serviços externos) — será TASK futura (`/ready`).
- Autenticação na rota.
- Métricas, tracing, logs estruturados.
- Qualquer alteração em outras rotas.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `src/<api>/health.<ext>` | criar | não (Planejador confirma o caminho conforme a stack) |
| `src/<api>/routes.<ext>` ou equivalente | alterar (registrar rota) | não |
| `tests/<api>/health.test.<ext>` | criar | não |
| `docs/architecture.md` | alterar § 2 | sim |
| `docs/development-guide.md` | alterar § 3 | sim |

## 6. Riscos e dependências

- Depende de: framework web já configurado e comando de teste funcionando (`development-guide.md` § 3).
- Risco: `version` lida de lugar errado → mitigação: Planejador identifica a fonte canônica da versão
  (package.json, pyproject.toml, variável de build) e registra no plano.

## 7. Teste manual (se houver)

1. Rodar a aplicação com o comando de `development-guide.md` § 3.
2. `curl -i http://localhost:<porta>/health`
   **Esperado:** `HTTP/1.1 200`, `Content-Type: application/json`, corpo `{"status":"ok","version":"<x.y.z>"}`.
3. `curl -i -X POST http://localhost:<porta>/health`
   **Esperado:** `HTTP/1.1 405`.

---

## 8. Plano (preenchido pelo Planejador)

*(vazio — a ser preenchido)*

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

*(vazio — a ser preenchido)*

## 10. Parecer da revisão (preenchido pelo Revisor)

*(vazio)*

## 11. Encerramento (preenchido ao mover para completed/)

*(vazio)*
