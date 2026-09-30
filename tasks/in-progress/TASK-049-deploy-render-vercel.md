# TASK-049 â€” implantar demonstraÃ§Ã£o no Render e na Vercel

| Campo                 | Valor                                                            |
| --------------------- | ---------------------------------------------------------------- |
| **Status**            | in-progress                                                      |
| **Prioridade**        | alta                                                             |
| **Criada em**         | 2026-09-30 por Anderson Sehnem                                   |
| **Iniciada em**       | 2026-09-30                                                       |
| **ConcluÃ­da em**      | â€”                                                                |
| **Branch**            | `task/TASK-049-deploy-render-vercel` (a partir de `development`) |
| **PR**                | â€”                                                                |
| **Requisitos**        | RNF-001, RNF-004, RNF-005                                        |
| **Regras de negÃ³cio** | nenhuma nova                                                     |
| **Estimativa**        | M                                                                |

---

## 1. Objetivo

Disponibilizar a demonstraÃ§Ã£o web por uma URL pÃºblica da Vercel, com o backend FastAPI, PostgreSQL
e arquivos importados hospedados no Render, pronta para ser acessada durante a apresentaÃ§Ã£o.

## 2. Contexto

A pessoa responsÃ¡vel escolheu Render + Vercel em chat em 2026-09-30. A aplicaÃ§Ã£o jÃ¡ funciona em
Docker Compose, mas o job de deploy Ã© apenas um placeholder e nÃ£o hÃ¡ manifests dessas plataformas.
O frontend usa cookie de sessÃ£o `SameSite=Strict` e URLs relativas; por isso a API REST serÃ¡ exposta
sob `/api` no domÃ­nio da Vercel por rewrite externo. A demonstraÃ§Ã£o usarÃ¡ REST para as avaliaÃ§Ãµes,
pois o upgrade WebSocket atravÃ©s desse rewrite nÃ£o faz parte do contrato documentado da Vercel.

## 3. CritÃ©rios de aceite

- [x] **CA-1** â€” Dado o Blueprint, quando validado, entÃ£o ele define backend Docker, PostgreSQL,
      migrations, seed FICTÃCIO, admin inicial e armazenamento persistente sem credenciais no git.
- [x] **CA-2** â€” Dado o frontend publicado na Vercel, quando uma rota `/api/*` Ã© chamada, entÃ£o ela Ã©
      encaminhada ao backend do Render e rotas da SPA voltam ao `index.html`.
- [x] **CA-3** â€” Dada a build de apresentaÃ§Ã£o, quando o simulador avalia uma operaÃ§Ã£o, entÃ£o usa o
      fallback REST sem iniciar reconexÃµes WebSocket pelo proxy da Vercel.
- [x] **CA-4** â€” A documentaÃ§Ã£o descreve criaÃ§Ã£o dos recursos, variÃ¡veis, custos/limitaÃ§Ãµes e teste de
      fumaÃ§a, sem valores secretos.
- [x] **CA-5** â€” Testes, lint, formataÃ§Ã£o, tipagem, build e verificaÃ§Ã£o estrutural passam.
- [ ] **CA-6** â€” A implantaÃ§Ã£o real fornece URLs pÃºblicas e o fluxo de login + avaliaÃ§Ã£o Ã© testado.

## 4. Escopo

### Dentro do escopo

- Blueprint do Render para API, banco e disco persistente.
- ConfiguraÃ§Ã£o da Vercel para o Vite e o proxy REST.
- Compatibilidade do backend com a URL PostgreSQL fornecida pelo Render.
- Modo REST explÃ­cito para a build hospedada na Vercel.
- Runbook de implantaÃ§Ã£o, operaÃ§Ã£o e teste de fumaÃ§a.

### Fora do escopo

- DomÃ­nio prÃ³prio, observabilidade avanÃ§ada e alta disponibilidade.
- PromoÃ§Ã£o das branches `homologation` e `production`.
- AlteraÃ§Ã£o das regras de cÃ¡lculo ou uso de dados oficiais.
- WebSocket atravÃ©s da Vercel.

## 5. Arquivos provavelmente afetados

