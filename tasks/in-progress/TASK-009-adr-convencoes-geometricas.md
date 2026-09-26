# TASK-009 — Propor ADR de convenções geométricas provisórias

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (pedido em sessão com o agente Claude Code) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-009-adr-convencoes-geometricas` (a partir de `development` @ `c0955b2`) |
| **PR** | — |
| **Requisitos** | RF-012, RF-013, RF-014, RF-015, RF-020; RNF-002, RNF-004, RNF-010 |
| **Regras de negócio** | RN-003, RN-006, RN-007, RN-008 (citadas, não alteradas) |
| **Estimativa** | P |

---

## 1. Objetivo

Existe um ADR `Proposto` com convenções geométricas **provisórias e explícitas** (coordenadas,
ângulos, referência do raio, parâmetros do guindaste, fórmulas e simplificações). Com ele, o
`GeometryService` e a PoC Three.js podem começar sem esperar a Guindastes Ribas, e o que depende da
empresa fica marcado.

## 2. Contexto

- A doc-fonte v0.1 pede o cálculo de raio e altura do gancho (§ 14; RF-015), mas não define a
  geometria. As lacunas estão em `docs/known-gaps.md`, P-001 a P-004.
- A pessoa responsável decidiu, em 2026-09-26, que um agente redige o ADR-013 como `Proposto`
  (agentes só criam ADR Proposto: `docs/decisions/README.md`).
- Adaptação de protocolo decidida pela pessoa: a TASK-006 roda em paralelo e cuida de
  `handoffs/current.md`. Esta tarefa **não** edita `current.md` e escreve o handoff em
  `handoffs/TASK-009.md`. Até a TASK-006 ser mergeada, o `check-structure.sh` acusa que `current.md`
  não menciona a TASK-009 (esperado).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado `docs/decisions/`, quando abro `ADR-013-convencoes-geometricas-provisorias.md`,
  então ele tem status `Proposto`, todas as seções de `ADR-000-template.md` e define: sistema de
  coordenadas, origem, unidades, zero e sentido do giro e da inclinação da lança, referência do raio
  de trabalho (marcada A VALIDAR) e referência da altura do gancho.
- [ ] **CA-2** — Dado o ADR-013, quando leio os parâmetros do guindaste, então estão listados com
  símbolo, unidade e definição (incluindo offset horizontal e altura do pino da lança), e o texto diz
  que vêm da ficha técnica cadastrada no backend, e não do GLB (RN-003, RN-008, P-003).
- [ ] **CA-3** — Dado o ADR-013, quando leio as fórmulas, então raio, altura da ponta, altura do gancho
  e posição do gancho estão escritos, e as simplificações (sem deflexão, sem moitão/polia, cabo
  vertical e as demais) estão listadas explicitamente.
- [ ] **CA-4** — Dado o ADR-013, quando leio a parte de lança telescópica e de fonte de verdade, então
  diz que o comprimento é contínuo na geometria, mas só os comprimentos tabelados ficam "no domínio"
  até a PEND-001 (P-002); e que o backend é a fonte de verdade, com o frontend calculando só
  pré-visualização e testes de paridade futuros (P-004).
- [ ] **CA-5** — Dado o exemplo da doc-fonte §§ 14.2/14.3 (18,2 m; 42°; 8,4 m → 13,5 m e 11,7 m),
  quando leio o ADR-013, então as contas estão mostradas e o resultado registrado, dizendo se o
  exemplo fecha com as fórmulas.
- [ ] **CA-6** — Dado o ADR-013, quando leio, então há alternativas consideradas, consequências, riscos
  e perguntas novas para a Guindastes Ribas; nada é tratado como decidido.
- [ ] **CA-7** — Dado `docs/decisions/README.md` e `docs/architecture.md` § 8, quando reviso, então o
  ADR-013 aparece como `Proposto`; e em `docs/known-gaps.md` as linhas P-001 a P-004 ganharam
  "proposta: ADR-013 (Proposto)" sem perder o texto original.
- [ ] **CA-8** — `bash scripts/check-structure.sh` não acusa link interno quebrado; a saída real está
  em `handoffs/TASK-009.md` (erro esperado: `current.md` não menciona a TASK-009).

## 4. Escopo

### Dentro do escopo

- `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` (novo).
- Índice em `docs/decisions/README.md`, `docs/architecture.md` § 8 e `docs/known-gaps.md` (P-001..P-004).
- Esta tarefa e `handoffs/TASK-009.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Aceitar o ADR (decisão da pessoa responsável).
- Alterar `docs/business-rules.md`, outros ADRs, `.github/workflows/*`, `handoffs/current.md`,
  `backend/` ou `frontend/`.
