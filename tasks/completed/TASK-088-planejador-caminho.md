# TASK-088 — o plano confere o caminho inteiro

Achados F-01, F-02 e F-13 da auditoria AUD-01 (2026-10-16, base `784a9e1`), no planejador
(`backend/app/domain/services/planning/`, `recommend_lift_plan.py`).

## Critérios de aceite

- [x] **CA-1 (F-01)** — O giro é conferido numa grade densa (no máximo 0,25 m entre amostras no maior raio; teto de 1440 trechos, com a margem crescendo junto), não só nos 13 quadros-chave: um poste fino entre duas amostras e o terreno sob a carga em todo o giro entram na altura de transporte.
- [x] **CA-2 (F-02)** — A lança (do pino à ponta, com meia-seção FICTÍCIA nomeada) e o cabo com gancho e lingas (da ponta ao topo da carga) são conferidos contra os obstáculos em cada amostra densa do movimento como a cena o interpola; a opção que bate é descartada, com o motivo nas notas.
- [x] **CA-3 (F-13)** — Coleta sob ou dentro de obstáculo é recusada com motivo claro (nome do obstáculo); entrega sobre a carreta ou o caminhão plataforma apoia a carga no topo dele; outro obstáculo na entrega recusa; aproximação, engate, subida e descida são conferidas. O frontend não muda (a diferença com a soltura da cena fica no handoff).
- [x] **CA-4** — O tempo de `recommend_lift_plan` no fixture `planejamento_ficticio.py` fica dentro do orçamento de 2,5 s, medido antes e depois.
- [x] **CA-5** — Testes de regressão a partir das provas da auditoria (p1, p2 e p8), com dados FICTÍCIOS.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-17 (00h51, horário de Brasília; PR #48). Revisão independente (AGENTS.md § 3): a Coruja revisou e aprovou na segunda rodada. As pendências do `handoffs/TASK-088.md` § 8 (perguntas 2 a 5, sem bloquear) seguem na TASK-102 (branch `task/TASK-102-pendencias-planejador`).
