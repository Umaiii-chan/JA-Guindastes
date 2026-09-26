# Status deste protótipo

> **Este diretório é apenas referência. Não faz parte do workflow ativo.**

## O que é

Primeira tentativa de orquestração automática de múltiplos modelos (Gemini, GPT, Claude) usando
Python + LangGraph. Os agentes (arquiteto, engenheiro de testes, desenvolvedor, revisor) eram
executados em sequência por um script, e o resultado era publicado como artefato no GitHub Actions.

O código foi validado tecnicamente (lint, MyPy e Pytest passavam), mas **depende de chaves de API
pagas** dos três provedores para funcionar de ponta a ponta.

## Por que foi deixado de lado

O workflow ativo deste repositório (na raiz) foi redesenhado para:

- funcionar **sem nenhuma API paga**;
- usar as interfaces gratuitas/assinadas do ChatGPT, Claude e Gemini **manualmente**;
- manter a continuidade entre agentes por **arquivos versionados** em vez de um orquestrador em memória.

A decisão está registrada em [`docs/decisions/ADR-001-workflow-baseado-em-arquivos.md`](../../docs/decisions/ADR-001-workflow-baseado-em-arquivos.md).

## Quando voltar a usar

Este protótipo pode servir de base para uma **segunda versão** quando houver:

- orçamento para consumo de API;
- chaves configuradas como GitHub Secrets;
- vontade de automatizar etapas que hoje são manuais (por exemplo, o revisor independente).

Nesse cenário, a ideia é reaproveitar o que já existe aqui (papéis, snapshot limitado do repositório,
manifesto de execução) e substituir o handoff em `.ai/runs/` pelo formato definido em
`docs/templates/handoff-template.md`.

## Como executar (se quiser testar)

Exige Python 3.12+, `uv` e chaves em `.env`. Veja o `README.md` original neste diretório.

**Atenção:** o CI da raiz do repositório **não** executa nada deste diretório. Se quiser validar o
protótipo, rode `uv sync --extra dev && uv run pytest` dentro desta pasta, localmente.
