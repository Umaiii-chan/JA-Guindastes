# Guia de desenvolvimento

> **Status deste documento:** `<preencher>`. Os comandos listados aqui são os **únicos** que os
> agentes devem executar. Se um comando não está aqui, o agente pergunta antes de rodar.
> Mantenha este documento sincronizado com o CI (`.github/workflows/ci.yml`): os dois devem rodar
> os mesmos comandos.

| Campo | Valor |
|-------|-------|
| Última revisão | `<AAAA-MM-DD>` |
| Stack | `<linguagem> <versão>` / `<framework>` / `<banco>` |

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar / verificar |
|------------|--------|---------------------------|
| `<ex.: Node.js>` | `<ex.: 22.x>` | `node --version` |
| `<ex.: gerenciador de pacotes>` | `<versão>` | `<comando>` |
| Git | 2.x | `git --version` |

---

## 2. Instalação

```bash
# clonar
git clone <url-do-repositorio>
cd <nome-do-projeto>

# instalar dependências
<preencher>          # ex.: npm ci | uv sync | go mod download | dotnet restore

# configurar ambiente
cp .env.example .env
# edite .env com valores locais (nunca commitar)
```

---

## 3. Comandos do dia a dia

**Estes comandos são a referência oficial.** O CI e os agentes usam exatamente estes.

| Ação | Comando | Observações |
|------|---------|-------------|
| Rodar em desenvolvimento | `<preencher>` | |
| Rodar testes | `<preencher>` | ver [`testing-strategy.md`](testing-strategy.md) |
| Rodar um teste específico | `<preencher>` | |
| Lint | `<preencher>` | |
| Formatação (verificar) | `<preencher>` | |
| Formatação (corrigir) | `<preencher>` | |
| Verificação de tipos | `<preencher>` | se aplicável |
| Build | `<preencher>` | |
| Migrations (criar) | `<preencher>` | se aplicável |
| Migrations (aplicar) | `<preencher>` | se aplicável |
| Auditoria de dependências | `<preencher>` | ex.: `npm audit`, `pip-audit`, `govulncheck` — ver [`security.md`](security.md) § 5 |
| Validar estrutura do repo | `bash scripts/check-structure.sh` | universal, já funciona |

Comando único que roda tudo antes de abrir PR (crie um script/alias e documente aqui):

```bash
<preencher>   # ex.: npm run check  →  lint + format:check + typecheck + test + build
```

---

## 4. Estrutura de pastas do código

```text
src/
├── <preencher>/     ← descrição
├── <preencher>/     ← descrição
└── <preencher>/     ← descrição

tests/
├── unit/
├── integration/
└── e2e/             ← se houver
```

Regras de dependência entre pastas estão em [`architecture.md`](architecture.md) § 3.

---

## 5. Convenções de código

| Tema | Convenção |
|------|-----------|
| Estilo | `<ex.: seguir o linter configurado; não desligar regras sem ADR>` |
| Nomes de arquivos | `<ex.: kebab-case.ts>` |
| Nomes de classes/funções | `<preencher>` |
| Tratamento de erros | `<ex.: nunca engolir exceção; erros de domínio em src/domain/errors>` |
| Logs | `<ex.: usar o logger do projeto; nunca console.log/print em código de produção>` |
| Comentários | explicam **por quê**, não **o quê** |
| Idioma | código em inglês; docs, commits e comentários em `<português/inglês>` |

---

## 6. Variáveis de ambiente

Documentadas em [`.env.example`](../.env.example) na raiz. Regras:

- toda variável nova entra em `.env.example` **na mesma tarefa** em que passa a ser lida;
- valores reais nunca vão para o repositório;
- em CI, variáveis vêm do próprio workflow;
- em desenvolvimento, homologação e produção, os valores vêm dos *secrets* do GitHub Environment de
  mesmo nome da branch (`development`, `homologation`, `production`) — o mesmo nome de variável nos
  três, com valores diferentes. Ver [`guides/git-github.md`](guides/git-github.md) § 8.3.

---

## 7. Fluxo de branches e commits

Resumo (detalhes em [`guides/git-github.md`](guides/git-github.md)):

- Três branches longas, uma por ambiente: `development` (default), `homologation` e `production`.
  Nenhuma recebe commit direto — só PR.
- Uma branch por tarefa: `task/<TASK-ID>-<slug>`, criada a partir de `development` e mesclada de
  volta em `development` por **squash**.
- Promoção entre ambientes por PR de merge em cascata, sempre com **merge commit** (nunca squash).
- Commits no formato Conventional Commits, sempre com o ID da tarefa na mensagem (entre parênteses
  no final, ou na descrição quando a tarefa é o próprio assunto).
- **Nenhum commit leva rodapé de co-autoria de IA** (`Co-authored-by:` e equivalentes). Verificado
  por `scripts/check-structure.sh`.
- Antes de abrir PR: rodar o comando único da seção 3.

---

## 8. Arquivos protegidos

Agentes **não alteram** estes arquivos sem autorização explícita registrada no handoff:

| Arquivo/pasta | Motivo | Quem pode alterar |
|---------------|--------|-------------------|
| `docs/business-rules.md` | regras de negócio vêm da pessoa responsável | pessoa responsável |
| `docs/decisions/ADR-*` com status Aceito | histórico de decisões | ninguém (criar novo ADR) |
| `handoffs/history/`, `tasks/completed/` | histórico | ninguém |
| `.github/workflows/*` | segurança do CI | pessoa responsável |
| `<preencher>` | `<ex.: schema de produção, contratos de API públicos>` | `<preencher>` |

---

## 9. Solução de problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `<preencher>` | `<preencher>` | `<preencher>` |

Agentes: ao resolver um problema de ambiente que tomou tempo, adicione uma linha aqui.
