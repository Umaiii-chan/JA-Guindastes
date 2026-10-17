# TASK-072 — Biblioteca de objetos reais no editor 3D

- **Decisão:** ADR-036. **Origem:** pedido de Anderson Sehnem em chat, 2026-10-14 (leva F).
- **Escopo:** frontend (domínio do ambiente, colisões, cena, editor e paleta), GLBs em
  `frontend/public/models/objetos/`, script gerador e backend dos cenários (`kind: "model"`).

## Critérios de aceite

- CA-1 — A biblioteca lista 15 ou mais objetos em escala real: árvores, moitas, casas, barracão
  aberto e galpão fechado, caminhões, carros, van, contêiner e o guindaste estacionado.
- CA-2 — Cada objeto tem caixas de colisão; o barracão tem paredes, teto e uma porta aberta.
- CA-3 — A ferramenta "Biblioteca" do editor abre a paleta por categoria, com miniaturas (ícone sem
  WebGL); clicar no chão coloca o objeto, e mover, girar, redimensionar e excluir valem como nos
  obstáculos.
- CA-4 — Os GLBs aparecem no lugar das caixas, com sombra e a base assentada no terreno.
- CA-5 — A carga e o gancho colidem com cada caixa do objeto (com a rotação e a escala dele) e passam
  pela porta do barracão; cabo e lança só avisam, uma vez por objeto.
- CA-6 — O backend dos cenários aceita `kind: "model"` com `model_id`; a avaliação manda o id do
  objeto em `obstacle_conflicts` como antes.
- CA-7 — Os modelos da Kenney (CC0) ficam fora do Git; as cópias otimizadas e os créditos ficam em
  `frontend/public/models/objetos/`.

## Testes a escrever depois

- Teste e2e da paleta com o clique no chão sem o ajuste por campos numéricos (hoje o teste leva cada
  objeto ao ponto pelos campos do painel "Ambiente", porque o clique cai onde a câmera aponta).
- Selecionar e arrastar um objeto da biblioteca com o mouse (o contorno de seleção e o gizmo na base).
- Miniaturas com WebGL real em outro navegador e o cenário com os 100 obstáculos de objetos.
- Salvar e reabrir um cenário com objetos contra o backend com Postgres (o teste do backend usa a
  memória).


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PR #26). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
