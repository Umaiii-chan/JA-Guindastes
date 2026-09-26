# Documentação — índice

A documentação tem **duas camadas**. Saiba em qual você está mexendo.

## Camada 1 — Contexto específico do projeto (preencher a cada projeto)

Estes arquivos começam com marcadores `<preencher>`. Nenhum agente deve implementar nada enquanto
os quatro primeiros não estiverem preenchidos.

| Arquivo | Conteúdo | Quem mantém |
|---------|----------|-------------|
| [`project-overview.md`](project-overview.md) | problema, objetivo, público, funcionalidades, escopo | pessoa responsável |
| [`architecture.md`](architecture.md) | componentes, camadas, dependências, integrações, fluxo de dados | pessoa responsável + agentes via ADR |
| [`business-rules.md`](business-rules.md) | regras funcionais que não podem ser inventadas | **somente** pessoa responsável |
| [`development-guide.md`](development-guide.md) | instalação, execução, comandos, convenções, arquivos protegidos | pessoa responsável + agentes |
| [`testing-strategy.md`](testing-strategy.md) | tipos de teste, ferramentas, comandos, cobertura mínima | pessoa responsável + agentes |
| [`security.md`](security.md) | contexto de segurança do projeto: dados sensíveis, autenticação, segredos | pessoa responsável |
| [`known-gaps.md`](known-gaps.md) | limitações, dívidas técnicas, pendências, o que não presumir | todos |
| [`requirements/`](requirements/README.md) | requisitos funcionais e não funcionais | pessoa responsável |
| [`decisions/`](decisions/README.md) | ADRs — decisões arquiteturais e tecnológicas | todos (via template) |

## Camada 2 — Protocolo universal (reutilizável em qualquer projeto)

Estes arquivos raramente mudam entre projetos. Se mudar, mude no template também.

| Pasta | Conteúdo |
|-------|----------|
| [`templates/`](templates/) | [tarefa](templates/task-template.md), [handoff](templates/handoff-template.md), [code review](templates/code-review-template.md), [ADR](decisions/ADR-000-template.md) |
| [`checklists/`](checklists/) | [implementação](checklists/implementation-checklist.md), [code review](checklists/code-review-checklist.md), [definição de pronto](checklists/definition-of-done.md) |
| [`guides/`](guides/) | [fluxo de trabalho](guides/workflow.md), [Git e GitHub](guides/git-github.md), [uso das IAs](guides/using-ai-tools.md), [adaptar o template](guides/adapting-template.md), [Obsidian](guides/obsidian.md) |
| [`policies/`](policies/) | [anti-alucinação](policies/anti-hallucination.md), [segurança](policies/security.md) |
| [`prompts/`](prompts/) | prompts prontos por papel: kickoff, planejador, testes, implementador, revisor, handoff |

## Regra de ouro

Se uma informação está na documentação e no código e eles discordam, **o código está certo e a
documentação está errada** — corrija a documentação na mesma tarefa. Se a informação só existe na
cabeça de alguém, ela não existe para os agentes.
