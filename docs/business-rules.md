# Regras de negócio

> **Este é o documento que os agentes menos podem inventar.**
> Regras funcionais só entram aqui por decisão da pessoa responsável. Um agente que encontrar uma
> situação não coberta por este documento **deve perguntar** (registrando em
> `handoffs/current.md` → "Pendências / decisões necessárias"), nunca deduzir.

| Campo | Valor |
|-------|-------|
| Última revisão | `<AAAA-MM-DD>` |
| Aprovado por | `<preencher>` |

---

## Como escrever uma regra

Cada regra tem um ID estável (`RN-001`, `RN-002`...) que pode ser citado em tarefas, testes, commits
e ADRs. **Nunca reutilize um ID.** Regra removida fica marcada como `Revogada`, não apagada.

Formato:

```markdown
### RN-001 — <título curto>

**Status:** Ativa | Revogada (em <data>, motivo)
**Contexto:** onde/quando a regra se aplica
**Regra:** enunciado preciso, sem ambiguidade. Prefira "deve"/"não deve".
**Exemplos:**
  - Entrada X → resultado Y
  - Entrada Z → erro W
**Exceções:** casos em que a regra não vale (ou "nenhuma")
**Testes relacionados:** `tests/...` (preenchido pelo agente ao criar o teste)
**Origem:** quem definiu / documento de referência
```

---

## Regras

### RN-001 — `<preencher>`

**Status:** Ativa
**Contexto:** `<preencher>`
**Regra:** `<preencher>`
**Exemplos:**
- `<preencher>`
**Exceções:** `<preencher>`
**Testes relacionados:** —
**Origem:** `<preencher>`

---

## Regras por domínio (índice)

Quando o documento crescer, agrupe por área e mantenha este índice.

| Área | Regras |
|------|--------|
| `<preencher>` | RN-001 |

---

## Perguntas em aberto

Situações identificadas (por pessoas ou agentes) que ainda não têm regra definida. A pessoa
responsável transforma cada item em uma RN ou descarta.

| # | Situação | Levantada por | Data | Decisão |
|---|----------|---------------|------|---------|
| 1 | `<preencher>` | `<agente/pessoa>` | `<data>` | pendente |
