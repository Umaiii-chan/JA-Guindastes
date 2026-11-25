# TASK-125 — tandem planejado: a trajetória move os dois guindastes

Bug da pessoa responsável: depois de "Aplicar" um tandem, "Executar trajetória" só movia o Guindaste 1.

## Critérios de aceite

- [x] **CA-1** — Teste que falha antes: a reprodução aplica os quadros do Guindaste 2 (`craneIndex` 1) nos comandos dele, do primeiro quadro (aproximação) ao último (depois de soltar).
- [x] **CA-2** — Com os dois ganchos engatados, quem conduz o Guindaste 2 continua sendo o tandem da cena (os quadros dele não são aplicados), para não brigar com a cinemática inversa.
- [x] **CA-3** — Com um guindaste só, nada muda.
