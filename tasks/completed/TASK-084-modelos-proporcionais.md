# TASK-084 — objetos da IA na proporção do modelo 3D

Relato da pessoa usuária em 2026-10-14: os carros gerados pelo assistente apareciam esticados. Causa: a cena escala cada eixo do modelo para a largura, profundidade e altura que a IA escreve (ex.: carro 2 × 4,5 × 1,5 m contra o modelo 2,62 × 4,46 × 2,27 m).

## Critérios de aceite

- [x] **CA-1** — Ao aplicar uma proposta da IA, veículos e guindastes da biblioteca ficam no tamanho real do modelo.
- [x] **CA-2** — Os demais objetos da biblioteca recebem escala uniforme (0,5× a 3×), preservando a área da pegada pedida.
- [x] **CA-3** — Caixas, cilindros e o redimensionamento manual no editor não mudam.

## Testes a escrever depois

- Teste de tela: aplicar uma proposta com carro e árvore e conferir a escala dos meshes.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PR #38). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
