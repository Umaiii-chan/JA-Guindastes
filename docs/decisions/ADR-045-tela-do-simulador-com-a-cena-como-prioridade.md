# ADR-045 — Tela do simulador com a cena como prioridade

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-10-17 |
| **Autor** | agente Claude Code (Opus 5.5), sessão de 2026-10-16/17 |
| **Decisores** | Anderson Sehnem (pessoa responsável) |
| **Tarefa relacionada** | TASK-095 |
| **Substitui** | — (complementa o ADR-017 § 2 e o ADR-019 § 2; nenhum ADR Aceito é alterado) |

## Contexto

Pedido da pessoa responsável em 2026-10-16: "quero melhorar os menus dentro da simulação, eles ocupam
muito espaço e tem muitas informações, quero algo mais simples sem remover nada do que temos, quero
que na tela de simulação o canva seja a prioridade, ocupe o maximo de espaço possivel na tela".

Até a TASK-082, o simulador era uma grade em colunas: à esquerda a coluna de procedimento (passos,
tandem, planejamento, acessórios e ambiente, em seções recolhíveis); à direita a prancha com a faixa
de título, a gravação, o editor, a coleta e entrega, a cena e a ficha de resultado de altura fixa. A
cena ficava com 25 % da tela em 1366×768 e 40 % em 1920×1080 (medido; ver `handoffs/TASK-095.md`).

Problemas que vieram junto:

- **F-20**: as seções recolhíveis desmontavam o conteúdo. Recolher "Planejar operação" apagava as
  recomendações e, durante a execução, o fim da trajetória não chegava à tela.
- **F-21**: a tela cheia nativa pedia o palco, mas as janelas (`Dialog`, `Drawer`, IA) eram montadas
  no `document.body`, fora dele: em tela cheia nenhuma janela aparecia. No modo por CSS, o palco
  (z 50) cobria a gaveta (z 40).
- Informação repetida: o raio aparecia em seis lugares, a capacidade e o limite nas métricas e nos
  detalhes, e o título dos acessórios duas vezes.

## Decisão

A cena ocupa o palco inteiro do simulador e os painéis **flutuam sobre ela**, na camada
`--z-overlay-panel` (10, que existia sem uso). O ADR-017 § 2 já pedia "a cena 3D ocupa a área
inteira da página" com painéis sobre ela; o ADR-019 trocou o vidro por papel. Este ADR junta os dois:
painéis de papel com moldura de tinta de 1 px, cantos retos, sem degradê, vidro nem brilho.

1. **Trilho recolhido** (64 px) por padrão nas páginas de palco inteiro (`fullBleed`), com a
   preferência guardada à parte (`ja-guindastes.rail-collapsed.stage`).
2. **Barra de ferramentas vertical** à esquerda, um botão por **folha lateral não modal** (uma por
   vez; Esc, o X ou o próprio botão fecham): Configurar (simulação guiada 01–03), Acessórios,
   Ambiente, Tandem, Planejar e Gravações salvas. **Fechada, a folha fica `hidden`, não é
   desmontada** (corrige o F-20 sem mudar a lógica do planejamento). Com passos pendentes, a folha
   Configurar abre sozinha no primeiro acesso.
3. **Chip de contexto** no topo: modelo, configuração, peso da carga e "N/3"; abre Configurar.
4. **Barra de vistas** no topo à direita: a conexão vira um ponto de cor (texto para leitores de
   tela), as quatro vistas (teclas 1–4), área de operação, editar ambiente, assistente, ocultar
   painéis e tela cheia.
5. **Cartão de resultado** no canto direito: situação, régua da utilização, capacidade, peso
   comparado, raio, risco de tombamento e o alerta mais grave. **Detalhes** abre no próprio cartão a
   conta carga + gancho + acessórios, a zona, o limite do modelo, todos os alertas, a consulta da
   tabela, a geometria de pré-visualização e o relatório. Os detalhes ficam no HTML mesmo fechados.
   Com o tandem engatado, a ficha do tandem ocupa o cartão, como antes.
