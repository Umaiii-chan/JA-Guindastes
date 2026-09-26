# TASK-033 — Criar as telas de catálogo (seleção e cadastro) no frontend

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-26 por Anderson Sehnem (leva C, em chat) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-033-telas-catalogo-e-selecao` (a partir de `d58edf6`) |
| **PR** | — |
| **Requisitos** | RF-001, RF-002, RF-005, RF-010 |
| **Regras de negócio** | RN-003, RN-006, RN-008; ADR-013 C-4 |
| **Estimativa** | M |

---

## 1. Objetivo

Na tela, escolher fabricante → guindaste → configuração em listas encadeadas (em vez de digitar o
`configuration_id`), cadastrar fabricante, guindaste e configuração com a ficha técnica, e ver os
limites dos sliders e os parâmetros a/h da pré-visualização vindos da ficha da configuração escolhida.

## 2. Contexto

- Os cadastros REST existem desde a TASK-030 (`handoffs/history/2026-09-26-TASK-030-implementacao.md`
  § 2, contrato); a avaliação na cena, desde a TASK-032, com a configuração num campo de texto.
- Os limites e a/h da cena eram os FICTÍCIOS da PoC (TASK-013/016).
- Leva C em paralelo: TASK-034 (painéis novos de tabela de carga; esta tarefa é dona de
  `frontend/src/app/App.tsx` e deixa o ponto de encaixe), TASK-035 (backend/docker), TASK-036
  (e2e/CI/`vite.config.ts`), TASK-037 (docs).

## 3. Critérios de aceite

- [ ] **CA-1** — Dado o backend com o catálogo, quando a tela abre, então a lista de fabricantes é
  carregada; ao escolher um fabricante, aparecem só os guindastes dele; ao escolher um guindaste, só
  as configurações dele; trocar o item de cima limpa as escolhas de baixo e respostas atrasadas de uma
  escolha antiga são descartadas. (`tests/application/catalog/CatalogBrowser.test.ts`)
- [ ] **CA-2** — Dado o cliente REST do catálogo, quando lista ou cria, então usa as rotas e os nomes
  de campo do backend (TASK-030) e trata 404/409 (mensagem do `detail`), 422 (erros por campo, com os
  nomes do frontend), outro HTTP, rede e resposta fora do contrato.
  (`tests/infrastructure/api/catalogRestClient.test.ts`)
- [ ] **CA-3** — Dado o formulário de configuração com a ficha, quando o cadastro dá certo, então a
  configuração entra na lista e fica escolhida; quando o backend responde 422, então cada erro aparece
  no campo correspondente (ou em lista à parte, se o campo não está no formulário) e a seleção não
  muda. Validação local básica antes de enviar (obrigatórios, número, ≥ 0, mínimo ≤ máximo, os dois
  limites de giro juntos). (`CatalogBrowser.test.ts`, `catalogForms.test.ts`, `catalogPanels.test.ts`)
- [ ] **CA-4** — Dada uma configuração escolhida com ficha, quando a cena monta, então os limites dos
  sliders e os parâmetros a/h da pré-visualização vêm da ficha; sem ψ_min/ψ_max o giro é contínuo;
  sem c_max o máximo do cabo é FICTÍCIO e rotulado; sem configuração, sem ficha ou com L_min = 0, os
  FICTÍCIOS de antes, rotulados. (`tests/app/craneSetup.test.ts`)
- [ ] **CA-5** — A configuração escolhida alimenta a sessão de avaliação (substitui o campo de texto
  de `configuration_id` da TASK-032).
- [ ] **CA-6** — Nenhum teste existente quebra; gates do frontend e `scripts/check-structure.sh` passam;
  nenhuma dependência nova.

## 4. Escopo

### Dentro do escopo

- `frontend/src/` (domínio, aplicação, infraestrutura, apresentação, composição e `src/three/` só para
  receber limites e a/h) e `frontend/tests/`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- Editar ou excluir cadastros (sem regra; pendência 2 da TASK-030).
- Painéis de importação/ativação de tabela de carga (TASK-034).
- `frontend/vite.config.ts` (TASK-036), backend, `docs/*.md`, `README.md`, `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

Lista verificada em `handoffs/TASK-033.md` § 3.

## 6. Riscos e dependências

- Depende das rotas da TASK-030, que só existem com `DATABASE_URL` definida no backend.
- Risco: conflito com a TASK-034 em `App.tsx` → mitigação: ponto de encaixe comentado no `aside`.

## 7. Teste manual

Ver `handoffs/TASK-033.md` § 11.

---

## 8. Plano

| # | Passo | Arquivos | Como verificar | Feito |
|---|-------|----------|----------------|-------|
| 1 | Tipos do catálogo, porta, cliente REST, `CatalogBrowser` e formulários, com testes | `src/domain/catalog/`, `src/application/catalog/`, `src/infrastructure/api/catalog*` | `npm test` | [x] |
| 2 | Cena recebe limites e a/h (`CraneSetup`); valores FICTÍCIOS em módulo sem Three.js | `src/three/` | testes de `three/` e `craneSetup` | [x] |
| 3 | Escolha do setup pela ficha, painéis de seleção e cadastro, composição na `App` | `src/app/`, `src/presentation/` | `npm test`, navegador | [x] |
| 4 | Gates, handoff | — | saída dos comandos | [x] |

## 9. Cenários de teste

| Cenário | Critério | Tipo | Arquivo de teste | Status |
|---------|----------|------|------------------|--------|
| listas encadeadas, limpeza e descarte de resposta atrasada | CA-1 | unitário (fetch falso) | `tests/application/catalog/CatalogBrowser.test.ts` | verde |
| rotas, corpos e erros 404/409/422/HTTP/rede/contrato | CA-2 | unitário (fetch falso) | `tests/infrastructure/api/catalogRestClient.test.ts` | verde |
| criação com sucesso e com 422 | CA-3 | unitário (fetch falso) | `CatalogBrowser.test.ts`, `catalogForms.test.ts` | verde |
| erro do 422 no campo, listas e aviso dos limites na tela | CA-3, CA-4 | render estático | `tests/presentation/panels/catalogPanels.test.ts` | verde |
| limites e a/h vindos da ficha; FICTÍCIOS rotulados | CA-4 | unitário | `tests/app/craneSetup.test.ts` | verde |

## 10. Parecer da revisão

Pendente (revisor independente).

## 11. Encerramento

—
