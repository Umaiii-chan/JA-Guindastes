# TASK-062 — auditoria visual e textos de produto final

Pedido da pessoa responsável em 2026-10-14: telas poluídas, conteúdo vazando, falta de rolagem,
simulação em tela cheia e remover da interface termos de MVP (provisório, ADR, fictício, backend...).

## Critérios de aceite

- [x] **CA-1** — Barra da cena cabe sem cortar (sai "Vista 3D" e o transporte; ações viram ícones em tela estreita).
- [x] **CA-2** — Coluna de controles com rolagem; acessórios em seção recolhível.
- [x] **CA-3** — Botões "Ocultar painel" e "Tela cheia" (API do navegador com recurso CSS; Esc sai).
- [x] **CA-4** — Nenhum texto visível com ADR, RN, TASK, PEND, PROVISÓRIO, FICTÍCIO, backend, frontend, WebSocket ou REST; motivos de "não avaliável" em frases.
- [x] **CA-5** — ADR-022..028 aceitos e ADR-022..030 indexados.

## Testes a escrever depois

- Tela cheia e painel recolhido (unitário do `SimulatorPage` e e2e).
- `reasonLabel` para todos os códigos.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
