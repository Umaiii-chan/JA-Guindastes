# ADR-017 — Navegação por páginas e design system escuro do frontend

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (pela pessoa responsável em chat, 2026-09-26) |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), registrando as escolhas da pessoa responsável |
| **Decisores** | Anderson Sehnem (em chat, 2026-09-26: visual "Escuro tipo software 3D"; fluxo "Páginas + simulador guiado") |
| **Tarefa relacionada** | TASK-039 (fundação), TASK-040..042 |
| **Substitui** | — (complementa o ADR-005 e o ADR-012) |

## Contexto

Até a leva C, o frontend era uma tela única com todos os painéis empilhados numa barra lateral. A
pessoa responsável achou "muito cru" e pediu design melhor, login e um fluxo de uso mais claro.

## Decisão

### 1. Páginas (React Router)

| Rota | Página | Perfil |
|------|--------|--------|
| `/login` | Login | público |
| `/` | Início: atalhos, resumo do catálogo, avisos (dados FICTÍCIOS, estratégia provisória) | todos |
| `/simulador` | Simulador guiado | todos |
| `/catalogo` | Fabricantes, guindastes e configurações | ADMIN edita; Operador só vê |
| `/tabelas` | Tabelas de carga: validar, importar, versões, ativar | ADMIN edita; Operador só vê |
| `/usuarios` | Usuários | ADMIN |
| `*` | Não encontrada | — |

Casca: **trilho de navegação** à esquerda (ícone + rótulo, recolhível) e **barra superior** com o título
da página e o menu do usuário (nome, perfil, sair). As rotas guardadas redirecionam para `/login`,
preservando o destino.

### 2. Simulador guiado

- A cena 3D ocupa a área inteira da página (full-bleed).
- **Painéis translúcidos** (vidro escuro, `backdrop-filter`) flutuam sobre a cena:
  - à esquerda, os **passos** 1 Guindaste → 2 Carga → 3 Posição, cada um com estado (pendente, atual,
    completo) e liberado quando o anterior está completo;
  - à direita, o **resultado** sempre visível: situação, utilização em medidor, capacidade, raio e a
    marca PROVISÓRIO do ADR-015;
  - no rodapé, a conexão (WebSocket/REST) e as ações de câmera.
- O resultado que vale continua sendo o do backend. A geometria do navegador é só pré-visualização
  (ADR-013 C-7).

### 3. Design system próprio, tema escuro

- Sem biblioteca de componentes: componentes próprios em `src/presentation/ui/` (Button, IconButton,
  Panel, Field, Input, Select, Badge, Tabs, Dialog, Drawer, Toast, Table, EmptyState, Skeleton, Stepper,
  Gauge).
- **Tokens** em CSS custom properties (`src/presentation/theme/tokens.css`):
  - cores: fundo grafite-azulado, superfícies em camadas, acento ciano para interação, e cores de
    situação: verde para permitido, âmbar para atenção, vermelho para acima da capacidade, cinza para
    não avaliável;
  - espaçamento, raios, sombras e tempos de animação.
- Tema **escuro fixo**, como a escolha da pessoa responsável.
- Contraste de texto AA (4,5:1). Foco visível em todo controle. `prefers-reduced-motion` respeitado.
- Estilos em **CSS Modules** (nativo do Vite), um `.module.css` por componente.

### 4. Dependências novas de runtime

Todas MIT ou OFL, e todas locais, sem CDN:

- `react-router` (roteamento);
- `lucide-react` (ícones, importação por ícone);
- `@fontsource-variable/inter` e `@fontsource-variable/jetbrains-mono` (fontes locais; números
  técnicos em mono).

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Componentes próprios + CSS Modules (escolhida)** | controle total do visual escuro; sem runtime de CSS; pacote pequeno | mais código nosso | — |
| MUI / Chakra / Mantine | muitos componentes prontos | visual genérico, pacote grande, tema escuro trabalhoso | peso e estética |
| Tailwind + shadcn/ui | rápido de montar | nova toolchain de CSS e muitas dependências (Radix) | mais do que o projeto precisa |
| Tela única melhorada | menos mudança | não resolve o fluxo nem separa o que é do admin | recusada pela pessoa responsável |

## Consequências

**Positivas:**
- fluxo claro e separação visual do que é do admin;
- a cena 3D ganha destaque.

**Negativas / custos:**
- quatro dependências novas;
- os testes E2E e de componentes precisam ser atualizados às páginas novas.

**Riscos:**
- `backdrop-filter` pesa em GPU fraca. Deve haver um fallback de fundo sólido quando
  `@supports not (backdrop-filter: blur(1px))`.
