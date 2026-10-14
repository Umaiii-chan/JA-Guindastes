# TASK-073 — carga posicionável, ponto de entrega, engatar e soltar

Pedido da pessoa responsável em 2026-10-14: "a posição inicial da carga o usuário define, igual
fazemos com os objetos, e na simulação a gente vai até a carga, coleta e movimenta para o ponto de
entrega". ADR-035. Parte do editor 3D do ambiente (TASK-066, ADR-032).

## Critérios de aceite

- [x] **CA-1** — Contrato aditivo e opcional no cenário: `cargo?` (`x`, `z`, `rotationYDeg`) e `delivery?` (`x`, `z`, `rotationYDeg`, `radiusM`), no frontend e no backend (entidade, esquemas e validação: posição finita; raio de 0,5 a 30 m). Cenários antigos intactos.
- [x] **CA-2** — Editor 3D: ferramentas "Posicionar carga" e "Ponto de entrega" (clicar no chão), mover e girar como os obstáculos, raio do alvo pela escala. A carga aparece apoiada no terreno com a caixa das medidas do passo Carga; o alvo é um anel no chão com o raio.
- [x] **CA-3** — Com a carga posicionada, ela fica no chão (não no gancho). "Engatar" liga com o fim do gancho a até 0,5 m acima do topo e a até 0,5 m na horizontal; a carga passa a seguir o gancho.
- [x] **CA-4** — Antes de engatar (e depois de soltar), a avaliação recebe peso 0; engatada, recebe o peso do passo Carga.
- [x] **CA-5** — "Soltar" liga com a base a até 0,2 m do chão. Dentro do raio do alvo: "Entregue", com o tempo da operação. Fora: a carga fica onde caiu, com o aviso "fora do ponto de entrega".
- [x] **CA-6** — As colisões continuam valendo, com a carga no chão como obstáculo enquanto não está engatada.
- [x] **CA-7** — Dicas "posicione a carga e a entrega", "vá até a carga e engate", "leve até a entrega e solte" no painel, sem travar o modo livre (sem carga posicionada, tudo funciona como antes).
- [x] **CA-8** — A gravação registra engatar, soltar e a posição da carga (campo aditivo `cargo` no quadro); a reprodução mostra a carga e marca engatar e soltar na linha do tempo.
- [x] **CA-9** — Validado no navegador, com o ciclo completo (posicionar, engatar, levar, soltar no alvo, "Entregue"); capturas em `docs/assets/screenshots/leva-f/task-073-*`.

## Testes a escrever depois

- Interação do mouse no `SceneEditor` para a carga e o alvo (clique de seleção, arrastar, girar, raio pela escala) com WebGL simulado.
- `CargoOperationPanel` e `useEnvironmentEditor` (rótulo, exclusão e Delete da carga e do alvo) como componentes.
- Teste de integração do backend com Postgres: salvar e reabrir cenário com `cargo` e `delivery` (os testes de integração pulam sem o banco).
- Engatar em terreno inclinado e com a cadeia de acessórios maior; soltar sobre uma elevação.
- Reproduzir uma gravação antiga (sem `cargo`) com o cenário novo aberto.
