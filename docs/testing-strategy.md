# Estratégia de testes

> **Status deste documento:** `<preencher>`. Define o que é "testado" neste projeto. Um agente que
> disser "testei" sem seguir o que está aqui está alucinando.

| Campo | Valor |
|-------|-------|
| Última revisão | `<AAAA-MM-DD>` |
| Framework de testes | `<preencher>` |
| Comando principal | `<preencher>` (igual ao de [`development-guide.md`](development-guide.md) § 3) |

---

## 1. Princípios

1. **Todo critério de aceite vira pelo menos um teste automatizado.** Se não dá para automatizar,
   o teste manual é descrito na tarefa com passos exatos e resultado esperado.
2. **Testes primeiro quando possível.** O Engenheiro de testes escreve os testes (falhando) antes do
   Implementador. Isso reduz a chance de a IA "implementar o que ela entendeu" em vez do que foi pedido.
3. **Saída real ou nada.** O handoff traz a saída resumida do comando de teste. "Passou" sem saída
   é considerado NÃO EXECUTADO.
4. **Teste quebrado não se apaga.** Se um teste existente quebrou, ou o código está errado ou o
   teste está errado — e descobrir qual é parte da tarefa. Registrar no handoff.
5. **Sem dados reais.** Fixtures usam dados sintéticos. Veja [`policies/security.md`](policies/security.md).

---

## 2. Tipos de teste neste projeto

| Tipo | O que cobre | Onde ficam | Ferramenta | Comando | Roda no CI? |
|------|-------------|------------|------------|---------|-------------|
| Unitário | funções/classes isoladas, regras de negócio | `tests/unit/` | `<preencher>` | `<preencher>` | sim |
| Integração | componentes juntos (ex.: serviço + banco) | `tests/integration/` | `<preencher>` | `<preencher>` | sim |
| Ponta a ponta (e2e) | fluxo completo pela interface/API | `tests/e2e/` | `<preencher>` | `<preencher>` | `<sim/não>` |
| Contrato | compatibilidade de APIs públicas | `<preencher>` | `<preencher>` | `<preencher>` | `<sim/não>` |
| Manual | o que não dá para automatizar | descrito na tarefa | pessoa | — | não |

---

## 3. Cobertura

| Métrica | Mínimo | Como medir |
|---------|--------|------------|
| Cobertura de linhas (global) | `<ex.: 80%>` | `<comando>` |
| Cobertura em `src/domain/` (ou equivalente) | `<ex.: 95%>` | `<comando>` |
| Regras de negócio (`RN-*`) com teste | 100% | referência cruzada em `business-rules.md` |

Cobertura é **piso**, não meta. Um teste que só aumenta cobertura sem verificar comportamento não é
aceito na revisão.

---

## 4. Convenções

- Nome do arquivo de teste: `<ex.: <modulo>.test.ts | test_<modulo>.py>`
- Nome do teste descreve comportamento: `"deve rejeitar e-mail sem @"`, não `"teste 1"`.
- Estrutura interna: *Arrange → Act → Assert* (ou *Given → When → Then*).
- Um teste, uma asserção principal. Vários cenários → vários testes (ou parametrização).
- Testes que dependem de rede, horário ou aleatoriedade devem isolar essas dependências
  (mocks, relógio fake, seed fixa).
- Referenciar a regra de negócio no nome ou comentário quando houver: `// RN-003`.

---

## 5. Critérios mínimos para aprovação de uma tarefa

- [ ] todos os testes existentes continuam passando;
- [ ] há teste novo para cada critério de aceite (ou teste manual descrito e executado);
- [ ] cobertura não caiu abaixo do mínimo da seção 3;
- [ ] nenhum teste foi marcado como `skip`/`ignore` sem justificativa no handoff;
- [ ] saída do comando de teste está no handoff.

---

## 6. Dados de teste

| Tipo de dado | Fonte | Observação |
|--------------|-------|------------|
| Fixtures | `tests/fixtures/` | sintéticos, versionados |
| Banco de teste | `<ex.: SQLite em memória / container>` | criado e destruído por execução |
| Segredos de teste | variáveis de ambiente do CI | nunca no repositório |

---

## 7. O que ainda não é testado

Registre aqui (e em [`known-gaps.md`](known-gaps.md)) o que se sabe que está sem cobertura, para
que nenhum agente presuma que está coberto.

- `<preencher>`
