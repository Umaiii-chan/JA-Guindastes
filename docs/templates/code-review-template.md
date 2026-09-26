# Parecer de revisão — TASK-NNN

> Preenchido pelo Revisor (agente ou pessoa) **após** ler o diff completo e **executar** os
> comandos. Um parecer sem a seção 2 preenchida com saída real é inválido.
> Cole no PR (comentário de review) e/ou na tarefa § 10.

| Campo | Valor |
|-------|-------|
| **Data** | AAAA-MM-DD |
| **Revisor** | ferramenta/pessoa — **sessão diferente** da que implementou? sim/não |
| **Branch / PR** | `task/TASK-NNN-<slug>` @ `<hash>` / #NN |
| **Diff revisado** | `git diff development...task/TASK-NNN-<slug>` — N arquivos, +A −R |
| **Tempo de revisão** | ~N min |

---

## Resultado

**[ ] APROVADO** — pode ir para aprovação da pessoa responsável.
**[ ] MUDANÇAS NECESSÁRIAS** — lista objetiva na seção 4; volta para o Implementador.
**[ ] REJEITADO** — problema de fundo (escopo, abordagem, segurança); motivo na seção 4; reavaliar a tarefa.

Resumo em 2–3 linhas do que foi entregue e da qualidade geral.

---

## 1. Critérios de aceite

Para cada critério da tarefa: existe teste? o teste testa **o que o critério diz**? passa?

| Critério | Teste (arquivo::nome) | Testa o critério de fato? | Passa? | Observação |
|----------|-----------------------|---------------------------|--------|------------|
| CA-1 | `tests/...::deve_...` | sim / parcialmente / não | ✅/❌ | |
| CA-2 | | | | |
| CA-3 (nada quebrou) | suíte completa | — | ✅/❌ | |
| CA-4 (docs) | — | `docs/...` atualizado? | ✅/❌ | |

## 2. Verificação independente (executada pelo Revisor)

Não confie na saída colada pelo Implementador. Rode de novo.

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `<testes>` | ✅/❌ | |
| `<lint>` | ✅/❌ | |
| `<formatação>` | ✅/❌ | |
| `<tipos>` | ✅/❌/n.a. | |
| `<build>` | ✅/❌ | |
| `<auditoria de dependências>` | ✅/❌/n.a. | |
| `bash scripts/check-structure.sh` | ✅/❌ | |

Diferença em relação ao que o Implementador reportou no handoff: nenhuma / <descrever>

## 3. Checklist (`docs/checklists/code-review-checklist.md`)

Marque cada item. Itens com ❌ ou ⚠️ vão para a seção 4.

### Escopo e corretude
- [ ] Todo arquivo do diff está ligado à tarefa (ou justificado no handoff)
- [ ] Nenhuma funcionalidade além dos critérios de aceite
- [ ] Regras de negócio aplicadas correspondem a `RN-*` documentadas; nenhuma inventada
- [ ] Casos de borda óbvios tratados (vazio, nulo, limite, concorrência se aplicável)
- [ ] Erros tratados — nenhum `catch` vazio, nenhum erro engolido

### Testes
- [ ] Testes novos falhariam se a implementação estivesse errada (não são tautológicos)
- [ ] Nenhum teste `skip`/`ignore` sem justificativa
- [ ] Nenhum teste existente foi enfraquecido para passar
- [ ] Cobertura não caiu abaixo do mínimo

### Código
- [ ] Segue as convenções de `development-guide.md` § 5
- [ ] Respeita as regras de dependência de `architecture.md` § 3
- [ ] Sem duplicação evitável de algo que já existe no projeto
- [ ] Nomes claros; comentários explicam "por quê"
- [ ] Sem código morto, `TODO` sem tarefa, `console.log`/`print` de debug

### Segurança (`policies/security.md` § 8)
- [ ] Nenhum segredo, token ou dado pessoal real
- [ ] Entradas externas validadas
- [ ] Erros não vazam detalhes internos
- [ ] Dependências novas: existem, fixadas, justificadas, sem vulnerabilidade conhecida
- [ ] Nenhuma verificação de segurança desabilitada

### Documentação e processo
- [ ] `docs/` atualizado onde comportamento/comando/arquitetura mudou
- [ ] ADR criado se houve decisão relevante
- [ ] `.env.example` atualizado se há variável nova
- [ ] Handoff completo, com saída de comandos real
- [ ] Commits pequenos, mensagens no padrão, com ID da tarefa
- [ ] Nenhum commit com rodapé de co-autoria de IA (`Co-authored-by:` e equivalentes)
- [ ] PR aponta para a base certa e usa o método de merge correto (squash para branch curta)

## 4. Problemas encontrados

Ordenados por gravidade. Cada um com arquivo:linha, o que está errado, e o que fazer.

| # | Gravidade | Onde | Problema | Ação sugerida |
|---|-----------|------|----------|---------------|
| 1 | 🔴 bloqueante | `src/...:NN` | | |
| 2 | 🟡 importante | | | |
| 3 | 🟢 sugestão | | | |

- 🔴 **bloqueante**: errado, inseguro, fora do escopo, sem teste — não pode ser mesclado.
- 🟡 **importante**: deveria ser corrigido nesta tarefa; pode ser negociado com a pessoa responsável.
- 🟢 **sugestão**: melhoria opcional; se não for feita agora, vira item de backlog ou é descartada.

## 5. O que está bom

Diga o que foi bem feito. Ajuda o próximo agente a manter o padrão e ajuda a pessoa a calibrar
confiança na ferramenta.

- ...

## 6. Dúvidas para a pessoa responsável

Coisas que o Revisor não consegue decidir sozinho (regra de negócio ambígua, trade-off).

| # | Dúvida | Impacto se ignorada |
|---|--------|---------------------|
| 1 | | |

## 7. Evidência de leitura

Para provar que o diff foi lido inteiro (não só o resumo): cite dois trechos específicos do diff
que **não** aparecem no handoff do Implementador e comente-os.

1. `arquivo:linha` — ...
2. `arquivo:linha` — ...
