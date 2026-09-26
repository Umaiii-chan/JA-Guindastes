# Checklist de implementação

Para o **Implementador**, antes de declarar a etapa concluída e escrever o handoff. Copie para a
tarefa ou para o handoff e marque item a item. Item não marcado precisa de justificativa.

## Antes de começar

- [ ] Li `AGENTS.md`, `handoffs/current.md`, a tarefa completa (incluindo Plano e Cenários) e os docs da ordem obrigatória
- [ ] Inspecionei os arquivos listados no plano **e confirmei que existem** (`ls`, `grep`)
- [ ] Li as `RN-*` referenciadas na tarefa em `docs/business-rules.md`
- [ ] Rodei a suíte de testes **antes** de mudar qualquer coisa e anotei o estado inicial (quantos passam/falham)
- [ ] Estou na branch certa (`git branch --show-current` = `task/TASK-NNN-...`), criada a partir de `development` atualizada
- [ ] Não há dúvida bloqueante em "Pendências" sem resposta — se há, parei e registrei

## Durante

- [ ] Sigo o plano na ordem; se precisei desviar, registrei o motivo
- [ ] Um commit por passo (ou grupo pequeno), com mensagem no padrão e ID da tarefa
- [ ] Nenhum commit com rodapé `Co-authored-by:` de ferramenta de IA (`git log development..HEAD | grep -i "co-authored"` deve vir vazio)
- [ ] `git status` antes de cada `git add`; nenhum arquivo fora do escopo entrou sem justificativa
- [ ] Testes rodados a cada passo relevante, não só no final
- [ ] Nenhuma funcionalidade extra — o que pareceu útil foi para `tasks/backlog/` com uma linha de descrição
- [ ] Nenhuma regra de negócio deduzida — o que não estava em `RN-*` virou pergunta em "Pendências"
- [ ] Nenhuma dependência nova sem: verificar que existe, versão fixada, motivo no handoff, ADR se relevante
- [ ] Nenhum teste existente apagado, comentado ou enfraquecido para passar

## Código

- [ ] Segue as convenções de `docs/development-guide.md` § 5
- [ ] Respeita a direção de dependências de `docs/architecture.md` § 3
- [ ] Erros tratados explicitamente; nenhum `catch`/`except` vazio
- [ ] Entradas externas validadas (tipo, tamanho, formato)
- [ ] Sem `console.log`/`print`/`debugger` de depuração
- [ ] Sem `TODO`/`FIXME` sem tarefa correspondente no backlog
- [ ] Nomes descritivos; comentários só onde explicam "por quê"
- [ ] Nada duplicado que já exista no projeto (procurei com `grep` antes de criar)

## Testes

- [ ] Todo critério de aceite tem teste passando (ou teste manual executado e descrito)
- [ ] Os testes do Engenheiro de testes que estavam vermelhos agora estão verdes — **sem alterá-los** (se alterei, justifiquei)
- [ ] Suíte completa passa; saída colada no handoff
- [ ] Cobertura não caiu abaixo do mínimo de `docs/testing-strategy.md` § 3

## Qualidade

- [ ] Lint passa (saída no handoff)
- [ ] Formatação passa (saída no handoff)
- [ ] Verificação de tipos passa, se aplicável (saída no handoff)
- [ ] Build passa (saída no handoff)
- [ ] `bash scripts/check-structure.sh` passa
- [ ] Rodei o **comando único** de `development-guide.md` § 3 por último, tudo junto, e passou

## Segurança

- [ ] `git diff development...HEAD | grep -iE "password|secret|token|api[_-]?key|BEGIN (RSA|PRIVATE)"` — nada real
- [ ] Nenhum dado pessoal real em código, teste, fixture ou doc
- [ ] Mensagens de erro para o usuário não expõem internals
- [ ] Nenhuma verificação de segurança desabilitada

## Documentação

- [ ] `docs/` atualizado onde comportamento, comando, arquitetura ou variável de ambiente mudou
- [ ] `.env.example` atualizado se há variável nova
- [ ] ADR `Proposto` criado se houve decisão técnica relevante; índice atualizado
- [ ] `docs/known-gaps.md` atualizado se descobri limitação ou resolvi alguma

## Handoff

- [ ] `handoffs/current.md` reescrito com `docs/templates/handoff-template.md`
- [ ] Seção 3 (arquivos) tem saída real de `git diff --stat`
- [ ] Seção 4 (comandos) tem saída real; o que não rodou está como NÃO EXECUTADO
- [ ] Seção 7 (o que não foi feito) preenchida com honestidade
- [ ] Seção 10 (próximo passo) = Revisor, com "ler primeiro" e "cuidado com"
- [ ] Seção 11 (como revisar) preenchida — apontei onde tenho menos certeza
- [ ] Commit do handoff: `chore(handoff): implementação TASK-NNN concluída, próximo passo revisão`
