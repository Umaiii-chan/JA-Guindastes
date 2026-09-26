# Dados de demonstração — FICTÍCIOS

> **FICTÍCIO** — todos os arquivos desta pasta têm dados inventados só para a demonstração
> reproduzível do MVP (TASK-035; doc-fonte § 23, Estação 5). Não representam capacidade real, não
> vêm de tabela de fabricante nem da doc-fonte e não podem ser usados como referência de operação
> (ADR-012; known-gaps P-007). Nunca apresente estes números como capacidade de um guindaste real.

O formato CSV interno (TASK-010) é **provisório** e não aceita linha de comentário: por isso o rótulo
FICTÍCIO está no nome de cada arquivo e neste README, e não dentro dos arquivos.

| Arquivo | Conteúdo | Usado em |
|---------|----------|----------|
| `tabela_carga_ficticia_demo_v1.csv` | 27 pontos FICTÍCIOS, lanças de 12, 17 e 22 m; importada e ativada pelo seed | `app/demo_seed.py` |
| `tabela_carga_ficticia_demo_v2.csv` | os mesmos pontos com a capacidade × 0,9 (FICTÍCIA); importada à mão no roteiro para mostrar a troca de versão | `docs/demo.md` |
| `tabela_carga_ficticia_demo_com_erros.csv` | cabeçalho válido e linhas com texto, negativo, valor vazio e ponto em conflito; mostra o relatório de erros | `docs/demo.md` |

Os valores esperados de cada passo do roteiro estão em `docs/demo.md` e são conferidos por
`tests/test_demo_seed.py`.
