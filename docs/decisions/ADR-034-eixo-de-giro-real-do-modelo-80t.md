# ADR-034 — eixo de giro real do modelo 80 t e ficha de demonstração com a = 0,46 m

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (Anderson Sehnem, em chat em 2026-10-14) |
| **Tarefa** | TASK-069 |
| **Substitui** | ADR-031 quanto à calibração (eixo deslocado 2 m) e à orientação do chassi |

## Decisão

- O eixo de giro do modelo é o centro do anel de giro da superestrutura do arquivo. O pino da lança
  fica a = 0,46 m à frente dele. A ficha de demonstração, o padrão do frontend e o modelo usam esse a.
- O chassi é girado 180° em torno do eixo, para a lança em repouso ficar sobre a cabine (ψ = 0 é a
  frente do caminhão). As patolas trocam de canto conforme o giro.
- A cabeça da lança recebe um material liso na cor da lança, porque as UVs dela caem numa área escura
  do atlas de texturas.
- O seed migra a ficha antiga da demonstração (a = −1,56 m) para a nova; nada mais é sobrescrito.

## Consequências

Os números do roteiro da demonstração mudaram (`docs/demo.md`, `tests/test_demo_seed.py`).