6. **Barra de comando** embaixo, sempre à vista: os quatro controles do guindaste compactos (rótulo
   curto à vista, nome completo como nome acessível), o seletor de guindaste (2+), o estado das
   patolas com "Apoiar e nivelar" e Gravar/Parar (o nome e o Salvar abrem por cima dela).
7. **Coleta e entrega** numa linha logo acima da barra de comando, e não no topo: a dica ("faltam
   2 m") e Engatar/Soltar ficam junto dos controles que levam o gancho até a carga. O **editor 3D**
   e os **avisos de colisão** ficam no topo, no meio; o **player** da gravação, numa faixa acima da
   coleta e entrega durante a reprodução.
8. **Janelas em tela cheia (F-21)**: `Dialog` e `Drawer` montam o portal no elemento dado pelo
   `PortalTargetContext`; o simulador passa o próprio palco enquanto a tela cheia (nativa ou por CSS)
   estiver ligada.
9. O `CraneViewport` continua no mesmo lugar da árvore React: tela cheia e "ocultar painéis" são só
   classes e atributos (desmontar recarrega o modelo 3D e perde câmera e engate).

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Cena no palco inteiro, painéis flutuando (escolhida)** | cena com 88–92 % da tela; nada sai; folhas escondem em vez de desmontar | painéis cobrem partes da cena; mais componentes de layout | — |
| Manter as colunas e só compactar (fontes, ficha mais baixa) | pouca mudança | a cena passaria de ~25 % para ~35 % em 1366×768 | não atende "o canvas ocupe o máximo" |
| Abas no lugar das seções recolhíveis | menos rolagem | `ui/Tabs` desmonta o conteúdo (F-20 continuaria) e a coluna continuaria ocupando a largura | mesmo problema de espaço |
| Gavetas modais (`ui/Drawer`) para cada painel | componente pronto | modal: trava a cena enquanto aberta; não dá para mexer na lança com o planejamento à vista | atrapalha a operação |

## Consequências

**Positivas:**
- canvas de 1302×712 px (88 % da tela) em 1366×768 e 1856×1024 (92 %) em 1920×1080, antes 752×349
  (25 %) e 1306×635 (40 %);
- o primeiro nível mostra só o que se olha o tempo todo; o resto fica a um clique, no mesmo lugar;
- F-20 e F-21 corrigidos.

**Negativas / custos:**
- a geometria de pré-visualização saiu do primeiro nível (está em "Detalhes"); os E2E que a leem
  abrem os detalhes antes;
- Gravar/Parar, a lista de gravações e o player agora são três componentes (`RecordingControls`,
  `RecordingLibrary`, `RecordingPlayer`), e o E2E da coleta e entrega procura a lista e o player na
  página, não mais dentro da faixa de gravação;
- os cliques por pixel na vista de topo dos E2E passaram a ser frações da altura do quadro.

**Riscos e como mitigar:**
- painéis cobrindo o guindaste no enquadramento padrão: o cartão e a barra de vistas ficam no canto
  de cima, longe do guindaste; "Ocultar painéis" deixa a cena livre;
- contraste sobre a cena: os painéis têm fundo de papel sólido, não translúcido.

## Impacto na documentação

- [x] `docs/architecture.md` atualizado (componentes do simulador)
- [ ] `docs/development-guide.md` (sem comando novo)
- [ ] `docs/known-gaps.md` (nenhuma limitação nova)
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Verificado: medidas do canvas antes e depois e as capturas em `docs/assets/screenshots/task-095-*`
  (Playwright, `vite preview` sem backend, avaliação respondida no navegador).
- Verificado: em tela cheia nativa no Chromium sem cabeça, a janela "Adicionar guindaste" fica dentro
  do elemento em tela cheia e por cima da cena (`document.fullscreenElement.contains(dialog)`).
- Hipótese: em GPU fraca, a cena maior custa mais por quadro; a renderização é sob demanda
  (`mountCraneScene`), então o custo só aparece com algo se mexendo.
