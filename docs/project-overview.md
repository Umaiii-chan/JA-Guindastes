# Visão geral do projeto

> **Status deste documento:** `<preencher>` — enquanto houver **qualquer** marcador `<preencher>`
> neste arquivo (ou em `architecture.md`, `business-rules.md`, `development-guide.md`), nenhum agente
> deve implementar nada e o CI falha se houver tarefa em andamento. Onde algo não se aplica, escreva
> "não se aplica". Veja `AGENTS.md` § 1.

| Campo | Valor |
|-------|-------|
| Nome do projeto | `<preencher>` |
| Pessoa responsável | `<preencher>` |
| Repositório | `<preencher>` |
| Última revisão deste documento | `<AAAA-MM-DD>` |

---

## 1. Problema que o sistema resolve *(obrigatório)*

`<preencher>` — Descreva em 3 a 5 frases qual dor existe hoje e por que ela importa.
Evite descrever a solução aqui; descreva o problema.

## 2. Objetivo *(obrigatório)*

`<preencher>` — O que o sistema deve alcançar. Se possível, com uma medida de sucesso
(ex.: "reduzir o tempo de X de 2 dias para 2 horas").

## 3. Usuários / público-alvo *(obrigatório)*

| Perfil | Quem é | O que precisa fazer no sistema |
|--------|--------|--------------------------------|
| `<preencher>` | `<preencher>` | `<preencher>` |

## 4. Principais funcionalidades *(obrigatório)*

Liste as funcionalidades em ordem de prioridade. Cada uma deve virar uma ou mais tarefas em `tasks/`.

1. `<preencher>`
2. `<preencher>`
3. `<preencher>`

## 5. Escopo *(obrigatório)*

### Dentro do escopo (versão atual)

- `<preencher>`

### Fora do escopo (explicitamente)

Agentes **não devem** implementar nada desta lista, mesmo que pareça útil.

- `<preencher>`

---

## 6. Stack resumida

Detalhes em [`architecture.md`](architecture.md) e [`development-guide.md`](development-guide.md).

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Linguagem | `<preencher>` | `<preencher>` |
| Framework | `<preencher>` | `<preencher>` |
| Banco de dados | `<preencher>` | `<preencher>` |
| Infra / deploy | `<preencher>` | `<preencher>` |

## 7. Integrações externas

| Sistema | Para quê | Tipo (API, fila, arquivo...) | Documentação |
|---------|----------|------------------------------|--------------|
| `<preencher>` | `<preencher>` | `<preencher>` | `<preencher>` |

## 8. Restrições

- Técnicas: `<preencher>` (ex.: precisa rodar em Windows; sem Docker em produção)
- De negócio: `<preencher>` (ex.: LGPD; prazo regulatório)
- De orçamento: `<preencher>` (ex.: apenas serviços gratuitos)

## 9. Glossário

Termos do domínio que os agentes devem usar exatamente como definidos aqui.

| Termo | Significado |
|-------|-------------|
| `<preencher>` | `<preencher>` |

## 10. Documentos relacionados

- Regras de negócio: [`business-rules.md`](business-rules.md)
- Requisitos: [`requirements/`](requirements/README.md)
- Decisões: [`decisions/`](decisions/README.md)
- Limitações conhecidas: [`known-gaps.md`](known-gaps.md)
