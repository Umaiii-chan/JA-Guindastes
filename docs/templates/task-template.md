# TASK-NNN — <título curto, verbo no infinitivo>

| Campo | Valor |
|-------|-------|
| **Status** | backlog \| in-progress \| completed |
| **Prioridade** | alta \| média \| baixa |
| **Criada em** | AAAA-MM-DD por <pessoa> |
| **Iniciada em** | AAAA-MM-DD |
| **Concluída em** | AAAA-MM-DD |
| **Branch** | `task/TASK-NNN-<slug>` (a partir de `development`) |
| **PR** | #NN |
| **Requisitos** | RF-00X, RNF-00Y |
| **Regras de negócio** | RN-00X, RN-00Y |
| **Estimativa** | P \| M \| G (G = quebrar) |

---

## 1. Objetivo

Uma ou duas frases: o que deve existir/funcionar ao final que não existe/funciona hoje.
Do ponto de vista de quem usa, não de como implementar.

## 2. Contexto

Por que esta tarefa existe agora. Links para requisito, issue, conversa, ADR. O que já foi tentado.
O que o agente precisa saber que **não** está nos docs (se houver algo, considere mover para `docs/`).

## 3. Critérios de aceite

Cada item deve ser **verificável** — de preferência por um teste automatizado. Use o formato
*dado / quando / então*. Se um critério não pode virar teste, diga como será verificado manualmente.

- [ ] **CA-1** — Dado <contexto>, quando <ação>, então <resultado observável>.
- [ ] **CA-2** — Dado ..., quando ..., então ...
- [ ] **CA-3** — Nenhum teste existente quebra.
- [ ] **CA-4** — `docs/<arquivo>` atualizado com <o que muda>.

## 4. Escopo

### Dentro do escopo

- ...

### Fora do escopo (explicitamente — o agente NÃO faz)

- ...
- Se algo daqui parecer necessário, registrar em "Pendências" e parar, não implementar.

## 5. Arquivos provavelmente afetados

Preenchido pela pessoa (chute inicial) e refinado pelo Planejador (verificado).

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `src/...` | criar \| alterar \| remover | sim/não |

## 6. Riscos e dependências

- Depende de: TASK-XXX / decisão pendente P-00X / acesso a ...
- Risco: ... → mitigação: ...

## 7. Teste manual (se houver)

Passos exatos e resultado esperado, para o que não dá para automatizar.

1. ...
2. ...
   **Esperado:** ...

---

## 8. Plano (preenchido pelo Planejador)

Passos pequenos, cada um verificável. O Implementador segue na ordem e faz um commit por passo
(ou por grupo pequeno de passos).

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | | | | [ ] |
| 2 | | | | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: ...
- Regras de negócio aplicáveis: RN-...
- Decisões necessárias (→ ADR proposto ou pergunta): ...

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| deve ... quando ... | CA-1 | unitário | `tests/...` | vermelho / verde |

## 10. Parecer da revisão (preenchido pelo Revisor)

Link para o parecer (no PR ou colado aqui com `docs/templates/code-review-template.md`).

**Resultado:** Aprovado \| Mudanças necessárias \| Rejeitado — em AAAA-MM-DD por <ferramenta/pessoa>

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
