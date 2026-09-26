# Limitações conhecidas e dívidas técnicas

> Este documento existe para que **nenhum agente presuma que algo funciona quando não funciona**.
> Qualquer pessoa ou agente pode adicionar itens. Só a pessoa responsável remove (quando resolvido,
> mova para a seção "Resolvidos" com a tarefa que resolveu).

| Campo | Valor |
|-------|-------|
| Última revisão | `<AAAA-MM-DD>` |

---

## 1. Limitações funcionais

Coisas que o sistema **não faz** hoje, mesmo que pareça que deveria.

| # | Limitação | Impacto | Decisão / plano | Tarefa |
|---|-----------|---------|-----------------|--------|
| L-001 | `<preencher>` | `<quem é afetado e como>` | `<aceitar / resolver em ...>` | `<TASK-XXX ou —>` |

---

## 2. Dívidas técnicas

Atalhos tomados conscientemente que precisam ser pagos.

| # | Dívida | Onde | Por que foi feito assim | Risco de não resolver | Tarefa |
|---|--------|------|-------------------------|-----------------------|--------|
| D-001 | `<preencher>` | `src/...` | `<preencher>` | `<preencher>` | `<TASK-XXX ou —>` |

---

## 3. Problemas conhecidos (bugs)

| # | Problema | Como reproduzir | Contorno | Tarefa |
|---|----------|-----------------|----------|--------|
| B-001 | `<preencher>` | `<passos>` | `<preencher ou nenhum>` | `<TASK-XXX ou —>` |

---

## 4. Decisões pendentes

Perguntas sem resposta que bloqueiam ou influenciam trabalho futuro. A pessoa responsável decide e
o resultado vira ADR (arquitetural) ou RN (negócio).

| # | Pergunta | Levantada por | Data | Bloqueia |
|---|----------|---------------|------|----------|
| P-001 | `<preencher>` | `<agente/pessoa>` | `<data>` | `<TASK-XXX ou nada>` |

---

## 5. O que os agentes NÃO devem presumir

Lista explícita. Se está aqui, o agente deve **verificar** antes de depender.

- `<ex.: que o ambiente de CI tem acesso à internet para baixar X>`
- `<ex.: que a API externa Y está disponível em ambiente de teste — não está>`
- `<ex.: que existe índice na coluna Z — não existe>`
- `<ex.: que os testes e2e rodam localmente sem Docker — precisam de Docker>`
- que `codex` ou `gemini` estão instalados: em 2026-09-26 só o `claude` (Claude Code 2.1.280) estava no PATH (ADR-003)
- que os termos de uso das assinaturas permitem automação local via CLI: não confirmado para nenhum fornecedor (ADR-003, princípio (e))
- que `claude -p` consome a cota da assinatura, e não crédito de API, nem qual é o formato do JSON de saída: não verificado, `claude -p` nunca foi executado (ADR-003, "Evidências")

---

## 6. Áreas sem cobertura de testes

Cópia de [`testing-strategy.md`](testing-strategy.md) § 7 para ficar visível aqui.

- `<preencher>`

---

## 7. Resolvidos

Histórico do que saiu das seções acima.

| # | Item | Resolvido em | Tarefa / PR |
|---|------|--------------|-------------|
| — | — | — | — |
