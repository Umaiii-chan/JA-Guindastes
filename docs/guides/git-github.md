# Guia de Git e GitHub (plano gratuito)

Regras de versionamento para pessoas e agentes. O objetivo é que o histórico do Git seja, por si só,
uma narrativa legível do que aconteceu no projeto — e que `git log production` responda, sem
ambiguidade, o que está no ar.

Modelo de branches definido em [ADR-002](../decisions/ADR-002-modelo-de-branches-por-ambiente.md).

---

## 1. Modelo de branches

Três branches **longas e permanentes**, uma por ambiente, e branches **curtas** de trabalho.

```text
production   ───────●───────────────────────────●────────────►  o que está no ar
                    ▲                           ▲
                    │ PR de promoção            │ PR de promoção
                    │                           │
homologation ─────●─┴───────────●───────────────┴────────────►  validação de QA / cliente
                  ▲             ▲
                  │ PR de promoção
                  │             │
development  ──●──┴──●───●───●──┴───●───●───●────────────────►  integração contínua (DEFAULT)
               ▲     ▲   ▲   ▲      ▲   ▲   ▲
               │ PRs de tarefa (squash)
               │
task/TASK-001 ─┘   task/TASK-002 ─┘   task/TASK-003 ─┘
```

| Branch | Ambiente | Quem escreve nela | Como recebe código | Apagada? |
|--------|----------|-------------------|--------------------|----------|
| `development` | desenvolvimento | ninguém direto | PR de `task/*` (squash) e PR de sincronização | nunca |
| `homologation` | homologação | ninguém direto | PR de promoção vindo de `development` (merge commit) | nunca |
| `production` | produção | ninguém direto | PR de promoção vindo de `homologation` (merge commit) e PR de `hotfix/*` | nunca |
| `task/<TASK-ID>-<slug>` | — | o agente/pessoa da tarefa | commits diretos | sim, após o merge |
| `hotfix/<slug>` | — | quem corrige | commits diretos | sim, após o merge |

**Não existe branch `main` neste modelo.** A branch default do repositório é `development` — é ela que
o `git clone` traz, é para ela que os PRs de tarefa apontam por padrão e é contra ela que o Revisor
compara o diff.

Convenções de nome:

- `task/TASK-012-login-por-email` — minúsculas, hífens, slug curto, ID da tarefa. O
  `scripts/check-structure.sh` valida.
- `hotfix/corrigir-calculo-de-juros` — minúsculas, hífens, descreve o problema.
- Sem `release/*`, sem `feature/*`, sem `develop`. Se o projeto precisar, é um novo ADR.

---

## 2. Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/pt-br/), com o ID da tarefa:

```text
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final> (TASK-NNN)

# quando a tarefa/handoff é o próprio assunto, o ID entra na descrição:
chore(tasks): iniciar TASK-NNN

[corpo opcional: o quê e por quê, não como]

[rodapé opcional: BREAKING CHANGE, Refs, Co-authored-by]
```

| Tipo | Quando |
|------|--------|
| `feat` | funcionalidade nova visível |
| `fix` | correção de bug |
| `test` | só testes |
| `refactor` | mudança de código sem mudar comportamento |
| `docs` | só documentação |
| `chore` | tarefas, handoffs, configuração, dependências |
| `ci` | workflows do GitHub Actions |
| `perf` | melhoria de desempenho |
| `build` | sistema de build, dependências de build |

Exemplos:

```text
feat(auth): adicionar login por e-mail (TASK-012)
test(auth): cenários de validação de e-mail (TASK-012)
docs(architecture): registrar fluxo de autenticação (TASK-012)
chore(handoff): implementação concluída, próximo passo revisão (TASK-012)
```

Regras:

- Commits **pequenos e atômicos**: um commit, uma intenção. Se a mensagem precisa de "e", são dois commits.
- Nunca commitar código que não compila ou testes que não rodam (exceto commits de teste `test:` na
  etapa do Engenheiro de testes, onde os testes falham de propósito — diga isso no corpo).

### ⚠️ Nenhum commit leva co-autoria de IA

