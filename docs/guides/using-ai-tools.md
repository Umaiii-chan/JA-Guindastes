# Como usar ChatGPT/Codex, Claude e Gemini manualmente neste fluxo

Este guia explica, ferramenta por ferramenta, como fazer a IA **ler o repositório** e **seguir
`AGENTS.md`** — sem API, sem custo além da assinatura que você já tem (ou do plano gratuito).

A distinção que importa não é "qual IA", e sim **quanto acesso ao repositório a ferramenta tem**:

| Nível | O que a IA consegue | Exemplos | Papéis adequados |
|-------|---------------------|----------|------------------|
| **A. Chat puro** | só vê o que você cola | ChatGPT web, Claude web, Gemini web, sem integrações | Planejador (com contexto colado), Revisor de diff colado, redação de docs/ADR |
| **B. Chat com arquivos/repositório** | lê arquivos que você anexa ou um repositório conectado, mas **não executa comandos** | ChatGPT com upload/GitHub conectado; Claude Projects com arquivos; Gemini com upload; NotebookLM | Planejador, Engenheiro de testes (escreve, não roda), Revisor |
| **C. Agente com terminal** | lê, edita, **executa comandos** no seu repositório | Claude Code, Codex CLI/Codex no ChatGPT, Gemini CLI, Cursor, Copilot agent, Windsurf, Cline | Implementador, Engenheiro de testes (roda), Revisor (executa testes) |

**Regra:** o Implementador precisa de nível C. Sem terminal, não há como cumprir a regra "não afirme
que o teste passou sem executar". Se você só tem nível A/B, **você** roda os comandos e cola a saída
de volta — e diz isso no handoff.

---

## 1. O ritual de início (igual para todas)

Toda sessão de IA começa com o **mesmo prompt de kickoff**, disponível em `docs/prompts/00-kickoff.md`.
A essência:

> Você vai trabalhar neste repositório como **[papel]**. Antes de qualquer coisa, leia `AGENTS.md`
> por completo e depois `handoffs/current.md`. Siga a ordem de leitura de `AGENTS.md` § 1.
> Confirme o que leu resumindo em até 10 linhas: qual é a tarefa, qual etapa foi concluída, qual é o
> próximo passo, quais arquivos você vai inspecionar e quais dúvidas já identificou. **Não faça
> nada além disso até eu confirmar.**

Essa última frase é importante: dá a você a chance de corrigir o entendimento antes de a IA gastar
esforço na direção errada.

---

## 2. Ferramenta por ferramenta

### 2.1 ChatGPT (web) e Codex

**Nível A — ChatGPT web sem integrações**

1. Abra uma conversa nova por papel (não reutilize a conversa do Implementador para revisar).
2. Cole o kickoff + o conteúdo de `AGENTS.md` + `handoffs/current.md` + a tarefa.
3. Cole os arquivos relevantes conforme a IA pedir (ela deve pedir, não adivinhar).
4. Para revisão: cole a saída de `git diff development...task/TASK-NNN`.
5. Copie o resultado (plano, cenários, parecer) para o arquivo certo no repositório **você mesmo**.
6. Você atualiza o handoff (ou pede para a IA gerar o texto e você cola).

**Nível B — ChatGPT com GitHub conectado / upload de arquivos**

- Conecte o repositório (se sua conta permitir) ou faça upload de um `.zip` da pasta sem `node_modules/`, `.git/` etc.
- Mesmo prompt de kickoff. Peça explicitamente: "liste os arquivos que você abriu".
- Lembre: ela **não executa**. Tudo que for "rodar" é você.

**Nível C — Codex (CLI ou dentro do ChatGPT com acesso ao repositório)**

- Codex lê `AGENTS.md` automaticamente. Mesmo assim, use o kickoff — reforça `handoffs/current.md`.
- Ele executa testes; exija que cole a saída no handoff.
- Se o Codex rodar em sandbox sem rede, instale dependências antes ou aceite "NÃO EXECUTADO" com
  explicação.

### 2.2 Claude (web, Projects) e Claude Code

**Nível A/B — Claude web**

- Crie um **Project** para o repositório e coloque nos arquivos do projeto: `AGENTS.md`, `docs/*.md`
  principais e `handoffs/current.md` (atualize este último antes de cada sessão — é o que muda).
- Nas instruções do Project, cole: "Leia AGENTS.md antes de tudo. Siga a ordem de leitura."
- Uma conversa nova por papel. Kickoff. Cole arquivos/diff sob demanda.

**Nível C — Claude Code (terminal ou extensão)**

- Claude Code lê `CLAUDE.md` automaticamente, que aponta para `AGENTS.md`. Ainda assim, use o kickoff.
- Ele executa comandos. Peça para sempre colar a saída resumida no handoff.
- Bom para o papel de Implementador e para o Revisor que executa testes.
- Para revisão independente: abra uma **sessão nova** (`/clear` ou novo terminal) — não a mesma
  sessão que implementou.

### 2.3 Gemini (web) e Gemini CLI

