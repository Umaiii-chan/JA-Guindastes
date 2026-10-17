# TASK-087 — carga 3D, guindaste único e trajetória só se atender

Relatos da pessoa usuária em 2026-10-14, no ensaio da apresentação.

## Critérios de aceite

- [x] **CA-1** — A carga proposta pela IA já vem com o tipo e o modelo 3D certos, deduzidos das palavras da descrição (`guessCargoType`).
- [x] **CA-2** — O guindaste da operação vai só em `crane`: regra no prompt, e um "guindaste" repetido a menos de 10 m dele sai dos obstáculos, com aviso nas suposições.
- [x] **CA-3** — "Executar trajetória" fica bloqueado quando a opção escolhida não atende (ex.: 237% do limite), com aviso.

## Testes a escrever depois

- Teste do caso de uso com resposta falsa contendo o guindaste duplicado.
- Planejador: conferir colisão da carga com obstáculos ao longo do giro.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PR #41). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