**Commits gerados por agentes não devem conter rodapé `Co-authored-by:` (nem `Signed-off-by:`,
`Assisted-by:` ou equivalente) apontando para Claude, ChatGPT/Codex, Copilot, Gemini, Cursor ou
qualquer outra ferramenta.** Muitas ferramentas fazem isso por padrão — desligue essa opção ou
remova o rodapé antes de commitar.

Por quê:

- **Autoria é responsabilidade.** Quem responde pelo commit é a pessoa que acionou o agente, revisou
  e aprovou. Uma IA não pode responder por nada, então não assina.
- **A informação já existe, no lugar certo.** Qual ferramenta fez qual etapa está em
  `handoffs/current.md` e no histórico em `handoffs/history/` — com muito mais contexto do que um
  rodapé caberia. Repetir no commit é ruído duplicado que envelhece mal.
- **O `git log` fica legível.** O histórico responde "o que mudou e por quê", não "com qual
  ferramenta foi digitado".
- **Métricas não se corrompem.** Contribuidores, `git shortlog` e estatísticas do GitHub continuam
  refletindo pessoas.

O `scripts/check-structure.sh` § 8 verifica isso automaticamente nos commits da sua branch e falha
se encontrar um rodapé de IA.

Como desligar nas ferramentas mais comuns (confirme na documentação de cada uma, muda com o tempo):

| Ferramenta | Onde desligar |
|------------|---------------|
| Claude Code | instrução explícita no prompt/`CLAUDE.md`, ou remover o rodapé antes do commit |
| Codex / Cursor / Windsurf | configuração de commit da ferramenta, ou instrução no prompt |
| GitHub Copilot | não adiciona rodapé por padrão em commits locais |
| Qualquer uma | `git commit --amend` para remover, antes do push |

Se um rodapé escapar e o commit ainda **não** tiver sido enviado:

```bash
git commit --amend                       # remove o rodapé do último commit
git rebase -i development                # para vários commits: 'reword' em cada um
```

---

## 3. Os quatro tipos de Pull Request

Todo código entra nas branches longas por PR. Existem quatro tipos, e **o método de merge muda por tipo**:

| Tipo | De → Para | Método de merge | Quem aprova | Template |
|------|-----------|-----------------|-------------|----------|
| **Tarefa** | `task/TASK-NNN-*` → `development` | **Squash** | pessoa responsável, após revisão independente | completo |
| **Promoção** | `development` → `homologation` | **Merge commit** | pessoa responsável | reduzido (§ 5) |
| **Promoção** | `homologation` → `production` | **Merge commit** | pessoa responsável | reduzido (§ 5) |
| **Hotfix** | `hotfix/*` → `production` | **Squash** | pessoa responsável | completo |
| **Sincronização** | `production` → `homologation` → `development` | **Merge commit** | pessoa responsável | reduzido |

> ### ⚠️ Nunca use *squash* em PR de promoção ou sincronização
>
> É o erro que mais quebra este modelo, e ele é silencioso.
>
> O *squash* cria um commit **novo**, com hash diferente dos originais. Quando você faz squash de
> `development` em `homologation`, o Git passa a enxergar as duas branches como tendo históricos
> diferentes, mesmo que o conteúdo seja idêntico. Na promoção seguinte, o PR mostra **de novo** todas
> as mudanças que já subiram — as "diferenças fantasma" — e `git diff production...homologation`
> deixa de significar "o que falta subir".
>
> Depois que isso acontece, as branches só voltam a convergir com um merge manual resolvendo
> conflitos inventados, ou resetando uma branch sobre a outra. É caro e assusta.
>
> **Regra:** PR entre duas branches longas → sempre *Create a merge commit*.
> PR de uma branch curta (`task/*`, `hotfix/*`) → *Squash and merge*.

No GitHub, deixe os dois métodos habilitados em *Settings → General → Pull Requests*
(☑ Allow merge commits, ☑ Allow squash merging) e desmarque ☐ Allow rebase merging — *rebase* em
branch longa reescreve o histórico e tem o mesmo problema do squash, agravado.