- Implementar o `GeometryService`, a PoC Three.js, testes de paridade ou o cadastro da ficha técnica.
- Definir interpolação, arredondamento, alertas ou extrapolação (PEND-001..004; RN-007).
- Se algo daqui parecer necessário, registrar em "Pendências" e parar, não implementar.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `docs/decisions/ADR-013-convencoes-geometricas-provisorias.md` | criar | sim |
| `docs/decisions/README.md` | alterar (índice) | sim |
| `docs/architecture.md` | alterar (§ 8) | sim |
| `docs/known-gaps.md` | alterar (P-001..P-004) | sim |
| `tasks/in-progress/TASK-009-adr-convencoes-geometricas.md` | criar | sim |
| `handoffs/TASK-009.md` | criar | sim |

## 6. Riscos e dependências

- Depende de: respostas da Guindastes Ribas para virar decisão (P-001..P-004; PEND-001, 005, 006, 007).
- Risco: a proposta ser usada como se estivesse decidida → status `Proposto`, itens marcados
  **A VALIDAR** e P-001..P-004 continuam abertos em `known-gaps.md`.
- Risco: conflito com a TASK-006 em arquivos comuns → esta tarefa não toca `handoffs/current.md`,
  `frontend/` nem `.github/`.

## 7. Teste manual (se houver)

1. `bash scripts/check-structure.sh`
   **Esperado:** nenhum link quebrado; único erro: `handoffs/current.md não menciona a tarefa em andamento TASK-009`.
2. Refazer as contas da seção "Verificação numérica" do ADR-013 numa calculadora.
   **Esperado:** mesmos números (cos 42° = 0,743145; sin 42° = 0,669131).

---

## 8. Plano (preenchido pelo Planejador)

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Criar a tarefa | esta tarefa | CA-1..CA-8 escritos | [x] |
| 2 | Redigir o ADR-013 e atualizar o índice | ADR-013, `decisions/README.md` | CA-1..CA-6 | [ ] |
| 3 | Referenciar o ADR-013 em architecture § 8 e known-gaps | 2 arquivos | CA-7 | [ ] |
| 4 | Rodar check-structure e escrever o handoff | `handoffs/TASK-009.md` | CA-8 | [ ] |

**Análise de impacto:**
- Arquivos que podem quebrar indiretamente: nenhum código; só links Markdown (verificados pelo check).
- Regras de negócio aplicáveis: RN-003, RN-006, RN-007, RN-008 (citadas; nenhuma alterada).
- Decisões necessárias: aceitar ou rejeitar o ADR-013 (pessoa); validar com a empresa os itens A VALIDAR.

## 9. Cenários de teste (preenchido pelo Engenheiro de testes)

Não se aplica: tarefa só de documentação. A verificação numérica do exemplo está no próprio ADR.

## 10. Parecer da revisão (preenchido pelo Revisor)

**Resultado:** — (aguardando revisão)

## 11. Encerramento (preenchido ao mover para completed/)

- O que foi entregue (2–3 linhas):
- O que ficou de fora e virou tarefa nova: TASK-...
- Aprendizados para o template/docs:
