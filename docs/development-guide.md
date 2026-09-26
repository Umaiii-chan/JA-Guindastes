# Guia de desenvolvimento

> **Status deste documento:** parcial (2026-09-26). Ainda não existe código: todo comando que depende
> de `frontend/` ou `backend/` está marcado **A VALIDAR** e será definido nas tarefas de toolchain e de
> esqueleto. Os comandos listados aqui são os **únicos** que os agentes devem executar. Se um comando
> não está aqui, ou está "A VALIDAR", o agente pergunta antes de rodar.
> Mantenha este documento sincronizado com o CI (`.github/workflows/ci.yml`): os dois devem rodar
> os mesmos comandos.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 |
| Stack | TypeScript + React + Three.js (frontend) / Python + FastAPI (backend) / PostgreSQL — versões A VALIDAR |

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como instalar / verificar |
|------------|--------|---------------------------|
| Git | 2.x | `git --version` |
| Bash (Git Bash no Windows) | — | necessário para `scripts/check-structure.sh` |
| Node.js e gerenciador de pacotes do frontend | A VALIDAR | A VALIDAR |
| Python e gerenciador de pacotes do backend | A VALIDAR | A VALIDAR |
| Docker + Docker Compose (ambiente local previsto na doc-fonte § 22) | A VALIDAR | A VALIDAR |

---

## 2. Instalação

```bash
# clonar
git clone https://github.com/Umaiii-chan/JA-Guindastes.git
cd JA-Guindastes

# instalar dependências
# A VALIDAR — ainda não existe código (tarefas de esqueleto do backend e do frontend)

# configurar ambiente
cp .env.example .env
# edite .env com valores locais (nunca commitar)
```

---

## 3. Comandos do dia a dia

**Estes comandos são a referência oficial.** O CI e os agentes usam exatamente estes.

| Ação | Comando | Observações |
|------|---------|-------------|
| Rodar em desenvolvimento | A VALIDAR | doc-fonte § 22 prevê Docker Compose com frontend, backend e postgres |
| Rodar testes | A VALIDAR | ver [`testing-strategy.md`](testing-strategy.md) e doc-fonte § 20 |
| Rodar um teste específico | A VALIDAR | |
| Lint | A VALIDAR | |
| Formatação (verificar) | A VALIDAR | |
| Formatação (corrigir) | A VALIDAR | |
| Verificação de tipos | A VALIDAR | tipagem estática no frontend e type hints no backend (RNF-008) |
| Build | A VALIDAR | |
| Migrations (criar) | A VALIDAR | ferramenta não definida na doc-fonte |
| Migrations (aplicar) | A VALIDAR | |
| Auditoria de dependências | A VALIDAR | ver [`security.md`](security.md) § 5 |
| Validar estrutura do repo | `bash scripts/check-structure.sh` | universal, já funciona |

Comando único que roda tudo antes de abrir PR:

```bash
# A VALIDAR — hoje o único gate existente é: bash scripts/check-structure.sh
```

---

## 4. Estrutura de pastas do código

Estrutura **planejada** (doc-fonte § 9, adaptada à raiz deste repositório). Nada disso existe ainda.

```text
frontend/
├── src/
│   ├── app/             ← bootstrap, router, providers
│   ├── domain/          ← tipos e regras locais independentes da UI
│   ├── application/     ← casos de uso do cliente / orquestração
│   ├── infrastructure/  ← api/ e websocket/
│   ├── presentation/    ← pages/, components/, panels/
│   └── three/           ← scene/, camera/, controls/, loaders/, crane/, animation/, collision/
└── tests/
backend/
├── app/
│   ├── domain/          ← entities/, value_objects/, services/, exceptions/
│   ├── application/     ← ports/, use_cases/
│   ├── infrastructure/  ← database/, repositories/, storage/, importers/
│   └── presentation/    ← api/, websocket/
└── tests/
assets/example-models/   ← modelos 3D de exemplo
docker/                  ← imagens e configuração do Docker Compose
docs/                    ← documentação do projeto (este diretório); doc-fonte em docs/produto/
```

Regras de dependência entre pastas estão em [`architecture.md`](architecture.md) § 3.

---

## 5. Convenções de código

| Tema | Convenção |
|------|-----------|
| Estilo | seguir o linter configurado (A VALIDAR); não desligar regras sem ADR |
| Nomes de arquivos | A VALIDAR (definido no esqueleto de cada serviço) |
| Nomes de classes/funções | entidades de domínio com os nomes em inglês da doc-fonte § 10.2 (`Crane`, `LoadChart`, `CraneConfiguration`...); casos de uso como na § 11.1 (`CreateCrane`, `CalculateCapacity`...) |
| Campos com unidade | sufixo da unidade no nome, como nos contratos da doc-fonte §§ 14–15 (`boom_length_m`, `boom_angle_deg`, `load_weight_kg`) |
| Tratamento de erros | consulta fora do domínio da tabela é erro/resultado de domínio explícito, nunca extrapolação silenciosa (RN-007; doc-fonte § 14.4) |
| Logs | não substituem os dados persistidos necessários para reproduzir um resultado (doc-fonte § 21) |
| Comentários | explicam **por quê**, não **o quê** |
| Idioma | código em inglês; docs e commits em português; comentários no código: A VALIDAR |

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
| `docs/produto/documentacao-tecnica-v0.1.md` e `docs/produto/diagrams/` | cópia congelada da doc-fonte v0.1; uma versão nova entra como arquivo novo | ninguém (nova versão = novo arquivo) |

---

## 9. Solução de problemas comuns

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| No Windows, `python` abre a Microsoft Store ou diz "Python não foi encontrado" | alias de execução do Windows para a Store | desativar o alias em Configurações > Aplicativos > Configurações avançadas > Aliases de execução, ou usar o Python do gerenciador definido na tarefa de toolchain |

Agentes: ao resolver um problema de ambiente que tomou tempo, adicione uma linha aqui.
