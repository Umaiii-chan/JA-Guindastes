# ADR-014 — SQLAlchemy 2 como ORM e psycopg 3 como driver do PostgreSQL

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem |
| **Tarefa relacionada** | TASK-018 (a escolha foi implementada na TASK-011) |
| **Substitui** | — |

## Contexto

A TASK-011 montou a infraestrutura de persistência com **SQLAlchemy 2.1.1**, **Alembic 1.20.0** e
**psycopg 3.3.6** (`psycopg[binary]`). O ADR-007 escolhe o PostgreSQL e o ADR-012 escolhe o Alembic
para migrations, mas nenhum ADR registra o ORM nem o driver. A doc-fonte cita o SQLAlchemy na camada
de infraestrutura (§ 8.4) sem decidir o driver, e `docs/policies/security.md` § 4.4 pede ADR para
esse tipo de escolha. Este ADR registra a decisão depois do fato, para a pessoa aceitar ou pedir outra.

## Decisão

Usar **SQLAlchemy 2.x** (API 2.0, síncrona) como ORM e **psycopg 3** como driver do PostgreSQL, só na
camada de infraestrutura (`backend/app/infrastructure/database/`). Domínio e aplicação continuam sem
depender de SQLAlchemy, o que os contratos do import-linter já verificam (ADR-004, RNF-002).

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **SQLAlchemy 2 + psycopg 3 (escolhida)** | citado na doc-fonte; maduro; integra com o Alembic (ADR-012); psycopg 3 tem wheels para Python 3.14 (conferido no `uv.lock`) | psycopg é LGPL-3.0 (ver Riscos); uma camada a mais que SQL puro | — |
| SQLAlchemy 2 + asyncpg (assíncrono) | desempenho em I/O concorrente | exige toda a pilha assíncrona; mais complexidade para um MVP acadêmico | não há requisito de concorrência que justifique agora |
| SQLModel | integra Pydantic e SQLAlchemy | mistura modelo de persistência com schema, o que dificulta manter o Pydantic só na apresentação (ADR-006) | conflita com a separação de camadas |
| SQL puro com psycopg | sem ORM | mais código repetitivo; o autogenerate do Alembic depende de metadados | produtividade |

## Consequências

**Positivas:**
- repositórios implementam portas da aplicação sem vazar o ORM para o domínio;
- migrations geradas a partir de `Base.metadata` (Alembic autogenerate).

**Negativas / custos:**
- mapeamento entre entidades de domínio e modelos ORM precisa ser escrito à mão nos repositórios.

**Riscos e como mitigar:**
- *Licença LGPL-3.0 do psycopg* → a pessoa confirma se é aceitável para o projeto (pendência em
  `handoffs/current.md`). Uso como biblioteca dinâmica, sem modificação, costuma ser compatível, mas
  isso é **hipótese**, não parecer jurídico.
- *Suporte a Python 3.14* → conferido para as versões atuais no `uv.lock`; trocar versão é novo ADR.

## Impacto na documentação

- [x] índice em `docs/decisions/README.md`
- [x] `docs/architecture.md` § 8 (linha do ADR-014)
- [ ] `docs/development-guide.md`: já documenta os comandos (TASK-011)

## Evidências

- **Verificado:** versões no `backend/uv.lock` (SQLAlchemy 2.1.1, Alembic 1.20.0, psycopg 3.3.6 com
  wheels cp314); gates da TASK-011 e da TASK-018; contratos do import-linter mantidos.
- **Hipótese:** compatibilidade da LGPL-3.0 com a licença do projeto (que ainda não foi definida).
