# ADR-019 — Linguagem visual de manual técnico (substitui o tema escuro do ADR-017)

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-27 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), registrando a escolha da pessoa responsável |
| **Decisores** | Anderson Sehnem (em chat, 2026-09-27: "está com muita cara que foi feita por IA, por conta do degradê"; direção "Manual técnico"; identidade própria, sem a marca da empresa) |
| **Tarefa relacionada** | TASK-047 |
| **Substitui** | ADR-017 **§ 3 (design system escuro) e § 4 (fontes)**. As §§ 1 e 2 (páginas e simulador guiado) continuam valendo. |

## Contexto

O tema escuro do ADR-017 tinha fundo em degradê, vidro translúcido, brilho ciano, medidor circular e
cards simétricos. A pessoa responsável achou que "está com muita cara que foi feita por IA" e pediu um
visual com cara de feito por gente:
- paleta sóbria;
- componentes com identidade própria;
- ritmo visual menos simétrico.

## Decisão

A interface passa a usar a linguagem de uma **ficha técnica de fabricante e de uma prancha de
engenharia**.

### 1. Cor

- Tema **claro** fixo.
- Papel e tinta:
  - papel `#F4F1EA`;
  - superfície `#FBFAF6`;
  - tinta `#1F1F1C`;
  - tinta secundária `#5C5A53`;
  - linhas `#CFCAB9`.
- **Um único acento**: laranja-segurança `#D9480F`, só para ação primária, foco e o elemento
  selecionado. Nunca decorativo.
- Cores de situação sóbrias e distintas do acento:
  - dentro `#2F6B3A`;
  - acima `#B42318`;
  - atenção `#B7791F`, reservada (PEND-004);
  - não avaliável `#77756D`.
- Contraste AA em todo texto.
- Proibido:
  - degradês decorativos;
  - `backdrop-filter` e vidro;
  - brilho (`box-shadow` colorido ou `glow`);
  - neon.

### 2. Forma e ritmo

- **Linhas finas de desenho técnico** (1 px) no lugar de sombras.
- Cantos retos, com raio de no máximo 2 px.
- Molduras com "carimbo": título em caixa alta pequena, número de folha ou revisão e, onde fizer
  sentido, cotas.
- Hierarquia por **tipografia e densidade**, não por cor: números grandes em mono, rótulos pequenos em
  caixa alta espaçada.
- **Layouts assimétricos**: colunas de larguras diferentes, seções de alturas e densidades variadas. Nada
  de grades de cards idênticos.
- Medidor de utilização como **régua linear graduada** (0–100 % com marcas a cada 10 %), não
  circular.
- A cena 3D fica num quadro claro, com **grade de papel milimetrado** (linhas de 1 m e 5 m em tinta
  clara), guindaste com cores sólidas e sombras discretas.
- Micro-interações contidas:
  - sublinhado e marcação no hover;
  - carimbo ao confirmar;
  - transições curtas, sem elasticidade.

### 3. Tipografia

- **IBM Plex Sans** (texto) e **IBM Plex Mono** (números, cotas e códigos), fontes locais via
  `@fontsource`, licença OFL.
- Saem Inter e JetBrains Mono.

### 4. Identidade

- Identidade própria do simulador, sem nome, logo ou cores da Guindastes Ribas nem de fabricantes: um
  **wordmark tipográfico** simples e um símbolo geométrico mínimo (triângulo de lança sobre base).
- As telas continuam avisando que os dados são FICTÍCIOS e a estratégia é PROVISÓRIA, no estilo de
  **nota de rodapé ou carimbo**, não de banner.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Manual técnico claro (escolhida)** | parece documento de engenharia; legível; foge do padrão escuro com degradê | a cena 3D perde o "drama" do escuro | — |
| Escuro sóbrio de painel | aproveita a cena escura | ainda próximo do padrão atual | preterida |
| Canteiro terroso | caloroso | menos técnico; risco de parecer tema genérico | preterida |

## Consequências

**Positivas:**
- identidade visual mais autoral e coerente com o domínio;
- mais legibilidade e contraste.

**Negativas / custos:**
- revisão de tokens, componentes, páginas e cena;
- as capturas de tela ficam desatualizadas e precisam ser refeitas;
- troca de fontes.
