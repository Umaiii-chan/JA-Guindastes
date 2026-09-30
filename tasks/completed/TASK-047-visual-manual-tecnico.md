# TASK-047 — Visual de manual técnico no frontend e na cena (ADR-019)

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-27 por pessoa responsável ("mais cara de feito por humano", via orquestrador) |
| **Iniciada em** | 2026-09-27 |
| **Concluída em** | — |
| **Branch** | `task/TASK-047-visual-manual-tecnico` |
| **PR** | — |
| **Requisitos** | pedido em chat de 2026-09-27: sair do escuro com degradê, paleta sóbria, componentes com identidade, ritmo assimétrico |
| **Regras de negócio** | ADR-019 (linguagem visual); ADR-017 §§ 1–2 (páginas e simulador guiado continuam); ADR-012 (FICTÍCIO); ADR-015 (PROVISÓRIO) |
| **Estimativa** | L |

---

## 1. Objetivo

Aplicar o ADR-019 em todo o frontend e na cena 3D. O comportamento não muda; muda só a aparência.

## 2. Critérios de aceite

- [ ] **CA-1** — Tokens e fontes:
  - `tokens.css` com a paleta, as linhas, os raios e o movimento do ADR-019, no tema claro;
  - IBM Plex Sans e Mono pelo `@fontsource`, removendo Inter e JetBrains Mono;
  - nenhum degradê, vidro (`backdrop-filter`) ou brilho no CSS; um teste ou lint simples confere a
    ausência de `linear-gradient`, `radial-gradient` e `backdrop-filter` em `src/`.
- [ ] **CA-2** — Componentes com identidade:
  - moldura de folha com carimbo (título, número de folha ou revisão) no lugar do Panel de vidro;
  - Button, Field, Select, Tabs, Table, Dialog, Drawer e Toast em linhas finas e cantos retos;
  - hover e foco com sublinhado ou marcação laranja;
  - Gauge vira **régua linear graduada**;
  - Stepper como lista numerada de procedimento (01, 02, 03), com traço de progresso.
- [ ] **CA-3** — Ritmo:
  - Início com layout assimétrico, sem grade de cards iguais: coluna larga com o "índice" do manual e
    coluna estreita com o resumo do catálogo em tabela densa;
  - avisos FICTÍCIO/PROVISÓRIO como nota de rodapé ou carimbo.
- [ ] **CA-4** — Simulador:
  - a cena ocupa um quadro claro com borda de desenho técnico;
  - os passos formam uma coluna de procedimento;
  - o resultado é uma ficha com números em mono grande e a régua de utilização;
  - nada flutua em vidro sobre a cena; o layout é em colunas.
- [ ] **CA-5** — Cena 3D:
  - fundo papel;
  - grade de papel milimetrado (linhas de 1 m e 5 m em tinta clara);
  - anel de raio e setores de zona em traço de tinta, com a zona atual em laranja-acento;
  - cores de situação do ADR-019 em `palette.ts`, alinhadas aos tokens;
  - sombras discretas; sem névoa escura; rótulos CSS2D no estilo de cota.
- [ ] **CA-6** — Identidade própria: wordmark tipográfico e símbolo geométrico mínimo, também no
  favicon; nenhuma marca da Guindastes Ribas nem de fabricantes.
- [ ] **CA-7** — Acessibilidade: contraste AA conferido por teste nos pares de token principais e foco
  visível.
- [ ] **CA-8** — Sem regressão:
  - todos os testes Vitest e E2E passam, com seletores atualizados só onde o texto ou a estrutura
    mudaram, sem mudar o comportamento;
  - gates do frontend e `scripts/check-structure.sh` passam;
  - capturas novas das páginas Início, Simulador, Catálogo e Tabelas em 1440×900, em
    `docs/assets/screenshots/`, substituindo as antigas.

## 3. Escopo

### Dentro do escopo

`frontend/**`, `docs/assets/screenshots/**`, `handoffs/TASK-047.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- comportamento e contratos da API;
- `backend/**`;
- ADRs, `handoffs/current.md` e `docs/business-rules.md`;
- ler `dados-oficiais/`.

> Movida para `completed/` em 2026-09-27 pela autorização permanente da pessoa responsável (revisão independente dispensada), junto com o refinamento das páginas.
