# TASK-039 — Fundação do frontend: design system escuro, casca e páginas (ADR-017)

| Campo | Valor |
|-------|-------|
| **Status** | completed |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-039-fundacao-frontend` |
| **PR** | — |
| **Requisitos** | pedido da pessoa responsável em chat ("melhorar o design", "melhorar o fluxo", "enriquecer o frontend"); visual "Escuro tipo software 3D"; fluxo "Páginas + simulador guiado" |
| **Regras de negócio** | ADR-017 (páginas, simulador guiado, design system); ADR-013 C-7; ADR-015 (marca PROVISÓRIO); ADR-012 (rótulo FICTÍCIO) |
| **Estimativa** | L |

---

## 1. Objetivo

O frontend deixa de ser uma tela única crua e passa a ter casca, páginas e **design system escuro
próprio** (ADR-017). O simulador fica guiado, com a cena 3D ocupando a página e painéis translúcidos
por cima.

## 2. Contexto

Leva D. Tarefas paralelas:
- TASK-038: backend de autenticação (`backend/**`).
- TASK-041: cena 3D (`frontend/src/three/**`). Esta tarefa **não** altera essa pasta e consome só a API
  pública que já existe.

Na leva D2 vêm a TASK-040 (login, guardas de rota, página de usuários) e a TASK-042 (páginas completas
de catálogo e tabelas). Deixe pontos de encaixe claros para as duas e documente-os no handoff:
- um `AuthProvider` falso, sempre "sem autenticação";
- o menu do usuário como espaço reservado;
- a rota `/usuarios` como espaço reservado.

## 3. Critérios de aceite

- [x] **CA-1** — Dependências do ADR-017 § 4 instaladas: `react-router`, `lucide-react` e as duas
  fontes `@fontsource-variable/*`. Nenhuma outra dependência de runtime.
- [x] **CA-2** — Tema:
  - tokens em `src/presentation/theme/tokens.css`: cores de superfície, texto, acento e situação,
    espaçamento, raios, sombras e movimento;
  - reset global e tema escuro;
  - contraste AA, foco visível e `prefers-reduced-motion`;
  - fundo sólido de reserva onde `backdrop-filter` não existe.
- [x] **CA-3** — Componentes em `src/presentation/ui/`, com CSS Modules e testes Vitest de
  comportamento e acessibilidade:
  - Button, IconButton, Panel (vidro), Field + Input + Select, Badge/StatusPill;
  - Tabs, Dialog, Drawer, Toast, Table, EmptyState, Skeleton, Stepper;
  - Gauge: utilização de 0 a 100 %, com faixas de cor.
- [x] **CA-4** — Casca (`AppShell`) e roteamento:
  - trilho de navegação recolhível com ícones;
  - barra superior com título e espaço para o menu do usuário;
  - roteamento com as rotas do ADR-017 § 1;
  - Catálogo e Tabelas ainda simples, reutilizando os painéis existentes restilizados;
  - Usuários como espaço reservado.
- [x] **CA-5** — Página **Início**:
  - boas-vindas e atalhos para Simulador, Catálogo e Tabelas;
  - resumo do catálogo (contagens) com estados de carregando, vazio e erro;
  - avisos permanentes: dados FICTÍCIOS e estratégia PROVISÓRIA.
- [x] **CA-6** — Página **Simulador**:
  - cena full-bleed;
  - painel de passos à esquerda, cada passo com estado pendente, atual ou completo e liberado em
    sequência:
    1. Guindaste: seleção encadeada;
    2. Carga: painel de carga;
    3. Posição: controles do guindaste;
  - HUD de resultado à direita: situação com cor, Gauge de utilização, capacidade, raio e selo
    PROVISÓRIO;
  - barra de status da conexão;
  - a avaliação continua funcionando como hoje (WS com fallback para REST).
- [x] **CA-7** — Sem regressão de comportamento:
  - todos os testes Vitest existentes passam, ajustados aos componentes novos quando preciso;
  - os specs E2E acompanham as páginas novas (o de avaliação navega até `/simulador`);
  - gates passam: lint, format, typecheck, test, build, E2E contra o vite preview e
    `scripts/check-structure.sh`.
- [x] **CA-8** — Capturas de tela das páginas Início e Simulador em 1440×900 e 1280×720, salvas em
  `docs/assets/screenshots/` e citadas no handoff.

Evidências em `handoffs/TASK-039.md` § 2 e § 4.

**Acréscimo pedido pela sessão principal (2026-09-26): ligar a cena nova da TASK-041** — parcial.
Feito: cores de situação iguais às de `palette.ts`, situação só `ok`/`over`/`unknown` e botões de
câmera prontos. Falta: mesclar `task/TASK-041-cena-3d-enriquecida` (recusado pelo controle de
permissões da sessão), passar `evaluationStatus`, `load` e o `ref` de câmera ao `CraneViewport` e
refazer as capturas (handoff § 7 e § 10).

## 4. Escopo

### Dentro do escopo

`frontend/**`, **exceto** `frontend/src/three/**` (TASK-041); `docs/assets/screenshots/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- login real e chamadas a `/auth` (TASK-040);
- tabelas, drawers e fluxo completo de importação (TASK-042);
- a cena 3D em si (TASK-041);
- `backend/**`, ADRs, `handoffs/current.md` e os docs gerais.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/package.json`, `package-lock.json` | alterar | sim |
| `frontend/src/main.tsx`, `src/app/App.tsx` (vira router) | alterar | sim |
| `frontend/src/presentation/theme/*`, `ui/*`, `layout/*`, `pages/*` | criar | não |
| `frontend/src/presentation/panels/*` | restilizar | sim |
| `frontend/e2e/tests/*.spec.ts` | alterar | sim |

## 6. Riscos e dependências

- A TASK-041 muda a cena em paralelo. Esta tarefa usa `CraneViewport` e as props que ele tem hoje.
- As fontes aumentam o pacote: use só os pesos necessários.

## 7. Teste manual (se houver)

1. Rodar `npm run dev` em `frontend/`.
2. Navegar por Início → Simulador → Catálogo → Tabelas.
3. Completar os três passos do simulador. Sem backend, o catálogo mostra o erro no próprio passo.

> Movida para `completed/` em 2026-09-26 pela autorização permanente da pessoa responsável (revisão independente dispensada).