### Regras gerais de PR

1. Um PR de tarefa por tarefa. Título: `TASK-012 — Login por e-mail`.
2. O template em `.github/pull_request_template.md` é preenchido **por completo** em PRs de tarefa e
   hotfix. Campos vazios = PR devolvido.
3. O PR linka a tarefa (`tasks/in-progress/TASK-012-*.md`) e o handoff.
4. O CI precisa estar verde antes da revisão humana.
5. Revisão independente registrada (parecer do Revisor, no PR ou na tarefa).
6. Apagar a branch curta após o merge. **Nunca apagar** `development`, `homologation` ou `production`.

**Tamanho:** um PR de tarefa que leva mais de 15–20 minutos para revisar com atenção é grande demais.
Quebre a tarefa. (PRs de promoção são naturalmente grandes — eles agregam várias tarefas já revisadas
individualmente; o que se revisa neles é o conjunto, não cada linha.)

---

## 4. O ciclo de uma tarefa

```bash
# 1. começar: sempre a partir de development atualizada
git checkout development && git pull
git checkout -b task/TASK-012-login-por-email
git mv tasks/backlog/TASK-012-login-por-email.md tasks/in-progress/
# editar handoffs/current.md
git add -A && git commit -m "chore(tasks): iniciar TASK-012"

# 2. durante o trabalho (repetir muitas vezes)
git add <arquivos específicos>          # evite git add . sem olhar o que está entrando
git status                              # confira: nada fora do escopo? nenhum .env?
git commit -m "feat(auth): ... (TASK-012)"

# 3. antes de abrir o PR
<comando único de docs/development-guide.md § 3>
git fetch origin && git rebase origin/development   # rebase é permitido AQUI: branch só sua
git push -u origin task/TASK-012-login-por-email

# 4. o Revisor compara contra development
git diff development...task/TASK-012-login-por-email --stat
git diff development...task/TASK-012-login-por-email

# 5. abrir o PR no GitHub com base = development, merge por SQUASH

# 6. depois do merge
git checkout development && git pull
git branch -d task/TASK-012-login-por-email
```

`git rebase` só é permitido em branch curta que ninguém mais está usando, antes do primeiro PR.
Depois que outra pessoa ou agente já leu a branch, use `merge`.

---

## 5. Promoção entre ambientes

Promover não é uma etapa da tarefa: as tarefas caem continuamente em `development`, e a promoção
acontece **em lote, numa cadência que você decide** (ao fim do dia, duas vezes por semana, quando um
conjunto de tarefas fecha uma funcionalidade). Ver [`workflow.md`](workflow.md) § 13.

### development → homologation

```bash
# o que vai subir
git fetch origin
git log --oneline origin/homologation..origin/development
git diff origin/homologation...origin/development --stat
```

Abra o PR no GitHub com **base `homologation`**, **compare `development`**. Título:
`Promoção para homologação — AAAA-MM-DD`. No corpo, liste as tarefas incluídas (uma linha por
`TASK-NNN`, com link). Merge por **merge commit**.

Antes de abrir:

- [ ] CI verde na `development`
- [ ] todas as tarefas incluídas estão em `tasks/completed/`
- [ ] nenhuma tarefa em `tasks/in-progress/` depende de algo que ficou pela metade
- [ ] migrations, se houver, são compatíveis com os dados de homologação

### homologation → production

Mesmo procedimento, base `production`, compare `homologation`. Título:
`Promoção para produção — AAAA-MM-DD`. Merge por **merge commit**.

Antes de abrir:

- [ ] o que está em homologação foi validado por quem valida (QA, cliente, você) — diga **quem** e **quando** no corpo do PR
- [ ] `docs/known-gaps.md` não lista nenhum problema bloqueante aberto para o que vai subir
- [ ] plano de rollback conhecido (qual commit voltar, como reverter migration)
- [ ] janela de deploy combinada, se o projeto tiver uma

Depois do merge, marque o ponto no histórico:

```bash
git checkout production && git pull
git tag -a v2026.09.05 -m "Promoção de <TASK-012, TASK-013, TASK-015>"
git push origin v2026.09.05
```

