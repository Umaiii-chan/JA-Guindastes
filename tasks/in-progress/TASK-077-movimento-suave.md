# TASK-077 — movimento suave na simulação e na reprodução

Relato da pessoa usuária em 2026-10-14: durante a trajetória planejada e na reprodução de uma
gravação, "a tela fica tremendo e pulando". Causas verificadas no código: quatro comandos guardados
em sequência por quadro (uma combinação intermediária podia ser bloqueada e a pose "pulava"),
reprodução sem interpolação e `setCrane` a cada quadro de animação (rota inteira a 60 Hz).

A estabilização dos campos de texto e do layout (CSS, selos, alertas) ficou na TASK-078.

## Critérios de aceite

- [x] **CA-1** — Comando em lote `setState(parcial, { guarded? })` em `CraneCommands` (`CraneController` e `SwitchableCrane`): aplica o estado inteiro de uma vez; com guarda, a colisão é checada só no estado final e, se colidir, o conjunto recua junto ao último estado seguro na reta anterior → pedido.
- [x] **CA-2** — Reprodução de gravação aplica a pose sem a guarda de colisão (`guarded: false`; o estado gravado já foi validado), reavaliando uma vez só para manter os destaques de colisão.
- [x] **CA-3** — Reprodução interpola linearmente a pose entre os quadros vizinhos (giro pelo caminho mais curto); carga e resultado continuam os do quadro gravado, sem reavaliar (RN-008).
- [x] **CA-4** — Cena 3D a cada quadro de animação; estado React (posição da linha do tempo, `setCrane`) a ~5 Hz na reprodução.
- [x] **CA-5** — Trajetória ao vivo usa o comando em lote; tela a ~5 Hz, e a ~10 Hz enquanto grava (o snapshot do gravador depende de `crane.state`, então o refresh precisa acontecer no ritmo dos quadros do gravador).
- [ ] **CA-6** — Validação no navegador (trajetória e reprodução sem pulos; gravação com quadros a ~10 Hz). NÃO EXECUTADO nesta tarefa (prazo).

## Testes a escrever depois

- `SwitchableCrane.setState` com guarda real: estado final seguro (aplica), final colidindo (recua na reta), partida já colidindo, `guarded: false` só reavalia.
- `CraneController.setState`: clamp de cada campo, campos ausentes mantêm o valor.
- `useSimulationRecording`: `uiRefresh` a ~5 Hz durante a reprodução, `positionRef` correto após seek/pausa/fim, pausa sincroniza a posição.
- `usePlanPlayback`: `setProgress` e `onMoved` respeitam `refreshMs` (5 Hz e 10 Hz gravando); fase atualiza no quadro-chave.
- Gravação durante a trajetória: quadros espaçados ~100 ms (verificar no navegador, antes eram ~840 ms).
- e2e da reprodução e captura de tela (ficaram para depois).
