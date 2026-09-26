# Checklist de code review

Para o **Revisor** — que deve ser uma sessão/ferramenta **diferente** da que implementou. Use com
`docs/templates/code-review-template.md`. A postura correta é: *"assuma que há um erro; encontre-o"*.

## 0. Antes de olhar o código

- [ ] Li `AGENTS.md`, `handoffs/current.md` e a tarefa (objetivo, critérios, escopo, plano, cenários)
- [ ] Li o handoff do Implementador **inteiro**, especialmente § 7 (não feito) e § 11 (como revisar)
- [ ] Obtive o diff completo: `git diff development...task/TASK-NNN-<slug>` — não só o `--stat`
- [ ] Confirmei que sou uma sessão diferente da que implementou (registro isso no parecer)

## 1. Verificação independente (obrigatória)

- [ ] Fiz checkout da branch e rodei **eu mesmo**: testes, lint, formatação, tipos, build, `check-structure.sh`
- [ ] Comparei minha saída com a do handoff; diferenças registradas
- [ ] Se não consegui executar algo, marquei como NÃO VERIFICADO no parecer — não presumi

## 2. Escopo

- [ ] Todo arquivo do diff está ligado à tarefa ou justificado no handoff
- [ ] Nenhuma funcionalidade além dos critérios de aceite
- [ ] Nada do "Fora do escopo" da tarefa foi implementado
- [ ] Mudanças em arquivos protegidos (`development-guide.md` § 8) têm autorização registrada

## 3. Critérios de aceite

- [ ] Cada critério tem pelo menos um teste (ou teste manual executado e descrito)
- [ ] Li cada teste e confirmei que ele testa **o que o critério diz**, não algo parecido
- [ ] Testes falhariam se a implementação estivesse errada (não são tautológicos: `expect(x).toBe(x)`)
- [ ] Casos de borda cobertos: vazio, nulo, limite, duplicado, concorrente (quando aplicável)

## 4. Regras de negócio

- [ ] Toda regra aplicada no código corresponde a uma `RN-*` em `docs/business-rules.md`
- [ ] Nenhuma regra foi inventada ou deduzida — se encontrei uma, é 🔴 bloqueante
- [ ] Regras referenciadas na tarefa foram todas aplicadas

## 5. Corretude

- [ ] Li a lógica principal linha a linha (não só o diff colorido)
- [ ] Erros tratados; nenhum `catch`/`except` vazio ou que só loga e segue
- [ ] Nenhuma condição invertida, off-by-one, comparação de tipo errada
- [ ] Recursos abertos são fechados (arquivos, conexões, transações)
- [ ] Sem condições de corrida óbvias em código concorrente
- [ ] Comportamento em falha de dependência externa está definido

## 6. Testes (qualidade dos testes em si)

- [ ] Nenhum teste `skip`/`ignore`/`only` sem justificativa
- [ ] Nenhum teste existente foi alterado para passar (se foi, a justificativa convence)
- [ ] Testes não dependem de ordem, rede real, horário do sistema ou aleatoriedade sem seed
- [ ] Nomes de teste descrevem comportamento
- [ ] Cobertura não caiu abaixo do mínimo

## 7. Código

- [ ] Convenções de `development-guide.md` § 5 seguidas
- [ ] Direção de dependências de `architecture.md` § 3 respeitada
- [ ] Sem duplicação de algo que já existe (procurei)
- [ ] Sem código morto, comentado, `TODO` sem tarefa, logs de debug
- [ ] Complexidade proporcional ao problema — nada de abstração para um caso só
- [ ] Nomes claros

## 8. Segurança (`docs/policies/security.md` § 8)

- [ ] Nenhum segredo, token, chave ou dado pessoal real no diff (`grep` no diff)
- [ ] Entradas externas validadas antes do uso
- [ ] Sem SQL/comando/caminho/HTML montado por concatenação com entrada externa
- [ ] Erros voltados ao usuário não vazam stack, SQL, caminhos
- [ ] Dependências novas: existem no registro oficial (nome exato), fixadas, justificadas, sem CVE conhecida
- [ ] Nenhuma verificação de segurança desabilitada (CORS `*`, TLS off, `eval`, `--no-verify`...)
- [ ] Autorização verificada em operações novas sobre dados de usuário

## 9. Documentação e processo

- [ ] `docs/` atualizado onde comportamento, comando, arquitetura ou env var mudou
- [ ] ADR criado para decisão relevante (e está como `Proposto`, não `Aceito`, se foi agente)
- [ ] `.env.example` atualizado se há variável nova
- [ ] `known-gaps.md` atualizado se algo foi descoberto ou resolvido
- [ ] Commits pequenos, mensagens no padrão, com ID da tarefa
- [ ] Nenhum commit com rodapé de co-autoria de IA (`Co-authored-by:`, `Assisted-by:` e equivalentes)
- [ ] PR aponta para a base certa (`development` para tarefa; `production` para hotfix)
- [ ] Método de merge correto: squash para branch curta; merge commit entre branches longas
- [ ] Template do PR preenchido por completo

## 10. Handoff do Implementador

- [ ] Saídas de comando são reais (não "todos os testes passaram" sem números)
- [ ] § 7 (não feito) é consistente com o que vi no diff
- [ ] Nada que vi no diff está omitido do handoff

## 11. Fechar o parecer

- [ ] Resultado escolhido: Aprovado / Mudanças necessárias / Rejeitado
- [ ] Problemas listados com arquivo:linha, gravidade e ação sugerida
- [ ] "O que está bom" preenchido
- [ ] Evidência de leitura: dois trechos do diff que **não** estão no handoff, comentados
- [ ] `handoffs/current.md` atualizado: próximo passo = Implementador (correções) ou Pessoa (aprovação)
- [ ] Commit: `chore(handoff): revisão TASK-NNN — <resultado>`

## Sinais de alerta (pare e olhe com mais atenção)

- Diff grande demais para a tarefa descrita
- Implementador "corrigiu" um teste existente
- Nova dependência para algo que a linguagem/stdlib já faz
- `any`, `unknown`, `Object`, `dynamic`, `# type: ignore`, `// eslint-disable` novos
- Handoff diz "deve funcionar" ou "provavelmente"
- Arquivo de configuração de CI/lint alterado
- PR de promoção configurado para squash (quebra a cascata entre ambientes)
- Regra de negócio implementada sem `RN-*` citada