A tag é opcional, mas é o que transforma "o que estava no ar em tal dia?" numa pergunta de um comando.

---

## 6. Hotfix (correção urgente em produção)

Use **apenas** quando a correção não pode esperar o ciclo normal. Um hotfix pula a validação de
homologação — esse é o custo, e por isso ele é exceção.

```bash
# 1. sair de production, não de development
git checkout production && git pull
git checkout -b hotfix/corrigir-calculo-de-juros

# 2. corrigir, COM TESTE que reproduz o bug
git commit -m "fix(faturamento): corrigir arredondamento no cálculo de juros (HOTFIX)"

# 3. PR com base = production, squash, revisão independente mesmo com pressa
git push -u origin hotfix/corrigir-calculo-de-juros

# 4. DEPOIS DO MERGE: devolver a correção para as branches de baixo, senão ela
#    some na próxima promoção
git checkout homologation && git pull && git merge production && git push
git checkout development  && git pull && git merge production && git push
```

O passo 4 é o que as pessoas esquecem. Sem ele, a próxima promoção `homologation → production`
**reverte a correção**, porque `homologation` ainda tem o código antigo.

Registre todo hotfix como tarefa em `tasks/completed/` depois do fato, com o que aconteceu e por que
não passou por homologação. Se hotfix virar rotina, o problema não é o hotfix — é a cobertura de testes.

---

## 7. Issues (opcional)

Tarefas vivem em `tasks/`. GitHub Issues é opcional e serve para:

- receber pedidos de fora (bugs, ideias) antes de virarem tarefa;
- discussão assíncrona;
- linkar com PR (`Closes #12`).

Se usar issues, o template em `.github/ISSUE_TEMPLATE/task.md` tem os mesmos campos da tarefa.
A **fonte de verdade continua sendo `tasks/`** — a issue é um espelho.

---

## 8. Configurar o repositório no GitHub gratuito

### 8.1 Criar as branches

```bash
# a partir de um repositório recém-criado (ou renomeando a main existente)
git branch -m main production        # se veio de um repositório com main
git push -u origin production
git push origin --delete main        # só depois de mudar o default no GitHub

git checkout -b homologation production && git push -u origin homologation
git checkout -b development homologation && git push -u origin development
```

Em *Settings → General → Default branch*, defina **`development`** como default.

### 8.2 O que dá para proteger sem pagar

Na data de criação deste template (confirme na documentação do GitHub — muda com o tempo):

| Recurso | Repositório público | Repositório privado (Free) |
|---------|--------------------|-----------------------------|
| Branch protection rules (exigir PR, exigir CI verde) | sim | **não** (recurso pago) |
| Rulesets | sim | não (recurso pago) |
| GitHub Actions | 2.000 min/mês grátis (ilimitado em públicos) | 2.000 min/mês |
| Environments | sim | **limitado** (secrets e regras de proteção exigem plano pago) |
| Required reviewers em Environment | sim | não (recurso pago) |
| Dependabot | sim | sim |
| Code scanning (CodeQL) | sim | não |
| Secret scanning | sim | parcial |

**Se o repositório for público**, configure em *Settings → Branches → Add rule*, uma regra para cada
uma das três branches (`development`, `homologation`, `production`):

- ☑ Require a pull request before merging
- ☑ Require status checks to pass before merging → selecione os checks *Estrutura do workflow* e
  *Lint, testes e build* (jobs `structure` e `quality` do `ci.yml`; o GitHub lista pelo `name`)
- ☑ Require conversation resolution before merging
- ☑ Do not allow bypassing the above settings — marque pelo menos em `production`

**Se o repositório for privado no plano gratuito**, a proteção de branch não está disponível. A
disciplina substitui a ferramenta:

- `AGENTS.md` § 6 proíbe agentes de commitar nas três branches longas;
- `scripts/check-structure.sh` § 7 avisa quando há alteração não commitada em uma delas;
- a pessoa responsável só faz merge por PR, mesmo podendo pular;
- o CI roda em todo push das três branches, então um deslize aparece na hora;
- alternativa: tornar o repositório **público** (se o projeto permitir) para ganhar as proteções.

