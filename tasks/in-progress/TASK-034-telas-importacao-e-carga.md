# TASK-034 — Criar as telas de importação/ativação de tabela de carga e de carga

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por pessoa responsável (leva C, via sessão principal) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | |
| **Branch** | `task/TASK-034-telas-importacao-e-carga` (a partir de `d58edf6`) |
| **PR** | |
| **Requisitos** | RF-006, RF-007, RF-008, RF-011, RNF-006 |
| **Regras de negócio** | RN-001, RN-005, RN-006 |
| **Estimativa** | M |

---

## 1. Objetivo

No frontend, importar uma tabela de carga (CSV/XLSX), ver o relatório de inconsistências ou os
pontos gravados em `DRAFT`, ativá-la (vendo a tabela substituída) e informar a carga da simulação,
cujo peso alimenta a avaliação.

## 2. Contexto

- Contrato do backend: `handoffs/history/2026-09-26-TASK-031-implementacao.md` (importação com
  gravação e ativação) e TASK-019 (`/validate`, formato do relatório).
- Validações provisórias da carga: `handoffs/history/2026-09-26-TASK-028-implementacao.md`
  (`backend/app/domain/entities/load.py`).
- Paralelas da leva C: TASK-033 (dona de `App.tsx` e do catálogo), TASK-035, TASK-036.

## 3. Critérios de aceite

- [ ] **CA-1** — Dado um arquivo, configuration_id, chart_id e versão, quando envio e o backend
  responde 201, então vejo o status `DRAFT`, os dados da tabela e os pontos.
- [ ] **CA-2** — Quando o backend responde 422 com relatório, então vejo cada inconsistência com
  linha, coluna, código e mensagem, e nada para ativar.
- [ ] **CA-3** — Quando o backend responde 404, 409, 413 ou 415 (ou há falha de rede), então vejo
  uma mensagem clara do erro, com o detalhe do backend quando houver.
- [ ] **CA-4** — Dada uma tabela importada, quando clico em "Ativar", então vejo a tabela `ACTIVE`
  e a tabela substituída (`SUPERSEDED`), ou que não havia tabela ativa.
- [ ] **CA-5** — O painel de importação usa a configuração recebida por prop (a selecionada na
  tela); sem a prop, mostra um campo próprio.
- [ ] **CA-6** — No painel de carga (RF-011), descrição, peso, dimensões e CG opcional seguem as
  validações provisórias do domínio (peso > 0, dimensões > 0, CG dentro da caixa) com mensagens
  por campo.
- [ ] **CA-7** — O peso de uma carga válida é exposto ao App (`onLoadWeightTextChange`) e alimenta
  a avaliação; carga inválida → texto vazio (avaliação aguarda).
- [ ] **CA-8** — Testes Vitest com `fetch` falso cobrem 201, 422 com relatório, 415, ativação com
  `SUPERSEDED` e as validações da carga; nenhum teste existente quebra.
- [ ] **CA-9** — Gates do frontend (`npm ci`, `lint`, `format:check`, `typecheck`, `test`, `build`)
  e `bash scripts/check-structure.sh` passam; nenhuma dependência nova.

## 4. Escopo

### Dentro do escopo

- Arquivos novos em `frontend/src/{application,infrastructure,presentation}/` e testes novos.
- Alteração mínima em `frontend/src/app/App.tsx` (um import e um bloco).

### Fora do escopo

- Catálogo/seleção de configuração (TASK-033); backend, Docker (TASK-035); e2e/CI (TASK-036).
- Enviar a carga inteira ao backend (a avaliação só recebe o peso).
- Documentação em `docs/`, `README.md` e `handoffs/current.md` (protocolo da leva C).

## 5. Arquivos afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/application/loadChart/ports.ts` | criar | sim |
| `frontend/src/application/loadChart/importForm.ts` | criar | sim |
| `frontend/src/application/load/loadForm.ts` | criar | sim |
| `frontend/src/infrastructure/api/loadChartRestClient.ts` | criar | sim |
| `frontend/src/presentation/panels/LoadChartImportPanel.tsx` | criar | sim |
| `frontend/src/presentation/panels/LoadPanel.tsx` | criar | sim |
| `frontend/src/presentation/panels/LoadChartAndLoadPanels.tsx` | criar | sim |
| `frontend/src/app/App.tsx` | alterar (import + bloco) | sim |
| `frontend/tests/...` (4 arquivos de teste + 1 fixture) | criar | sim |

## 6. Riscos e dependências

- Conflito em `App.tsx` com a TASK-033 → mitigação: mudança de 5 linhas; a sessão principal mescla.
- Campo de peso duplicado até a mescla (o da TASK-032 continua em `EvaluationInputPanel`) → ver
  handoff § 8.

## 7. Teste manual

1. Subir backend com `DATABASE_URL` e `FILE_STORAGE_DIR` e `npm run dev`; informar configuração,
   chart_id, versão e um CSV FICTÍCIO; Enviar. **Esperado:** status DRAFT e pontos.
2. Clicar em Ativar. **Esperado:** ACTIVE e a substituída (ou "nenhuma foi substituída").
3. Preencher a carga. **Esperado:** mensagens por campo; com carga válida, a avaliação usa o peso.

NÃO EXECUTADO nesta etapa (sem banco local; pendência geral 6 de `handoffs/current.md`).

## 8. Plano

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Porta, formulário e cliente REST | `application/loadChart/*`, `infrastructure/api/loadChartRestClient.ts` | testes do cliente | [x] |
| 2 | Formulário da carga | `application/load/loadForm.ts` | testes da carga | [x] |
| 3 | Painéis e composição | `presentation/panels/*`, `App.tsx` | testes estáticos, build | [x] |

## 9. Cenários de teste

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| multipart e 201 → DRAFT com pontos | CA-1 | unitário | `tests/infrastructure/api/loadChartRestClient.test.ts` | verde |
| 422 com relatório → INVALID | CA-2 | unitário | idem + `tests/presentation/panels/LoadChartImportPanel.test.ts` | verde |
| 404/409/413/415/500/rede/fora do contrato | CA-3 | unitário | idem | verde |
| ativação com SUPERSEDED e sem anterior; 404/409 | CA-4 | unitário | idem | verde |
| configuração por prop ou campo | CA-5 | unitário | `tests/presentation/panels/LoadChartImportPanel.test.ts` | verde |
| validações da carga | CA-6 | unitário | `tests/application/load/loadForm.test.ts` + painel | verde |
| peso para a avaliação | CA-7 | unitário | `tests/application/load/loadForm.test.ts` | verde |
| formulário de importação | CA-1 | unitário | `tests/application/loadChart/importForm.test.ts` | verde |

## 10. Parecer da revisão

Pendente.

## 11. Encerramento

Pendente.
