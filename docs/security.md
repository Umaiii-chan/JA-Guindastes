# Segurança — contexto do projeto

> **Status deste documento:** `<preencher>`. Este arquivo descreve a situação de segurança
> **deste projeto**. As regras universais que todo agente segue estão em
> [`policies/security.md`](policies/security.md) e não precisam ser repetidas aqui.

| Campo | Valor |
|-------|-------|
| Última revisão | `<AAAA-MM-DD>` |
| Responsável por segurança | `<preencher>` |

---

## 1. Dados tratados pelo sistema

Classifique para que os agentes saibam o que exige cuidado extra.

| Dado | Classificação | Onde é armazenado | Base legal / observação |
|------|---------------|-------------------|-------------------------|
| `<ex.: e-mail do usuário>` | pessoal | `<tabela/serviço>` | LGPD — `<finalidade>` |
| `<ex.: CPF>` | pessoal sensível | `<preencher>` | criptografado em repouso? |
| `<ex.: logs de acesso>` | interno | `<preencher>` | retenção de `<N>` dias |

Regra para agentes: dados classificados como **pessoal** ou **sensível** nunca aparecem em logs,
mensagens de erro, fixtures de teste ou documentação.

---

## 2. Autenticação e autorização

| Aspecto | Como funciona neste projeto | Onde está no código |
|---------|-----------------------------|---------------------|
| Autenticação | `<ex.: JWT emitido por...>` | `src/...` |
| Autorização | `<ex.: RBAC com papéis X, Y, Z>` | `src/...` |
| Sessão | `<preencher>` | `src/...` |
| Senhas | `<ex.: hash com bcrypt/argon2, nunca em texto plano>` | `src/...` |

---

## 3. Segredos e configuração

| Segredo | Local | CI | development | homologation | production | Rotação |
|---------|-------|----|-------------|--------------|------------|---------|
| `<ex.: DATABASE_URL>` | `.env` | variável do workflow | Environment `development` | Environment `homologation` | Environment `production` | `<periodicidade>` |

Os *secrets* de cada ambiente ficam no GitHub Environment de mesmo nome da branch. O mesmo nome de
variável nos três, com valores diferentes — assim o workflow não precisa saber em qual ambiente está.
Ver [`guides/git-github.md`](guides/git-github.md) § 8.3.

**Nunca** no repositório. `.env.example` lista os nomes, sem valores.

---

## 4. Superfície de ataque conhecida

| Entrada | Validação existente | Riscos considerados |
|---------|---------------------|---------------------|
| `<ex.: formulário de login>` | `<preencher>` | força bruta, injeção |
| `<ex.: upload de arquivo>` | `<preencher>` | tipo/tamanho, path traversal |
| `<ex.: webhook externo>` | `<preencher>` | assinatura, replay |

---

## 5. Dependências

- Ferramenta de auditoria: `<ex.: npm audit | pip-audit | govulncheck>` — comando: `<preencher>`
- Roda no CI? `<sim/não>` (recomendado: sim, ver `.github/workflows/ci.yml`)
- Dependabot habilitado? `<sim/não>` (gratuito no GitHub; recomendado)

---

## 6. Checklist de segurança por tarefa

O revisor verifica (também está em [`checklists/code-review-checklist.md`](checklists/code-review-checklist.md)):

- [ ] nenhuma credencial, token ou dado pessoal real no diff;
- [ ] entradas externas validadas antes do uso;
- [ ] erros não vazam detalhes internos (stack trace, SQL, caminhos);
- [ ] dependências novas justificadas no handoff e sem vulnerabilidade conhecida;
- [ ] autorização verificada em toda operação nova que toca dado de usuário.

---

## 7. Incidentes e reporte

`<preencher>` — Como reportar uma vulnerabilidade encontrada (e-mail, issue privada...).
