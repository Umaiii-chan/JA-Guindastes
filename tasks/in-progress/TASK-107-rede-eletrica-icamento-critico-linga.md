# TASK-107 — rede elétrica, içamento crítico e altura única das lingas (D4 e F-19)

Decisões D4 e F-19, delegadas pelo Anderson ("decida por mim, quanto mais real melhor") e registradas
no ADR-051. Origem: `handoffs/TASK-090.md` § 8 item 3 (altura das lingas) e a lista de decisões do dono.

## Critérios de aceite

- [x] **CA-1** — Distância mínima de rede elétrica pela tabela decidida (3,05 m até 50 kV; +0,4 pol por kV
  acima de 50 até 200 kV; 15, 20, 25 e 35 pés nas faixas seguintes), conferida contra a lança, o cabo e a
  carga **em qualquer posição** (giro de 0° a 360°); tensão selecionável no editor do ambiente.
- [x] **CA-2** — O planejador não propõe plano que viole a distância (teste independente), e a avaliação
  alerta com a razão (violação crítica; abaixo de 1,5× atenção) sem mudar o `tipping_risk`.
- [x] **CA-3** — Gatilhos de içamento crítico (75 % da capacidade efetiva, tandem, carga sobre ocupados,
  distância < 1,5×, vento > 70 % do limite, solo/inclinação em atenção) com a razão e o plano de içamento
  exigido no alerta.
- [x] **CA-4** — A altura das lingas vem de UMA geometria (comprimento + ângulo) usada igual pelo planejador
  e pela cena, com teste de paridade (tabela única lida por pytest e vitest); a divergência plano × cena sumiu.
- [x] **CA-5** — ADR-051 escrito (NR-10 e NR-11 como contexto); `known-gaps.md` atualizado.
- [ ] **CA-6** — PR no fork (base `development`), revisão da Coruja e merge pelo `safe-merge.sh` (pessoa).

## Fora do escopo

`docs/business-rules.md` (a pessoa registra as RN); conferência da tabela com o texto oficial (L-017).
