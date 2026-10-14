# TASK-066 — editor 3D livre do ambiente e painéis recolhíveis

Pedido da pessoa responsável em 2026-10-14: o ambiente deve ser um canvas 3D onde a pessoa posiciona
as coisas e desenha elevações; o guindaste deve acompanhar o terreno; os três painéis da coluna
precisam recolher e expandir. ADR-032. Depende do PR da TASK-062 (layout e textos de produto). O
backend da avaliação (campos novos) é a TASK-067.

## Critérios de aceite

- [x] **CA-1** — Simulação guiada, acessórios e ambiente são seções recolhíveis independentes, com estado lembrado em `localStorage` (falha de armazenamento não quebra).
- [x] **CA-2** — Botão "Editar ambiente" na barra da cena, com ferramentas: selecionar e mover/girar/redimensionar (obstáculos e guindaste), excluir, adicionar caixa ou cilindro, esculpir, aplainar, pintar solo e vento (com seta).
- [x] **CA-3** — Contrato aditivo `soilZones`, `wind`, `soilAt` e feição `flatten`; backend de cenários aceita e valida; cenários antigos intactos.
- [x] **CA-4** — O guindaste assenta na altura do terreno, inclina pelo plano das sapatas e os macacos compensam até o nivelamento; atualiza ao esculpir.
- [x] **CA-5** — A avaliação recebe `soil_kinds`, `wind_speed_ms` e `obstacle_conflicts` (opcionais).
- [x] **CA-6** — Validado no navegador; capturas em `docs/assets/screenshots/leva-e/task-066-*`.
- [x] **CA-7** — Desfazer (Ctrl+Z) dos gestos do editor.

## Testes a escrever depois

- Interação do mouse no `SceneEditor` (pincel, arrasto, clique de seleção) com WebGL simulado, e e2e do modo editar.
- `EnvironmentEditorToolbar` e `useEnvironmentEditor` (teclas Delete e Ctrl+Z, troca de ferramenta).
- Colisões considerando a inclinação do chassi.
- Teste de integração da avaliação com os campos novos (TASK-067).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14. Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
