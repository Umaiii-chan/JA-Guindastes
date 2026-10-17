# TASK-049 — implantar demonstração no Render e na Vercel

| Campo                 | Valor                                                            |
| --------------------- | ---------------------------------------------------------------- |
| **Status**            | in-progress                                                      |
| **Prioridade**        | alta                                                             |
| **Criada em**         | 2026-09-30 por Anderson Sehnem                                   |
| **Iniciada em**       | 2026-09-30                                                       |
| **Concluída em**      | —                                                                |
| **Branch**            | `task/TASK-049-deploy-render-vercel` (a partir de `development`) |
| **PR**                | —                                                                |
| **Requisitos**        | RNF-001, RNF-004, RNF-005                                        |
| **Regras de negócio** | nenhuma nova                                                     |
| **Estimativa**        | M                                                                |

---

## 1. Objetivo

Disponibilizar a demonstração web por uma URL pública da Vercel, com o backend FastAPI, PostgreSQL
e arquivos importados hospedados no Render, pronta para ser acessada durante a apresentação.

## 2. Contexto

A pessoa responsável escolheu Render + Vercel em chat em 2026-09-30. A aplicação já funciona em
Docker Compose, mas o job de deploy é apenas um placeholder e não há manifests dessas plataformas.
O frontend usa cookie de sessão `SameSite=Strict` e URLs relativas; por isso a API REST será exposta
sob `/api` no domínio da Vercel por rewrite externo. A demonstração usará REST para as avaliações,
pois o upgrade WebSocket através desse rewrite não faz parte do contrato documentado da Vercel.

## 3. Critérios de aceite

- [x] **CA-1** — Dado o Blueprint, quando validado, então ele define backend Docker e PostgreSQL
      gratuitos, migrations, seed FICTÍCIO e admin inicial sem credenciais no git.
- [x] **CA-2** — Dado o frontend publicado na Vercel, quando uma rota `/api/*` é chamada, então ela é
      encaminhada ao backend do Render e rotas da SPA voltam ao `index.html`.
- [x] **CA-3** — Dada a build de apresentação, quando o simulador avalia uma operação, então usa o
      fallback REST sem iniciar reconexões WebSocket pelo proxy da Vercel.
- [x] **CA-4** — A documentação descreve criação dos recursos, variáveis, custos/limitações e teste de
      fumaça, sem valores secretos.
- [x] **CA-5** — Testes, lint, formatação, tipagem, build e verificação estrutural passam.
- [ ] **CA-6** — A implantação real fornece URLs públicas e o fluxo de login + avaliação é testado.

## 4. Escopo

### Dentro do escopo

- Blueprint do Render gratuito para API e banco, com filesystem efêmero documentado.
- Configuração da Vercel para o Vite e o proxy REST.
- Compatibilidade do backend com a URL PostgreSQL fornecida pelo Render.
- Modo REST explícito para a build hospedada na Vercel.
- Runbook de implantação, operação e teste de fumaça.

### Fora do escopo

- Domínio próprio, observabilidade avançada e alta disponibilidade.
- Promoção das branches `homologation` e `production`.
- Alteração das regras de cálculo ou uso de dados oficiais.
- WebSocket através da Vercel.

## 5. Arquivos provavelmente afetados

| Arquivo                                                | Tipo de mudança | Verificado? |
| ------------------------------------------------------ | --------------- | ----------- |
| `render.yaml`                                          | criar           | sim         |
| `frontend/vercel.json`                                 | criar           | sim         |
| `frontend/src/app/useEvaluationSession.ts`             | alterar         | sim         |
| `backend/app/infrastructure/database/config.py`        | alterar         | sim         |
| `backend/tests/infrastructure/database/test_config.py` | alterar         | sim         |
| `.env.example`                                         | alterar         | sim         |
| `docs/deployment-render-vercel.md`                     | criar           | sim         |
| `docs/architecture.md`                                 | alterar         | sim         |
| `docs/development-guide.md`                            | alterar         | sim         |
| `docs/known-gaps.md`                                   | alterar         | sim         |
| `docs/decisions/ADR-020-deploy-render-vercel.md`       | criar           | sim         |
| `docs/decisions/ADR-021-plano-gratuito-render.md`      | criar           | sim         |

## 6. Riscos e dependências

- Depende de contas Render e Vercel conectadas ao GitHub.
- O filesystem gratuito é efêmero: arquivos importados somem em reinícios, hibernações e redeploys.
- O PostgreSQL gratuito expira após 30 dias e não tem backup; criar menos de 30 dias antes da banca.
- A URL pública do backend precisa coincidir com o `destination` de `frontend/vercel.json`.

## 7. Teste manual

1. Abrir a URL da Vercel em janela anônima.
2. Entrar com o admin configurado no Render.
3. Abrir o Simulador, escolher a configuração FICTÍCIA, informar uma carga e aguardar o resultado.
4. Abrir Catálogo e Tabelas e confirmar que os dados FICTÍCIOS do seed aparecem.
5. Conferir no DevTools que os pedidos usam `https://<projeto>.vercel.app/api/...`.
   **Esperado:** login persiste, avaliação REST responde e não há tentativas de WebSocket.

---

## 8. Plano

| #   | Passo                                             | Arquivos               | Como verificar          | Feito |
| --- | ------------------------------------------------- | ---------------------- | ----------------------- | ----- |
| 1   | Registrar decisão e contrato de implantação       | tarefa, ADR, docs      | revisão + estrutura     | [x]   |
| 2   | Criar Blueprint e compatibilidade da URL do banco | `render.yaml`, backend | pytest + validação YAML | [x]   |
| 3   | Criar configuração Vercel e modo REST             | frontend               | testes + build          | [x]   |
| 4   | Documentar e validar localmente                   | docs, handoff          | gates do projeto        | [x]   |
| 5   | Provisionar, configurar e testar as URLs públicas | Render, Vercel         | teste de fumaça manual  | [ ]   |

**Análise de impacto:**

- Autenticação depende do rewrite manter o navegador na origem da Vercel.
- Importação depende do disco em `/data/load-charts`.
- Não há regra de negócio nova; a mudança é operacional e de transporte do frontend.
- A escolha Render + Vercel foi feita pela pessoa responsável em 2026-09-30.

## 9. Cenários de teste

| Cenário                                            | Critério   | Tipo       | Arquivo de teste                                       | Status          |
| -------------------------------------------------- | ---------- | ---------- | ------------------------------------------------------ | --------------- |
| normaliza `postgresql://` do Render para psycopg 3 | CA-1       | unitário   | `backend/tests/infrastructure/database/test_config.py` | vermelho        |
| preserva rejeição de drivers incompatíveis         | CA-1       | unitário   | mesmo arquivo                                          | verde existente |
| seleciona sessão REST na build da Vercel           | CA-3       | unitário   | teste novo em `frontend/tests/app/`                    | vermelho        |
| manifests contêm rotas e referências esperadas     | CA-1, CA-2 | estrutural | script/check manual                                    | pendente        |

## 10. Parecer da revisão

**Resultado:** pendente — deve ser feito por outra pessoa ou agente.

## 11. Encerramento

- Pendente.


## Encerramento

Mergeada pela pessoa responsável em 2026-09-30 (PRs #1 e #2 no fork). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
