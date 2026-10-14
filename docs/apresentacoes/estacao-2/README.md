# Estação 2 — Pré-Banca Parcial 1

Material elaborado em 30/09/2026 para a defesa de modelagem e prototipagem.

- Apresentação: `build/estacao-2/entrega/JA-Guindastes-Pre-Banca-Parcial-1-revisada.pptx`.
- Sequência completa editável: [sequencia-avaliacao.mmd](sequencia-avaliacao.mmd).
- Roteiro: [roteiro-de-fala.md](roteiro-de-fala.md).
- Fonte de geração: [gerar-apresentacao.mjs](gerar-apresentacao.mjs).

São 18 slides: 15 para exposição (aproximadamente 15 minutos) e 3 de apoio.
Os slides 11 e 12 contêm a sequência com objetos nativos editáveis do PowerPoint.
Os slides 16 e 17 preservam os diagramas originais fornecidos, disponíveis também
na documentação congelada. As vistas simplificadas das classes destacam atributos
centrais e não pretendem ser um esquema físico do banco.

## Uso na defesa

As notas de cada slide incluem sugestão de fala e referências locais. As capturas
demonstram a interface com dados fictícios. Não são evidência de precisão do motor
de cálculo: as respostas nas capturas podem ser simuladas e não coincidir com a
prévia geométrica. Simulações persistidas e upload de modelos 3D continuam planejados.
A estratégia conservadora é provisória, conforme ADR-015.

## Reprodução

Usar o Node.js e os pacotes fornecidos pelo runtime de artefatos da habilidade
Presentations. Não instalar dependências no frontend para gerar a apresentação.
Na raiz do repositório, definir:

- `RUNTIME_NODE_MODULES`: diretório de pacotes do runtime.
- `RUNTIME_PYTHON`: executável Python do mesmo runtime.
- `PRESENTATIONS_SKILL_DIR`: pasta da habilidade Presentations instalada.

Executar `node docs/apresentacoes/estacao-2/gerar-apresentacao.mjs` com o Node do
runtime. O gerador usa `@oai/artifact-tool` e os validadores da habilidade. Para
uma nova revisão, escolher novos nomes para o PPTX final e para o recibo de
validação no gerador: o finalizador recusa sobrescrever entregas e recibos.

O diretório `build/` é ignorado pelo Git. Versionar as fontes e o handoff, não os
binários gerados. Não é necessário iniciar o backend, abrir dados oficiais ou
alterar `.env` para produzir este material.