### 8.3 Environments

Em *Settings → Environments*, crie `development`, `homologation` e `production`. Em cada um:

- **Environment secrets**: as credenciais daquele ambiente (o mesmo nome de variável em todos os três,
  com valores diferentes). O `ci.yml` seleciona o ambiente pelo nome da branch, então
  `${{ secrets.DATABASE_URL }}` resolve sozinho para o valor certo.
- **Required reviewers** em `production`: transforma o deploy automático em deploy com aprovação
  humana, sem mudar o workflow. Recomendado.
- **Deployment branches**: restrinja cada Environment à sua branch (`production` só aceita deploy
  vindo de `production`).

**Se Environments não estiverem disponíveis** (repositório privado no plano gratuito), o `ci.yml`
tem um caminho alternativo comentado: use *repository secrets* com prefixo por ambiente
(`DEV_DATABASE_URL`, `HOM_DATABASE_URL`, `PROD_DATABASE_URL`) e selecione o prefixo no workflow.
Você perde a aprovação humana antes do deploy — nesse caso, prefira a opção de deploy manual.

---

## 9. GitHub Actions — o que roda e o que não roda

O workflow `.github/workflows/ci.yml`:

- roda em `pull_request` (qualquer base) e em `push` para `development`, `homologation` e `production`;
- os jobs `structure` e `quality` executam **apenas verificações determinísticas**: instalação, lint,
  formatação, tipos, testes, build, auditoria de dependências e `scripts/check-structure.sh`;
- o job `deploy` só roda em `push` numa das três branches, depois das verificações passarem, e usa o
  GitHub Environment de mesmo nome da branch;
- **não chama nenhuma IA** — nenhuma verificação depende de chave de API de modelo.

Para economizar minutos gratuitos:

- use cache de dependências (o `ci.yml` tem exemplos);
- `concurrency` cancela execuções antigas do mesmo PR/branch;
- não rode e2e pesados em todo push — só nos PRs de promoção, ou manualmente.

---

## 10. O que nunca fazer

- Commitar direto em `development`, `homologation` ou `production`.
- Assinar commits com `Co-authored-by:` de uma ferramenta de IA (ver § 2).
- *Squash* ou *rebase* em PR entre duas branches longas (ver § 3).
- `git push --force` em qualquer das três branches longas, ou em branch que outra pessoa/agente esteja usando.
- Apagar `development`, `homologation` ou `production`.
- Fazer um hotfix e esquecer de mesclar `production` de volta em `homologation` e `development`.
- Promover direto `development` → `production`, pulando homologação (a menos que seja hotfix, e aí
  a branch é `hotfix/*` saindo de `production`).
- `git add .` sem `git status` antes.
- Commitar `.env`, `node_modules/`, `.venv/`, dumps, binários grandes.
- Apagar ou reescrever `handoffs/history/` e `tasks/completed/`.
- Resolver conflito "aceitando tudo de um lado" sem ler.
- Desligar o CI (ou marcar `continue-on-error`) para fazer o PR passar.
- Mesclar PR com CI vermelho.

---

## 11. Para agentes: resumo em 7 linhas

1. Você trabalha **sempre** em `task/<TASK-ID>-<slug>`, criada a partir de `development` atualizada.
2. Você **nunca** commita, mescla ou faz push em `development`, `homologation` ou `production`.
3. Promoção entre ambientes e hotfix são decisão da pessoa responsável — você não inicia nem executa,
   a menos que ela peça explicitamente.
4. Commits pequenos, Conventional Commits, sempre com o ID da tarefa e **sem rodapé de co-autoria de IA**.
5. `git status` antes de todo `git add`. Nada fora do escopo, nenhum segredo.
6. O diff que importa para revisão é `git diff development...task/<TASK-ID>-<slug>`.
7. Antes de dizer "pronto para PR", rode o comando único de `development-guide.md` § 3 e cole a saída
   no handoff.
