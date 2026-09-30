# Handoff — TASK-049 — deploy Render + Vercel

| Campo                 | Valor                                                            |
| --------------------- | ---------------------------------------------------------------- |
| **Data/hora**         | 2026-09-30 (UTC-3, Brasília)                                     |
| **Tarefa**            | `tasks/in-progress/TASK-049-deploy-render-vercel.md`             |
| **Etapa concluída**   | implementação local; provisionamento e fumaça públicos pendentes |
| **Papel exercido**    | Planejador + Engenheiro de testes + Implementador                |
| **Ferramenta/agente** | Codex (GPT-6)                                                    |
| **Branch**            | `task/TASK-049-deploy-render-vercel`                             |

## 1. O que foi feito

- Criado `render.yaml` com API Docker e PostgreSQL 18 gratuitos, filesystem efêmero, migrations,
  seed FICTÍCIO e admin inicial.
- O backend normaliza a URL `postgresql://` do Render para `postgresql+psycopg`.
- Criado `frontend/vercel.mjs` com proxy `/api/*`, fallback da SPA e validação HTTPS.
- A build Vercel usa REST; o WebSocket continua como padrão local.
- Criado ADR-020 e runbook com custo, implantação e teste de fumaça.

## 2. Arquivos modificados

- `.env.example`, `render.yaml`, `backend/Dockerfile`, `backend/scripts/render-start.sh`
- configuração e testes do banco; composição e testes da avaliação no frontend
- `frontend/package.json`, `frontend/vercel.mjs`
- arquitetura, guia de desenvolvimento, lacunas, ADR-020 e runbook de deploy
- tarefa e este handoff

## 3. Comandos executados e resultados

- Backend: ruff passou em 204 arquivos; 35 testes dirigidos passaram.
- Backend completo sem integração chegou a 96% sem outra falha, mas não encerrou e foi interrompido.
- Frontend: ESLint, tipagem e build passaram; 716 testes passaram e 1 pulou.
- Configuração Vercel, script Render, YAML, diff e estrutura passaram.
- `scripts/check-structure.sh`: 0 erros e 1 aviso por tarefas paralelas.

## 4. Decisões tomadas e por quê

- Rewrite REST de mesma origem preserva o cookie `SameSite=Strict` e evita mudanças de CORS.
- A pessoa responsável escolheu os planos gratuitos do Render em 2026-09-30; ADR-021 substitui a
  parte paga do ADR-020.

## 5. O que não foi feito e por quê

- Recursos não provisionados: dependem do merge em `development` e do acesso às contas.
- Docker e integração PostgreSQL não foram executados localmente.

## 6. Pendências / decisões necessárias

- Depois do merge, informar `ADMIN_PASSWORD` no Render e `RENDER_API_ORIGIN` na Vercel.

## 7. Próximo passo

Revisar e mergear o PR; provisionar os serviços e executar o teste de fumaça do CA-6.

**Ler primeiro:** `AGENTS.md`, esta tarefa, este handoff e `docs/deployment-render-vercel.md`.

## 8. Segurança

- Nenhum segredo foi lido ou gravado.
