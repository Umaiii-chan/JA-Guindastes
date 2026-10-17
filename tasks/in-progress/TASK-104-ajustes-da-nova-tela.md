# TASK-104 — ajustes da nova tela do simulador

Pendências da TASK-095 (ADR-045) e achados da revisão pós-merge do PR #54. Desenho no ADR-048.

## Critérios de aceite

- [ ] **CA-1** — Com a trajetória rodando ou o passo a passo ativo, uma faixa compacta sobre a cena
  mostra fase, progresso, velocidade e Parar (e, no passo a passo, a próxima ação e os botões), mesmo
  com a folha "Planejar" fechada; nomes acessíveis preservados e sem duplicar.
- [ ] **CA-2** — As vistas (Perspectiva, Lateral, Topo, Operador) enquadram o guindaste na área livre,
  descontando barra de comando, barra de ferramentas e cartão de resultado, sem remontar a cena.
- [ ] **CA-3** — Sliders compactos mostram mín./máx. ao passar o mouse ou focar, e a observação (ex.:
  FICTÍCIO) fica num botão visível e focável ligado por `aria-describedby`.
- [ ] **CA-4** — Barra de vistas e chip de contexto vêm antes da barra de ferramentas no DOM (ordem de
  foco = ordem visual).
- [ ] **CA-5** — Janela aberta não é remontada ao sair da tela cheia, e o foco do modal é refeito se o
  alvo do portal mudar.
- [ ] **CA-6** — Conexão compacta tem um ícone por estado e "atualizando…" visível.
- [ ] **CA-7** — Com "Ocultar painéis", um selo mínimo de situação e risco de tombamento continua visível.
- [ ] **CA-8** — Atalhos 1–4 de câmera registrados no handoff (WCAG 2.1.4).
