# Handoff — TASK-009 — implementação (ADR-013 de convenções geométricas, Proposto)

> **Adaptação de protocolo** (decidida pela pessoa responsável em 2026-09-26): a TASK-006 roda em
> paralelo e cuida de `handoffs/current.md`. Por isso este handoff fica em `handoffs/TASK-009.md`, e
> `current.md` **não** foi editado. Quando as duas tarefas forem mergeadas, a pessoa decide como
> juntar este conteúdo ao `current.md` e ao `handoffs/history/`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:53 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-009-adr-convencoes-geometricas.md` |
| **Etapa concluída** | implementação (só documentação) |
| **Papel exercido** | Planejador + Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), subagente num git worktree isolado |
| **Branch** | `task/TASK-009-adr-convencoes-geometricas`, a partir de `development` @ `c0955b2` |
| **Duração aproximada** | ~25 min |

---

## 1. Objetivo desta etapa

Redigir o ADR-013 (`Proposto`) com convenções geométricas provisórias e explícitas, para destravar o
`GeometryService` e a PoC Three.js (P-001 a P-004), sem tratar nada como decidido.

## 2. O que foi feito

- Li AGENTS.md, `handoffs/current.md`, os docs da ordem de leitura, o índice de ADRs, os ADR-004 a
  ADR-012 e a doc-fonte §§ 10, 12, 14, 15, 17.3, 20, 25 e 26. Verifiquei que nenhuma delas define
  coordenadas, a referência do raio, a altura do gancho ou a posição do pino da lança.
- Criei a tarefa `tasks/in-progress/TASK-009-adr-convencoes-geometricas.md` (CA-1 a CA-8).
- Criei `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` com status **Proposto**. Ele
  tem as convenções C-1 a C-7 (cada item marcado como "proposta de engenharia" ou **A VALIDAR**), as
  simplificações S-1 a S-8, a verificação numérica do exemplo da doc-fonte, as alternativas A-0 (a
  proposta) a A-10, os riscos
  R-1 a R-7 e as perguntas G-1 a G-8 para a Guindastes Ribas.
- Acrescentei o ADR-013 como `Proposto` no índice de `docs/decisions/README.md` e em
  `docs/architecture.md` § 8.
- Acrescentei "proposta: ADR-013 (Proposto)", com link, ao fim do texto das linhas P-001 a P-004 de
  `docs/known-gaps.md`. O texto original ficou igual.
- Conferi as convenções do glTF 2.0 (§ 3.4) e do Three.js (`Object3D`) nas páginas oficiais.

**Resumo das convenções propostas:**

- sistema destro, **Y para cima**, metros; origem onde o eixo de giro encontra o plano de apoio;
  +Z = frente do chassi (A VALIDAR). Os eixos são os mesmos do glTF e do Three.js;
- ângulos em **graus** na API, no domínio e na persistência (radianos só dentro do cálculo). Giro ψ:
  0° com a lança para +Z, positivo no sentido anti-horário visto de cima. Inclinação θ: 0° na
  horizontal, positiva com a ponta subindo;
- **raio** = distância horizontal do eixo de giro até a vertical do gancho (**A VALIDAR**, G-1);
  **altura do gancho** = cota em relação ao plano de apoio;
- parâmetros da **ficha técnica no backend** (nunca do GLB): offset horizontal a (com sinal) e altura h
  do pino, faixas de L, θ, ψ e c;
- fórmulas: `R = a + L·cos θ`; `y_T = h + L·sin θ`; `y_G = y_T − c`; `G = (R·sin ψ, y_G, R·cos ψ)`;
- lança telescópica: L é contínuo na geometria, mas só os comprimentos tabelados ficam "no domínio"
  até a PEND-001;
- o backend é a fonte de verdade. O frontend calcula a mesma geometria só como pré-visualização;
  testes de paridade ficam para o futuro.

**Verificação numérica do exemplo (doc-fonte §§ 14.2/14.3):**

- L·cos 42° = 18,2 × 0,743145 = 13,5252 m. Com a = 0, o raio dá **13,5 m: fecha**.
- L·sin 42° = 18,2 × 0,669131 = 12,1782 m. y_G = h + 12,1782 − 8,4 = h + 3,78. Com h = 0 dá 3,78 m, e
  para chegar a 11,7 m seria preciso h = 7,92 m, valor não informado e implausível. **A altura não
  fecha.**
- Conclusão registrada no ADR: o exemplo é ilustrativo, inconsistente com as fórmulas quanto à altura
  do gancho, e não deve virar caso de teste.

## 3. Arquivos modificados

Saída de `git diff --stat development...HEAD`, antes do commit deste handoff:

```text
 docs/architecture.md                               |   1 +
 .../ADR-013-convencoes-geometricas-provisorias.md  | 404 +++++++++++++++++++++
 docs/decisions/README.md                           |   1 +
 docs/known-gaps.md                                 |   8 +-
 .../TASK-009-adr-convencoes-geometricas.md         | 134 +++++++
 5 files changed, 544 insertions(+), 4 deletions(-)