**Nível A/B — Gemini web / NotebookLM**

- Janela de contexto grande: bom Planejador para projetos com muita documentação. Faça upload
  de `docs/` inteiro (ou cole).
- Kickoff. Peça análise de impacto e plano. Você copia para a tarefa.
- NotebookLM é útil para **perguntar** sobre a documentação ("existe regra sobre X?"), não para implementar.

**Nível C — Gemini CLI**

- Lê `GEMINI.md`, que aponta para `AGENTS.md`. Use o kickoff.
- Mesmas regras de execução e handoff.

### 2.4 Cursor, Windsurf, Cline, Copilot (agente) e outros

- A maioria lê `AGENTS.md` nativamente; Copilot lê `.github/copilot-instructions.md` (que aponta para
  `AGENTS.md`). Se sua ferramenta usa outro nome (`.cursorrules`, `.windsurfrules`...), crie o arquivo
  com o mesmo conteúdo de `CLAUDE.md`: uma linha apontando para `AGENTS.md`.
- Kickoff igual. Regras iguais.

---

## 3. O que você (pessoa) faz entre uma IA e outra

Este é o trabalho de "orquestração manual". É pouco, mas é o que mantém o fluxo íntegro:

1. **Ler o handoff** que a IA acabou de escrever. Está completo? Tem saída de comando? Tem dúvida
   pendente que precisa da sua resposta?
2. **Responder pendências** direto no handoff (seção "Pendências / decisões necessárias"), ou em
   `docs/business-rules.md` se for regra de negócio, ou aceitando/rejeitando ADR.
3. **Commitar** o estado atual (`chore(handoff): ...`).
4. **Abrir a próxima IA** com o kickoff.

Tempo típico: 5 a 10 minutos por transição. Se estiver levando muito mais, o handoff está ruim —
devolva para a IA anterior com o template.

---

## 4. Como passar o repositório para uma IA sem terminal

Para nível A/B, a IA precisa "ver" o repositório. Opções, da melhor para a pior:

1. **Conectar o repositório GitHub** (ChatGPT, Claude e Gemini oferecem isso em alguns planos).
2. **Upload de `.zip`** do repositório. Use `git archive`, que funciona igual em Linux, macOS e
   Windows e inclui **apenas arquivos versionados** (logo, nunca `.env`, dependências ou builds):
   ```bash
   git archive -o contexto.zip HEAD . ':!reference'
   ```
   Se precisar incluir alterações ainda não commitadas, commite antes (em uma branch de trabalho).
3. **Colar arquivos sob demanda**: cole `AGENTS.md`, `handoffs/current.md`, a tarefa, e deixe a IA
   pedir o resto. Ela deve pedir pelo caminho completo; você cola com o caminho no topo.
4. **Um único arquivo concatenado** para IAs com contexto grande:
   ```bash
   # gera um .md com todos os docs e a tarefa atual, com o caminho de cada arquivo como cabeçalho
   for f in AGENTS.md handoffs/current.md tasks/in-progress/*.md docs/*.md docs/decisions/*.md; do
     echo -e "\n\n===== $f =====\n"; cat "$f"; done > /tmp/contexto.md
   ```

Nunca envie: `.env`, credenciais, dados reais de usuários, dumps de banco.

---

## 5. Erros comuns e como evitar

| Erro | Consequência | Prevenção |
|------|--------------|-----------|
| Reusar a conversa do Implementador para revisar | revisor "concorda" com o que ele mesmo fez | conversa/sessão nova, de preferência outra ferramenta |
| Não colar `handoffs/current.md` | IA começa do zero ou do que "lembra" | kickoff sempre inclui o handoff |
| Aceitar "testes passam" sem saída | alucinação passa despercebida | devolver: "cole a saída do comando" |
| Deixar a IA decidir regra de negócio | regra inventada vira código | `business-rules.md` + pergunta no handoff |
| Colar o repositório inteiro em toda mensagem | contexto estoura; IA perde o foco | kickoff + arquivos sob demanda |
| Responder dúvidas só no chat | próxima IA não vê a resposta | responder **no arquivo** (handoff, RN, ADR) |
| Pular o kickoff porque "a ferramenta já lê AGENTS.md" | ela lê, mas não necessariamente o handoff | kickoff sempre |

---

## 6. Prompts prontos

Todos em `docs/prompts/`:

| Arquivo | Uso |
|---------|-----|
| `00-kickoff.md` | início de qualquer sessão, qualquer papel |
| `01-planejador.md` | análise de impacto e plano |
| `02-testes.md` | cenários e testes a partir dos critérios de aceite |
| `03-implementador.md` | implementação guiada pelo plano e pelos testes |
| `04-revisor.md` | revisão independente com checklist |
| `05-handoff.md` | fechar a etapa e escrever o handoff |
| `06-preencher-contexto.md` | ajudar a pessoa a preencher `docs/` em um projeto novo |

Adapte livremente, mas mantenha as três exigências: **ler `AGENTS.md`**, **ler o handoff**,
**colar evidência**.
