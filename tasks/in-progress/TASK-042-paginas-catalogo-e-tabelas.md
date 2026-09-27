# TASK-042 — Páginas completas de Catálogo e Tabelas de carga (ADR-017)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D2, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-042-paginas-catalogo-e-tabelas` |
| **PR** | — |
| **Requisitos** | pedido da pessoa responsável em chat ("melhorar o fluxo de uso"); RF de catálogo e importação |
| **Regras de negócio** | RN-003 (ficha técnica), RN-004, RN-005; ADR-009; ADR-015 |
| **Estimativa** | M |

---

## 1. Objetivo

As páginas `/catalogo` e `/tabelas` passam a ser telas de trabalho de verdade, com listas, busca,
formulários em Drawer, importação por arrastar e soltar e uma linha do tempo das versões com ativação
confirmada.

## 2. Contexto

Leva D2. Começa depois da TASK-039 (casca e design system), sobre a integração da leva D1. Paralela à
TASK-040, que cuida de perfis: aqui, as ações de escrita só ficam atrás de uma prop ou hook `canEdit`,
que a TASK-040 liga ao perfil.

## 3. Critérios de aceite

- [ ] **CA-1** — Catálogo:
  - navegação mestre-detalhe fabricante → guindaste → configuração, com busca e contagens;
  - detalhe da configuração com a ficha técnica (a, h e limites) e a tabela ativa;
  - criar e editar em Drawer, com validação no campo.
- [ ] **CA-2** — Tabelas:
  - escolha da configuração;
  - área de arrastar e soltar para CSV e XLSX, com validação prévia;
  - prévia da matriz (lança × raio) com as células coloridas por capacidade;
  - relatório de erros em tabela, com linha e coluna.
- [ ] **CA-3** — Versões:
  - linha do tempo das versões da configuração, com a versão ativa em destaque;
  - "Ativar" pede confirmação num Dialog que explica que a capacidade calculada muda;
  - toast de sucesso ou erro.
- [ ] **CA-4** — Estados de carregando, vazio e erro em todas as listas. Acessível por teclado.
- [ ] **CA-5** — Testes Vitest das telas e um spec E2E de importação com o CSV FICTÍCIO de demo. Gates
  do frontend passam.

## 4. Escopo

### Dentro do escopo

`frontend/**`, exceto `src/three/**` e o que é de autenticação (TASK-040).

### Fora do escopo (explicitamente — o agente NÃO faz)

`backend/**` (se faltar uma rota GET, registre no handoff), ADRs e `handoffs/current.md`.
