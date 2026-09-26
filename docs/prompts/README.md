# Prompts prontos

Copie e cole no início de cada sessão de IA. Substitua os campos entre `<...>`. Sempre comece com
o kickoff (`00`), depois cole o prompt do papel.

| Arquivo | Papel | Quando |
|---------|-------|--------|
| [`00-kickoff.md`](00-kickoff.md) | qualquer | início de **toda** sessão |
| [`01-planejador.md`](01-planejador.md) | Planejador | tarefa recém-criada, sem plano |
| [`02-testes.md`](02-testes.md) | Engenheiro de testes | plano pronto, sem testes |
| [`03-implementador.md`](03-implementador.md) | Implementador | testes prontos (vermelhos) ou cenários escritos |
| [`04-revisor.md`](04-revisor.md) | Revisor | implementação concluída; **sessão nova** |
| [`05-handoff.md`](05-handoff.md) | qualquer | fim de etapa, para forçar um handoff bem escrito |
| [`06-preencher-contexto.md`](06-preencher-contexto.md) | assistente da pessoa | projeto novo, `docs/` vazio |

## Regras dos prompts

1. Sempre exigem ler `AGENTS.md` e `handoffs/current.md` primeiro.
2. Sempre pedem confirmação do entendimento **antes** de agir.
3. Sempre exigem evidência (saída de comando) e vocabulário "verifiquei / suponho".
4. Sempre terminam com o handoff.

Adapte à sua ferramenta (nível A, B ou C — ver `docs/guides/using-ai-tools.md`), mas mantenha as
quatro regras.
