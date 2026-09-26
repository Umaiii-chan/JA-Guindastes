<!--
Preencha o tipo de PR abaixo. Se for PROMOÇÃO ou SINCRONIZAÇÃO, preencha apenas as seções 1 e 2 e
apague o resto. Se for TAREFA ou HOTFIX, preencha tudo — campo vazio = PR devolvido.
-->

## 1. Tipo de PR e método de merge

- [ ] **Tarefa** — `task/TASK-NNN-*` → `development` · merge por **SQUASH** · título: `TASK-NNN — <título>`
- [ ] **Hotfix** — `hotfix/*` → `production` · merge por **SQUASH** · lembrar de mesclar `production` de volta depois
- [ ] **Promoção** — `development` → `homologation` · merge por **MERGE COMMIT**
- [ ] **Promoção** — `homologation` → `production` · merge por **MERGE COMMIT**
- [ ] **Sincronização** — `production` → `homologation`/`development` · merge por **MERGE COMMIT**

> ⚠️ **Nunca use squash em PR entre duas branches longas.** Isso faz as branches divergirem para
> sempre e cria diferenças fantasma na promoção seguinte. Ver `docs/guides/git-github.md` § 3.

## 2. O que este PR faz

<!--
Tarefa/hotfix: 2 a 5 linhas, do ponto de vista de quem usa o sistema. Não descreva o "como".
Promoção: liste as tarefas incluídas, uma linha por TASK-NNN com link. Para produção, diga também
QUEM validou em homologação e QUANDO.
-->

---

<!-- ▼▼▼ Daqui para baixo, só para PR de TAREFA ou HOTFIX. Apague se for promoção. ▼▼▼ -->

## 3. Tarefa

- **Tarefa:** `tasks/in-progress/TASK-NNN-<slug>.md`
- **Handoff:** `handoffs/current.md` @ commit `<hash>`
- **Requisitos / regras de negócio:** RF-00X, RN-00Y

## 4. Critérios de aceite

<!-- Copie os critérios da tarefa e aponte o teste que cobre cada um. -->

| Critério | Teste | Status |
|----------|-------|--------|
| CA-1 — ... | `tests/...::...` | ✅ |
| CA-2 — ... | `tests/...::...` | ✅ |
| CA-3 — nenhum teste existente quebra | suíte completa | ✅ |

## 5. Fora do escopo (não está neste PR, de propósito)

- ...

## 6. Verificação local (saída real)

<!-- Cole o resumo do comando único de docs/development-guide.md § 3. Sem saída = PR devolvido. -->

```text
<saída>
```

## 7. Ferramentas de IA usadas

<!-- Registrado aqui e no handoff — nunca como Co-authored-by no commit. -->

| Papel | Ferramenta | Sessão independente? |
|-------|-----------|----------------------|
| Planejador | | |
| Engenheiro de testes | | |
| Implementador | | |
| Revisor | | sim (obrigatório) |

## 8. Revisão independente

- **Parecer:** link para o comentário no PR ou para a tarefa § 10
- **Resultado:** Aprovado / Mudanças necessárias (resolvidas)
- **Verificação executada pelo Revisor:** sim / não

## 9. Checklist (autor)

- [ ] Branch `task/TASK-NNN-*` criada a partir de `development` (ou `hotfix/*` a partir de `production`)
- [ ] Base do PR correta e método de merge correto (seção 1)
- [ ] Commits pequenos, Conventional Commits, com o ID da tarefa
- [ ] **Nenhum commit com rodapé de co-autoria de IA** (`git log development..HEAD | grep -i co-authored` vazio)
- [ ] Nenhum arquivo fora do escopo (ou justificado no handoff § 3)
- [ ] Nenhum segredo, token ou dado pessoal real
- [ ] `docs/` atualizado onde comportamento, comando, arquitetura ou variável de ambiente mudou
- [ ] `.env.example` atualizado se há variável nova
- [ ] ADR criado se houve decisão relevante
- [ ] `docs/known-gaps.md` atualizado se algo foi descoberto ou resolvido
- [ ] `docs/checklists/implementation-checklist.md` preenchido (na tarefa ou no handoff)
- [ ] `handoffs/current.md` atualizado com saídas reais e próximo passo
- [ ] CI verde

## 10. Checklist (pessoa responsável, antes do merge)

- [ ] `docs/checklists/definition-of-done.md` completo
- [ ] Li o parecer do Revisor e conferi os pontos marcados como atenção
- [ ] Método de merge conferido (squash aqui; merge commit em promoção)
- [ ] Após o merge: mover tarefa para `completed/`, arquivar handoff, apagar a branch curta
