# ADR-020 — Render para dados e API; Vercel para o frontend

| Campo                  | Valor                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Status**             | Substituído por ADR-021                                 |
| **Data**               | 2026-09-30                                              |
| **Autor**              | agente Codex, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-09-30                  |
| **Tarefa relacionada** | TASK-049                                                |
| **Substitui**          | —                                                       |

## Contexto

A demonstração precisa de uma URL pública para a apresentação. O monorepo contém frontend Vite,
backend FastAPI, PostgreSQL, arquivos importados e autenticação por cookie `SameSite=Strict`.

## Decisão

O frontend será publicado na Vercel. O backend Docker, o PostgreSQL e o disco dos arquivos importados
ficarão no Render. A Vercel encaminhará `/api/*` ao Render para conservar a mesma origem percebida
pelo navegador. A build da Vercel usará avaliação REST; WebSocket permanece nos ambientes locais.

## Alternativas consideradas

| Alternativa                 | Vantagens                                            | Desvantagens                               | Por que não                                        |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Render + Vercel             | separação clara, Git deploy, HTTPS e domínio público | dois painéis e custo do Render             | —                                                  |
| Tudo no Render              | um painel                                            | não atende à escolha da pessoa responsável | escolha explícita foi Vercel + Render              |
| Backend direto no navegador | mantém WebSocket                                     | exige CORS e cookie entre origens          | mudança maior e mais arriscada para a apresentação |

## Consequências

**Positivas:**

- o cookie e o CSRF existentes continuam sob a origem da Vercel;
- o banco e os arquivos sobrevivem a redeploys;
- migrations, seed FICTÍCIO e admin inicial são automatizados.

**Negativas / custos:**

- o plano confiável mínimo custa cerca de US$ 13,25/mês no Render, antes de excedentes;
- o disco impede deploy sem interrupção de alguns segundos;
- a avaliação hospedada usa REST em vez de WebSocket.

**Riscos e como mitigar:**

- segredo do admin ausente impede a subida: o Blueprint pede `ADMIN_PASSWORD` sem versioná-la;
- origem errada quebra o proxy: `vercel.mjs` recusa `RENDER_API_ORIGIN` ausente ou sem HTTPS;
- mudanças de preço: conferir a página de preços do Render antes de provisionar.

## Impacto na documentação

- [x] `docs/architecture.md` atualizado
- [x] `docs/development-guide.md` atualizado
- [x] `docs/known-gaps.md` atualizado
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Render: Blueprint, serviço Docker, `preDeployCommand`, disco persistente e Postgres gerenciado.
- Vercel: configuração programática e rewrite para origem externa.
- Preços consultados nas páginas oficiais em 2026-09-30.