```

Mais este `handoffs/TASK-009.md` e a marcação do plano na tarefa (commit final).

Fora do escopo: nenhum. **Não** foram alterados: `docs/business-rules.md`, outros ADRs,
`.github/workflows/*`, `handoffs/current.md`, `backend/` e `frontend/`.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `git log -1` (antes de criar a branch) | ✅ | `c0955b2 Merge pull request #5 ...` |
| `awk` (contas da verificação numérica) | ✅ | `Lcos=13.5252 Lsin=12.1782 hook(h=0)=3.7782 h_needed=7.9218 a_needed=-0.0252 util=96.1538` |
| `bash scripts/check-structure.sh` | ❌ 1 erro (esperado), 1 aviso | ver abaixo |
| lint/testes/build | ⚠️ não se aplica | tarefa só de documentação, sem código |

Saída real do `check-structure.sh` (seções 2 a 8; a seção 1 teve só ✓), rodado depois do 3º commit:

```text
2. Handoff atual (handoffs/current.md)
  ✓ tamanho: 4090 bytes
  ✓ seção presente: O que foi feito
  ✓ seção presente: Arquivos modificados
  ✓ seção presente: Comandos executados
  ✓ seção presente: Próximo passo
3. Tarefas
  ! há 2 tarefas em tasks/in-progress/ — confirme que não tocam os mesmos arquivos
  ✗ handoffs/current.md não menciona a tarefa em andamento TASK-009
  ✓ nenhum ID de tarefa duplicado
4. Contexto mínimo do projeto (marcadores <preencher>)
  ✓ docs/project-overview.md sem marcadores <preencher>
  ✓ docs/architecture.md sem marcadores <preencher>
  ✓ docs/business-rules.md sem marcadores <preencher>
  ✓ docs/development-guide.md sem marcadores <preencher>
5. Segurança básica
  ✓ .env está no .gitignore
  ✓ nenhum .env versionado
  ✓ nenhum padrão óbvio de segredo encontrado
6. Links Markdown internos quebrados (docs/, AGENTS.md, README.md, tasks/, handoffs/)
  ✓ nenhum link interno quebrado
7. Branches
  ✓ branch de tarefa: task/TASK-009-adr-convencoes-geometricas
8. Autoria dos commits (sem co-autoria de IA)
  ✓ 3 commit(s) desta branch sem co-autoria de IA

FALHOU: 1 erro(s), 1 aviso(s)
```

- O erro é o esperado pela adaptação de protocolo: `current.md` fica com a TASK-006.
- O aviso vem da TASK-005, que continua em `tasks/in-progress/` nesta base (ver pendência 3).

## 5. Decisões tomadas

- ADR-013 criado como **Proposto** (agentes não aceitam ADR). Nenhuma regra de negócio foi criada.
- +Z como frente do chassi e zero do giro em +Z: coincide com a frente do asset glTF e deixa a direção
  da lança como `(sin ψ, 0, cos ψ)`. A referência real é A VALIDAR (G-5).
- `a` com sinal: o pino pode ficar à frente ou atrás do eixo de giro conforme o modelo.
- `c` definido como queda vertical abaixo da ponta, e não cabo desenrolado, para não depender do
  número de partes de cabo (A VALIDAR, G-6).
- Raio com R < 0 não vira |R|: fica sinalizado (proposta de engenharia).
- Onde os parâmetros ficam no modelo de domínio (`CraneKinematics`, entidade própria ou
  `CraneConfiguration`) ficou para a tarefa de modelagem. O ADR fixa só conteúdo, unidade e origem.

## 6. Regras de negócio aplicadas

- RN-003, RN-006, RN-007 e RN-008 foram citadas como restrições. Nenhuma foi alterada.
- Achado registrado como risco R-1 no ADR (hipótese, não é regra): se o raio das tabelas for o raio
  com carga (com deflexão), o raio geométrico sem deflexão fica menor que o real, e a capacidade
  consultada fica **maior** que a correta. O ADR propõe não aplicar correção sem regra da empresa.

## 7. O que NÃO foi feito e por quê

- Aceitar o ADR: decisão da pessoa responsável.
- Glossário de `project-overview.md` § 9 e `architecture.md` § 9: continuam "PENDENTE". Só mudam
  depois do aceite e da validação com a empresa. A tarefa pedia só architecture § 8.
- `GeometryService`, PoC, testes de paridade e cadastro da ficha técnica: fora do escopo.
- Revisão independente: não feita (etapa seguinte).
- Unidades do glTF (metro/radiano): não confirmadas no trecho da especificação obtido. O ADR não
  depende disso (usa RNF-004 para metros).

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Aceitar, pedir mudanças ou rejeitar o ADR-013 (em especial C-1 a C-7 e as simplificações S-1 a S-8)? | sim (para implementar o `GeometryService` com base nele) | | |
| 2 | Levar as perguntas G-1 a G-8 do ADR-013 para a Guindastes Ribas junto com a doc-fonte § 26? G-1 (referência do raio e deflexão) é a mais importante para a segurança (R-1) | não | | |
| 3 | A TASK-005 continua em `tasks/in-progress/` em `development`. Com a TASK-006 e a TASK-009 mergeadas, serão 3 tarefas lá, e o `check-structure.sh` **falha** com mais de 2. Mover a TASK-005 para `completed/`? | sim (CI) | | |
| 4 | Ao juntar TASK-006 e TASK-009: integrar este handoff ao `current.md` / `handoffs/history/` e apagar `handoffs/TASK-009.md`? | não | | |

## 9. ⚠️ Segurança

- Nada a relatar. Nenhum dado real de guindaste nem credencial foi usado.

## 10. Próximo passo

**Papel:** Revisor (outra sessão ou ferramenta); depois a pessoa responsável (aceite do ADR e merge com squash)

**O que fazer, concretamente:**
1. Revisar o ADR-013 com `docs/templates/code-review-template.md`: conferir as contas da verificação
   numérica, se cada item está marcado corretamente (proposta de engenharia ou A VALIDAR) e se nada
   contradiz RN-003, RN-008 ou os ADR-004 a ADR-012.
2. Pessoa responsável: responder às pendências 1 e 3 e fazer push/PR (não feitos por este agente).

**Ler primeiro (nesta ordem):**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-009-adr-convencoes-geometricas.md` § 3
4. `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md`
5. `docs/known-gaps.md` § 4 (P-001 a P-004)

**Cuidado com:**
- O ADR é `Proposto`: nenhum agente deve implementar com base nele antes do aceite
  (`docs/decisions/README.md`).
- `check-structure.sh` falha nesta branch até a TASK-006 atualizar `current.md` (esperado).

## 11. Como revisar este trabalho

- Comece pela seção "Verificação numérica" do ADR e pelas fórmulas de C-5.
- Tenho menos certeza sobre:
  - o risco R-1, que é hipótese: não verifiquei se as tabelas usam raio com carga;
  - a escolha de +Z como frente do chassi (G-5);
  - chamar h = 7,92 m de "implausível", que é hipótese sem ficha técnica.
- Diagrama ASCII da vista lateral: conferi o alinhamento das colunas por inspeção.
