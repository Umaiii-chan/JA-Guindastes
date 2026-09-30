# ADR-021 — plano gratuito do Render para a apresentação

| Campo                  | Valor                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Status**             | Aceito                                                  |
| **Data**               | 2026-09-30                                              |
| **Autor**              | agente Codex, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-09-30                  |
| **Tarefa relacionada** | TASK-049                                                |
| **Substitui**          | ADR-020 quanto ao plano pago e ao disco persistente     |

## Contexto

O ADR-020 escolheu Render + Vercel e propôs recursos pagos para evitar hibernação e perda de
arquivos. A pessoa responsável decidiu usar a versão gratuita do Render para a apresentação.

## Decisão

O backend e o PostgreSQL usarão planos gratuitos do Render. Não haverá disco persistente. As
migrations, o seed FICTÍCIO e a criação idempotente do admin rodarão no início do serviço.

## Alternativas consideradas

| Alternativa     | Vantagens                            | Desvantagens                                                   | Por que não        |
| --------------- | ------------------------------------ | -------------------------------------------------------------- | ------------------ |
| Render gratuito | custo zero                           | hibernação, filesystem efêmero e banco com validade de 30 dias | —                  |
| Render pago     | serviço ativo, banco durável e disco | cerca de US$ 13,25/mês                                         | custo não desejado |

## Consequências

**Positivas:**

- não há cobrança de compute, banco ou disco no cenário previsto;
- a arquitetura Render + Vercel e a autenticação de mesma origem são preservadas.

**Negativas / custos:**

- após 15 minutos sem tráfego, a primeira abertura pode levar cerca de um minuto;
- o PostgreSQL gratuito expira 30 dias após a criação e não tem backup;
- arquivos importados no filesystem somem em reinícios, hibernações e redeploys; os dados
  estruturados já gravados no PostgreSQL continuam disponíveis enquanto o banco existir;
- migrations aumentam o tempo de cada inicialização.

**Riscos e como mitigar:**

- criar o banco menos de 30 dias antes da apresentação;
- abrir a aplicação 15 minutos antes e mantê-la ativa durante a banca;
- não depender da preservação do arquivo-fonte importado; manter a planilha de demonstração local.

## Impacto na documentação

- [x] `docs/architecture.md` atualizado
- [x] `docs/development-guide.md` não exige mudança adicional
- [x] `docs/known-gaps.md` atualizado
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Documentação oficial do Render sobre planos gratuitos, hibernação, filesystem efêmero e expiração
  do PostgreSQL, consultada em 2026-09-30.
