# TASK-095 — tela do simulador com a cena como prioridade

Pedido da pessoa responsável em 2026-10-16: "quero melhorar os menus dentro da simulação, eles
ocupam muito espaço e tem muitas informações, quero algo mais simples sem remover nada do que temos,
quero que na tela de simulação o canva seja a prioridade, ocupe o maximo de espaço possivel na tela".

Desenho registrado no [ADR-042](../../docs/decisions/ADR-042-tela-do-simulador-com-a-cena-como-prioridade.md)
(Proposto).

## Critérios de aceite

- [ ] **CA-1** — Com todas as folhas fechadas, o canvas ocupa ao menos 85 % da área abaixo da barra
      superior em 1280×720, 1366×768 e 1920×1080; no simulador o trilho começa recolhido (64 px).
- [ ] **CA-2** — Os painéis flutuam sobre a cena (camada `overlay-panel`): barra de ferramentas à
      esquerda que abre uma folha lateral por vez (Configurar, Acessórios, Ambiente, Dois
      guindastes, Planejar, Gravações), chip de contexto, barra de vistas no topo, cartão de
      resultado no canto direito e barra de comando embaixo. Nada sai: tudo o que havia continua
      acessível.
- [ ] **CA-3** — As folhas escondem em vez de desmontar: fechar "Planejar" não apaga as
      recomendações nem trava os controles durante a execução (F-20).
- [ ] **CA-4** — A barra de comando fica sempre à vista com os quatro controles do guindaste, o
      seletor de guindaste (2+), o estado das patolas com "Apoiar e nivelar" e Gravar/Parar.
- [ ] **CA-5** — O cartão de resultado mostra no primeiro nível a situação, a régua do limite, a
      capacidade, o peso comparado, o raio e o risco de tombamento; "Detalhes" abre no próprio
      cartão a conta do peso, o limite, os alertas, a consulta, a geometria e o relatório.
- [ ] **CA-6** — Em tela cheia (nativa ou por CSS), as janelas (Dialog, Drawer, IA) aparecem por
      cima da cena (F-21).
- [ ] **CA-7** — Teclado: foco visível, ordem ferramentas → folha → barra de comando → cartão, Esc
      fecha a folha, teclas 1–4 escolhem a vista (documentadas na Ajuda).
- [ ] **CA-8** — Sem rolagem horizontal em 1280×720; lint, formatação, tipos, testes, build e E2E
      (sem backend) passam, sem falhas novas em relação a `development`.
- [ ] **CA-9** — Capturas antes/depois em `docs/assets/screenshots/task-095-*.png` com a área do
      canvas medida.

## Testes a escrever depois

- E2E de layout: canvas ≥ 85 % da área útil e sem rolagem horizontal nos três tamanhos.
- E2E de tela cheia nativa com uma janela aberta (o Playwright sem cabeça não entra em tela cheia de
  verdade; hoje só o modo por CSS é exercitado).
