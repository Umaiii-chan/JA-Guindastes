# Handoff — TASK-002 — implementação (Camada 1 preenchida a partir da doc do simulador)

> Handoff anterior (encerramento parcial da TASK-001) arquivado em
> `handoffs/history/2026-09-26-TASK-001-encerramento.md`.

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:07 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-002-camada-1-simulador.md` |
| **Etapa concluída** | planejamento + implementação (só documentação) |
| **Papel exercido** | Planejador + Implementador de documentação (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-002-camada-1-simulador`, a partir de `development` @ `c17358a` |
| **Duração aproximada** | ~40 min |

---

## 1. Objetivo desta etapa

Dar aos agentes o contexto mínimo do produto (Simulador Web 3D para Análise de Tabelas de Carga de
Guindastes), a partir da documentação técnica v0.1 entregue pela pessoa responsável.

## 2. O que foi feito

- Copiei a doc-fonte e os 16 diagramas (8 `.dot`, 8 `.png`) para `docs/produto/`, sem alteração
  (sha256 da doc: `c7793be8762a5286…`, igual ao original).
- Preenchi `docs/project-overview.md`, `docs/architecture.md`, `docs/business-rules.md` e
  `docs/development-guide.md`, citando a seção de origem. O que depende de validação está como
  **PENDENTE** e os comandos que dependem de código inexistente estão como **A VALIDAR**.
- Transcrevi para `docs/business-rules.md` as RN-001..008 (enunciado literal da doc-fonte § 6.1) e as
  PEND-001..008 como perguntas em aberto (texto literal da § 6.2).
- Criei `docs/requirements/functional.md` (RF-001..024) e `non-functional.md` (RNF-001..012), gerados
  por script a partir das tabelas da doc-fonte, com texto literal, e atualizei o índice em
  `docs/requirements/README.md`.
- Preenchi `docs/known-gaps.md`: limitações L-001..003; decisões pendentes P-001..P-013 (geometria,
  lança telescópica, alertas, formato de importação, dados de teste, segurança de upload,
  autenticação, orquestrador, ambientes, equipe, versão da doc); e a lista do que não presumir.
- Removi `src/.gitkeep` e `tests/.gitkeep` (layout `frontend/` e `backend/` na raiz).
- Acrescentei `docs/produto/` aos arquivos protegidos em `docs/development-guide.md` § 8, como cópia
  congelada (uma versão nova entra como arquivo novo).

## 3. Arquivos modificados

Saída de `git status --short` antes do commit:

```text
 M docs/architecture.md
 M docs/business-rules.md
 M docs/development-guide.md
 M docs/known-gaps.md
 M docs/project-overview.md
 M docs/requirements/README.md
D  src/.gitkeep
D  tests/.gitkeep
?? docs/produto/
?? docs/requirements/functional.md
?? docs/requirements/non-functional.md
?? handoffs/history/2026-09-26-TASK-001-encerramento.md
?? tasks/in-progress/TASK-002-camada-1-simulador.md
```

(mais este `handoffs/current.md`). Fora do escopo: nenhum.

## 4. Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `sha256sum` do original e da cópia | ✅ | os dois começam com `c7793be8762a5286` |
| script de conferência das RN/PEND contra a doc-fonte (l.144–151 e l.155–162) | ✅ | `literais ok: 16 divergentes: 0` |
| script de geração dos requisitos | ✅ | `ok 24 12` (24 RF, 12 RNF) |
| `grep -c '<preencher>'` nos 4 documentos mínimos | ✅ | 0, 0, 0, 0 |
| `bash scripts/check-structure.sh` (com a TASK-002 em `in-progress/`) | ✅ | `OK: 0 erros, 0 aviso(s)` |
| testes / lint / build | ⚠️ NÃO EXECUTADO | não existem: não há código |

## 5. Decisões tomadas

- **Decisões da pessoa em chat (2026-09-26), respondendo "sim para 1 a 5":**
  1. o repositório deixa de ser template e passa a ser o simulador;
  2. **autorização** para transcrever RN e PEND em `docs/business-rules.md` (arquivo protegido);
  3. os ADRs da doc-fonte serão rascunhados como ADR-004..011 `Proposto` (feito na TASK-003, não aqui);
  4. comandos inexistentes ficam "A VALIDAR";
  5. layout `frontend/` e `backend/` na raiz, sem `src/` e `tests/`.
- A segunda metade da pergunta 1 (orquestrador em `tools/orquestrador/` ou repositório separado)
  ficou sem resposta clara. Registrei como P-010 em `known-gaps.md`.
- Os títulos das RN são rótulos de navegação criados por mim; o campo **Regra** é literal.
- Os achados da análise que originou esta tarefa **não foram verificados** por revisor: a análise foi
  interrompida a pedido da pessoa, para poupar cota. Por isso as P-001..P-013 estão marcadas como
  levantadas por agente.

## 6. Regras de negócio aplicadas

- RN-001..008 transcritas (não aplicadas em código).

## 7. O que NÃO foi feito e por quê

- ADRs da doc-fonte: TASK-003.
- `docs/testing-strategy.md` e `docs/security.md` continuam template: não fazem parte do contexto
  mínimo. Ficam para tarefa futura.
- `README.md` ainda descreve o template (e cita `src/` e `tests/`): reescrever numa tarefa futura.
- Nenhuma revisão cética nem revisão independente foi feita, para poupar cota.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Existe versão da documentação mais nova que a v0.1, ou respostas da Estação 1? (P-013) | não | | |
| 2 | Dados fictícios, rotulados como tal, podem ser usados nos testes até a tabela oficial chegar? (P-007) | sim, para testes do motor | | |
| 3 | Orquestrador: `tools/orquestrador/` ou repositório separado? (P-010) | não | | |
| 4 | Pendências herdadas da TASK-001: destino da TASK-001, apagar a branch dela, comentário do `ci.yml` (ver `handoffs/history/2026-09-26-TASK-001-encerramento.md` § 8) | não | | |

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Revisor (outra ferramenta ou sessão nova), depois Pessoa responsável

**O que fazer, concretamente:**
1. Revisor: conferir os CAs da TASK-002, com foco em "nada inventado". Os comandos estão "A VALIDAR",
   as RN estão literais e as citações da doc-fonte batem.
2. Pessoa: responder as pendências 1 e 2 e aprovar o PR.
3. Depois: TASK-003 (ADR-004..011 `Proposto`), seguida da tarefa de toolchain e dos esqueletos.

**Ler primeiro:**
1. `AGENTS.md`
2. este handoff
3. `tasks/in-progress/TASK-002-camada-1-simulador.md` § 3
4. `docs/business-rules.md` e `docs/known-gaps.md`

**Cuidado com:**
- `docs/produto/` agora é protegido (cópia congelada).
- Os números dos exemplos da doc-fonte são ilustrativos, não capacidades.

## 11. Como revisar este trabalho

- A cópia em `docs/produto/` não precisa de revisão linha a linha: confira o sha256.
- Os requisitos foram gerados por script (texto literal). Basta conferir a contagem e alguns IDs.
- A revisão de verdade está nos 4 documentos mínimos e em `known-gaps.md`.