| Arquivo                                                | Tipo de mudanÃ§a | Verificado? |
| ------------------------------------------------------ | --------------- | ----------- |
| `render.yaml`                                          | criar           | sim         |
| `frontend/vercel.ts`                                   | criar           | sim         |
| `frontend/src/app/useEvaluationSession.ts`             | alterar         | sim         |
| `backend/app/infrastructure/database/config.py`        | alterar         | sim         |
| `backend/tests/infrastructure/database/test_config.py` | alterar         | sim         |
| `.env.example`                                         | alterar         | sim         |
| `docs/deployment-render-vercel.md`                     | criar           | sim         |
| `docs/architecture.md`                                 | alterar         | sim         |
| `docs/development-guide.md`                            | alterar         | sim         |
| `docs/known-gaps.md`                                   | alterar         | sim         |
| `docs/decisions/ADR-020-deploy-render-vercel.md`       | criar           | sim         |

## 6. Riscos e dependÃªncias

- Depende de contas Render e Vercel conectadas ao GitHub.
- O disco persistente exige serviÃ§o web pago no Render; sem ele, arquivos importados somem em
  reinÃ­cios e redeploys.
- O PostgreSQL gratuito expira apÃ³s 30 dias e nÃ£o tem backup; para a apresentaÃ§Ã£o, usar banco pago
  ou recriar os dados FICTÃCIOS antes do evento.
- A URL pÃºblica do backend sÃ³ existe depois do primeiro Blueprint; ela precisa ser cadastrada na
  variÃ¡vel `RENDER_API_ORIGIN` da Vercel.

## 7. Teste manual

1. Abrir a URL da Vercel em janela anÃ´nima.
2. Entrar com o admin configurado no Render.
3. Abrir o Simulador, escolher a configuraÃ§Ã£o FICTÃCIA, informar uma carga e aguardar o resultado.
4. Abrir CatÃ¡logo e Tabelas e confirmar que os dados FICTÃCIOS do seed aparecem.
5. Conferir no DevTools que os pedidos usam `https://<projeto>.vercel.app/api/...`.
   **Esperado:** login persiste, avaliaÃ§Ã£o REST responde e nÃ£o hÃ¡ tentativas de WebSocket.

---

## 8. Plano

| #   | Passo                                             | Arquivos               | Como verificar          | Feito |
| --- | ------------------------------------------------- | ---------------------- | ----------------------- | ----- |
| 1   | Registrar decisÃ£o e contrato de implantaÃ§Ã£o       | tarefa, ADR, docs      | revisÃ£o + estrutura     | [x]   |
| 2   | Criar Blueprint e compatibilidade da URL do banco | `render.yaml`, backend | pytest + validaÃ§Ã£o YAML | [x]   |
| 3   | Criar configuraÃ§Ã£o Vercel e modo REST             | frontend               | testes + build          | [x]   |
| 4   | Documentar e validar localmente                   | docs, handoff          | gates do projeto        | [x]   |
| 5   | Provisionar, configurar e testar as URLs pÃºblicas | Render, Vercel         | teste de fumaÃ§a manual  | [ ]   |

**AnÃ¡lise de impacto:**

- AutenticaÃ§Ã£o depende do rewrite manter o navegador na origem da Vercel.
- ImportaÃ§Ã£o depende do disco em `/data/load-charts`.
- NÃ£o hÃ¡ regra de negÃ³cio nova; a mudanÃ§a Ã© operacional e de transporte do frontend.
- A escolha Render + Vercel foi feita pela pessoa responsÃ¡vel em 2026-09-30.

## 9. CenÃ¡rios de teste

| CenÃ¡rio                                            | CritÃ©rio   | Tipo       | Arquivo de teste                                       | Status          |
| -------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------ | --------------- |
| normaliza `postgresql://` do Render para psycopg 3 | CA-1       | unitÃ¡rio   | `backend/tests/infrastructure/database/test_config.py` | vermelho        |
| preserva rejeiÃ§Ã£o de drivers incompatÃ­veis         | CA-1       | unitÃ¡rio   | mesmo arquivo                                          | verde existente |
| seleciona sessÃ£o REST na build da Vercel           | CA-3       | unitÃ¡rio   | teste novo em `frontend/tests/app/`                    | vermelho        |
| manifests contÃªm rotas e referÃªncias esperadas     | CA-1, CA-2 | estrutural | script/check manual                                    | pendente        |

## 10. Parecer da revisÃ£o

**Resultado:** pendente â€” deve ser feito por outra pessoa ou agente.

## 11. Encerramento

- Pendente.
