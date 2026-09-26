# Prompt — Ajudar a preencher o contexto de um projeto novo

Para a **pessoa responsável** usar com uma IA ao adaptar o template a um projeto real
(`docs/guides/adapting-template.md`, Fase 2). A IA entrevista você e gera rascunhos; **você valida**.
Funciona em nível A (chat puro) — para projeto existente, nível C ajuda a mapear o código.

---

```text
Vou adaptar um template de workflow de desenvolvimento com múltiplas IAs a um projeto <novo | existente>. Você vai me ajudar a preencher a documentação de contexto que os agentes de IA lerão antes de trabalhar. Sua função é ENTREVISTAR e RASCUNHAR; a decisão final é minha.

Leia primeiro `AGENTS.md`, `docs/README.md` e `docs/guides/adapting-template.md` (Fase 2 e 3). Depois leia os arquivos-alvo com seus marcadores `<preencher>`: `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md`, `docs/development-guide.md`, `docs/testing-strategy.md`, `docs/security.md`, `docs/known-gaps.md`, `.env.example`.

Método:
1. Um documento por vez, na ordem acima. Não pule para o próximo sem eu confirmar o anterior.
2. Para cada documento, me faça as perguntas necessárias em blocos de no máximo 5, começando pelas mais importantes. Se eu não souber responder, a resposta vai para `docs/known-gaps.md` § 4 (decisões pendentes) ou `docs/business-rules.md` → "Perguntas em aberto" — nunca você inventa.
3. <Se projeto existente e você tem acesso ao código:> antes de perguntar sobre arquitetura e comandos, inspecione o repositório (estrutura de pastas, arquivos de configuração, imports principais, scripts de build/teste) e me traga um rascunho marcado como HIPÓTESE para eu confirmar ou corrigir. Cite os arquivos que você abriu.
4. Gere o conteúdo completo do documento, substituindo TODOS os `<preencher>`. Onde algo não se aplica, escreva "não se aplica" e por quê. Onde eu não soube responder, deixe explícito "PENDENTE — ver known-gaps P-00N".
5. Regras de negócio: cada uma com ID RN-NNN, contexto, regra precisa, exemplos, exceções, origem. Se eu descrever algo vago, me peça um exemplo concreto de entrada → resultado antes de escrever.
6. Comandos em `development-guide.md` § 3: só liste comandos que eu confirmei que funcionam (ou que você rodou e colou a saída). Comando não confirmado fica marcado "A VALIDAR".
7. Ao terminar cada documento, me entregue o conteúdo em um bloco único, com o caminho no topo, pronto para eu salvar. Se tiver acesso de escrita, salve e me mostre o `git diff --stat`.

No fim de tudo, gere:
- um rascunho de `.github/workflows/ci.yml` com os comandos reais da stack (baseado no arquivo existente, que tem exemplos comentados);
- uma sugestão de TASK-001 pequena e vertical para testar o fluxo, usando `docs/templates/task-template.md`;
- o conteúdo inicial de `handoffs/current.md` apontando para a TASK-001 e para o papel Planejador;
- a lista do que ficou PENDENTE.

Não invente stack, biblioteca, comando, regra ou requisito. Pergunte.
```
