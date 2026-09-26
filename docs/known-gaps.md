# Limitações conhecidas e dívidas técnicas

> Este documento existe para que **nenhum agente presuma que algo funciona quando não funciona**.
> Qualquer pessoa ou agente pode adicionar itens. Só a pessoa responsável remove (quando resolvido,
> mova para a seção "Resolvidos" com a tarefa que resolveu).

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037, estado com a leva C — TASK-033..036 — integrada) |

---

## 1. Limitações funcionais

Coisas que o sistema **não faz** hoje, mesmo que pareça que deveria.

| # | Limitação | Impacto | Decisão / plano | Tarefa |
|---|-----------|---------|-----------------|--------|
| L-001 | O fluxo básico roda, pela tela e pela API: cadastro e seleção de fabricante → guindaste → configuração com ficha técnica, importação CSV/XLSX com relatório de inconsistências e ativação de tabela, carga (descrição, peso, dimensões, CG opcional), avaliação por WebSocket (REST de reserva) lendo do banco e painel com o resultado do backend; a demo FICTÍCIA é reproduzível pelo seed ([`demo.md`](demo.md)). **Não existem:** simulação persistida (`Simulation`, `SimulationState`, `SimulationResult`; RF-021/022), `SafetyValidator` e níveis de alerta (RF-019), upload/cadastro de modelo 3D (`Crane3DModel`, `CraneKinematics` no backend), exportação de resumo (RF-023), obstáculos (RF-024). Editar/excluir cadastros pela tela (L-006). A API de avaliação recebe só `load_weight_kg`: descrição, dimensões e CG da carga ficam na tela (a `Load` completa existe no backend só no domínio, via `execute_for_load`). A cena desenha o guindaste provisório; da ficha técnica vêm só os limites dos sliders e a/h | o fluxo de `project-overview.md` § 4 roda sem alertas e sem simulação salva | sem tarefa | TASK-022..035 |
| L-002 | Ainda não há tabela de carga oficial nem modelo 3D real do guindaste. Existe um GLB de exemplo FICTÍCIO (`assets/example-models/guindaste-provisorio.ficticio.glb`); os requisitos de um GLB real estão em `assets/example-models/README.md` | motor de cálculo, golden tests e demo não usam dados reais | depende da Guindastes Ribas (PEND-008; doc-fonte § 26, perguntas 1 a 5) | TASK-026 |
| L-003 | Sem autenticação nem autorização ("autenticação futura", doc-fonte § 8.4). Todas as rotas estão abertas, inclusive as de escrita: cadastro (`POST /manufacturers`, `/cranes`, `/cranes/{id}/configurations`), importação e **ativação** de tabelas, e o WebSocket (sem validação de `Origin`) | qualquer cliente que alcance a API pode mudar a tabela ativa, o que afeta a capacidade calculada; uso só local (portas em `127.0.0.1`) | ver P-009 | TASK-019, 030, 031 |
| L-004 | A composição usa a `ConservativeTabulatedLookup` (ADR-015, **provisória**): comprimento de lança tem de coincidir (±1e-6 m) com uma coluna da tabela (senão `BOOM_LENGTH_NOT_IN_CHART`); entre dois raios tabelados vale o ponto de **menor** capacidade; abaixo do menor ou acima do maior raio, "fora do domínio". A `ExactPointLookup` fica só como referência e nos testes. Não há interpolação, arredondamento nem nível de alerta | com o comprimento da lança fora das colunas da tabela, a avaliação volta "não avaliável"; a capacidade entre pontos é conservadora, não a oficial | trocar a estratégia atrás da porta `LoadChartInterpolator` quando PEND-001..003 forem respondidas | TASK-008, 020, 024 |
| L-005 | O PostgreSQL e o Docker não foram verificados na máquina de desenvolvimento: o Docker não sobe porque a virtualização do Windows está desativada | banco, migrations conectadas, testes de integração, seed, stack Docker e E2E contra a stack só são exercitados no CI (TASK-018, 027, 035, 036) | a pessoa ativa a "Plataforma de Máquina Virtual"/virtualização no BIOS e roda o teste manual da TASK-011 (`handoffs/current.md` § 7, item 6) | TASK-011 |
| L-006 | Catálogo só cria, lista e lê: não edita nem exclui (as FKs são `ON DELETE RESTRICT`); nomes não são únicos, não são normalizados nem têm tamanho máximo; sem paginação. A configuração tem só nome e ficha técnica: os atributos que selecionam a tabela estão pendentes (PEND-005) | cadastro errado não se corrige pela API | pendências TASK-022 § 8 e TASK-030 § 8 | TASK-022, 030 |
| L-007 | Ciclo de vida da tabela incompleto: a importação grava só `DRAFT`; a ativação leva `DRAFT → VALIDATED → ACTIVE` e rebaixa a `ACTIVE` anterior para `SUPERSEDED` (interpretação a confirmar); tabelas `INVALID` e o relatório de inconsistências **não são gravados**; não há `POST /load-charts/{id}/validate`, reativação de `SUPERSEDED` nem listagem de tabelas | rollback de versão e auditoria das importações recusadas não são possíveis | pendências TASK-022 § 8 e TASK-031 § 8 | TASK-022, 031 |
| L-008 | Stack Docker: desde a TASK-035, o backend tem `FILE_STORAGE_DIR=/data/load-charts` num volume nomeado e o healthcheck usa `/api/v1/health`. Continuam: migrations e seed só sob demanda (`docker compose run ...`); o healthcheck dá 200 mesmo com o banco `DOWN`; imagens base por tag, não por digest; `--ws-max-size` do uvicorn não configurado; o job `docker` do CI não roda o seed (o job `e2e` roda) | subir a stack não deixa o banco pronto sozinho | TASK-027 § 8 itens 3, 5 e 6; TASK-029 § 8 item 1; TASK-035 § 8 item 1 | TASK-027, 029, 035 |
| L-009 | Tela: a configuração é escolhida na seleção fabricante → guindaste → configuração (TASK-033); sem ficha técnica, os sliders usam os limites FICTÍCIOS do guindaste provisório (rotulados), e sem c_max na ficha o máximo do cabo é FICTÍCIO (15 m); a câmera não se ajusta ao tamanho do guindaste; o peso só vai para a avaliação quando o formulário de carga inteiro é válido (TASK-034); a tabela importada lista todos os pontos, sem paginação; sem backend com `DATABASE_URL`, a lista de fabricantes mostra só "HTTP 404"/"HTTP 502"; debounce (150/400 ms) e reconexão (2 s, sem limite nem backoff) provisórios; utilização com 2 casas e capacidade sem casas enquanto PEND-002 está aberta | valores fora das faixas da ficha voltam "não avaliável" pelo backend | pendências TASK-032 § 8, TASK-033 § 8, TASK-034 § 8 | TASK-032, 033, 034 |
| L-010 | Com `DATABASE_URL` definida mas o banco fora do ar, a avaliação REST responde 500 e o WebSocket responde `simulation.error` com `INTERNAL_ERROR`; não há timeout de conexão configurado (usa o do driver/SO); a saúde responde 200 com `database: DOWN` | respostas lentas e erros genéricos sem banco | pendências TASK-029 § 8 itens 1, 2 e 4 | TASK-029 |

---

## 2. Dívidas técnicas

Atalhos tomados conscientemente que precisam ser pagos.

| # | Dívida | Onde | Por que foi feito assim | Risco de não resolver | Tarefa |
|---|--------|------|-------------------------|-----------------------|--------|
| D-001 | `app` de compatibilidade que sobe **sem** as rotas que dependem de adapters; `tests/test_openapi.py` ainda o usa | `backend/app/presentation/api/main.py`, `backend/tests/test_openapi.py` | manter o contrato antigo enquanto a documentação apontava para ele (TASK-019 § 8 item 1) | alguém subir a API pelo comando antigo e não achar as rotas | TASK-019 |
| D-002 | `build_catalog_repository` não é usado pela composição (`create_database_app` monta o repositório do catálogo direto), só pelos testes | `backend/app/main.py`, `backend/tests/presentation/test_catalog.py` | sobra da mescla da TASK-030 com a TASK-029 (verificado nesta tarefa com `grep`) | leitor acreditar que as rotas do catálogo dependem dessa função | TASK-030 |
| D-003 | O parser XLSX importa funções privadas (`_read_header`, `_read_cell`) do parser CSV | `backend/app/infrastructure/importers/` | não divergir as regras dos dois formatos (TASK-023 § 8 item 6) | mudança no CSV quebrar o XLSX sem aviso | TASK-023 |
| D-004 | Casos de paridade de geometria transcritos no frontend em vez de um arquivo único lido por pytest e Vitest (ADR-013 C-7) | `frontend/tests/fixtures/geometryParityCases.ts` | a TASK-016 só podia tocar `frontend/` | os dois lados divergirem sem teste pegar | TASK-016 |
| D-005 | Contratos REST e WebSocket da avaliação com nomes diferentes (`status`/`result`, `queried_working_radius_m`/`queried_radius_m`, motivos com/sem categoria); o frontend trata os dois | `backend/app/presentation/api/evaluation_schemas.py`, `backend/app/presentation/websocket/evaluation_messages.py` | tarefas paralelas da leva A (TASK-024 e 025) | manutenção dobrada; cliente novo errar o formato | TASK-025 § 8 item 4, TASK-032 § 8 item 4 |
| D-006 | Arquivo-fonte fica órfão no storage quando a gravação da tabela falha depois dele (409/404) | `backend/app/application/use_cases/import_load_chart.py` | armazenamento endereçado pelo conteúdo, idempotente (TASK-031 § 8 item 8) | acúmulo de arquivos sem tabela | TASK-031 |
| D-007 | Sem porta de unidade de trabalho: ficha técnica e tabela são lidas em duas sessões (`READ COMMITTED`), não num mesmo instantâneo | `backend/app/main.py`, repositórios | nenhum caso de uso grava em mais de um repositório ainda (TASK-022 § 8 item 5; TASK-029 § 8 item 3) | leitura inconsistente numa ativação concorrente | TASK-022, 029 |
| D-010 | Toda a cena continua carregada na abertura da página: a divisão do pacote (D-008, resolvida) separou os arquivos, mas não há carregamento sob demanda (`import()`/`React.lazy`) | `frontend/src/presentation/components/CraneViewport.tsx` | fora do escopo da TASK-036 (`frontend/src`) | JS inicial maior (~560 kB do Three.js) | TASK-036 § 8 item 1 |

---

## 3. Problemas conhecidos (bugs)

| # | Problema | Como reproduzir | Contorno | Tarefa |
|---|----------|-----------------|----------|--------|
| — | nenhum registrado nos handoffs até a leva C | — | — | — |

---

## 4. Decisões pendentes

Perguntas sem resposta que bloqueiam ou influenciam trabalho futuro. A pessoa responsável decide e
o resultado vira ADR (arquitetural) ou RN (negócio). As PEND-001..008 da doc-fonte estão em
[`business-rules.md`](business-rules.md) → "Perguntas em aberto". Os itens P-001..013 são lacunas que
a doc-fonte v0.1 não cobre, levantadas na análise que originou a TASK-002; P-014 em diante vêm dos
handoffs das tarefas.

| # | Pergunta | Levantada por | Data | Bloqueia |
|---|----------|---------------|------|----------|
| P-001 | Convenções geométricas: sistema de coordenadas, unidade e zero dos ângulos, de onde se mede o raio de trabalho (eixo de giro? pino da lança?), referência da altura do gancho, offsets do pivô; convenção provisória: [ADR-013](decisions/ADR-013-convencoes-geometricas-provisorias.md) (Aceito em 2026-09-26; itens A VALIDAR com a empresa), implementada no backend (TASK-014) e no frontend (TASK-016) | agente (análise TASK-002) | 2026-09-26 | validação da geometria com a empresa; golden tests |
| P-002 | O que é "comprimento de lança" em lança telescópica, e como tratar comprimentos entre as colunas da tabela; convenção provisória: [ADR-013](decisions/ADR-013-convencoes-geometricas-provisorias.md); hoje, comprimento fora das colunas volta "não suportado" ([ADR-015](decisions/ADR-015-consulta-conservadora-provisoria.md)) | agente (análise TASK-002) | 2026-09-26 | `LoadChartInterpolator` definitivo (junto com PEND-001) |
| P-003 | Onde o domínio guarda a geometria de cálculo do guindaste; hoje: ficha técnica nas colunas de `crane_configurations` (TASK-022), cadastrada pela API (TASK-030); se guarda documento/revisão de origem de cada valor (ADR-013 C-4) continua aberto (TASK-014 § 8 item 4, TASK-022 § 8 item 3) | agente (análise TASK-002) | 2026-09-26 | rastreabilidade da ficha técnica |
| P-004 | Geometria calculada no frontend (`getOperationalGeometry`) e no backend: como evitar divergência; hoje há paridade parcial por casos transcritos (TASK-016; D-004) e o painel mostra o raio do backend ao lado da pré-visualização (TASK-032) | agente (análise TASK-002) | 2026-09-26 | arquivo único de paridade |
| P-005 | Status provisório dos alertas enquanto a PEND-004 não é respondida (os exemplos da doc-fonte já usam `WARNING`); se carga = capacidade é violação; se a carga comparada é bruta (PEND-006). Hoje não há `SafetyValidator`; o peso comparado passa por `weight_compared_with_capacity` (TASK-028), ponto único onde a PEND-006 entrará | agente (análise TASK-002) | 2026-09-26 | `SafetyValidator`, RF-019 |
| P-006 | Formato canônico interno de importação enquanto a PEND-008 está aberta. Provisório: CSV UTF-8 com cabeçalho `boom_length_m,working_radius_m,max_capacity_kg` (unidade pelo sufixo; TASK-010) e XLSX no mesmo formato, só a primeira planilha (TASK-023) | agente (análise TASK-002) | 2026-09-26 | importação de tabela real |
| P-007 | Dados de teste: ~~usar dados fictícios, rotulados como tal, até a tabela oficial chegar?~~ **Sim, só em testes e rotulados FICTÍCIO** (pessoa, 2026-09-26; ADR-012). Ainda em aberto: os dados oficiais podem ir para o repositório e para agentes de IA? Qual tolerância nos golden tests? | agente (análise TASK-002) | 2026-09-26 | testes do motor de cálculo |
| P-008 | Requisitos de segurança dos uploads GLB/XLSX/CSV. Limites **provisórios** em uso: arquivo ≤ 1 MiB e corpo ≤ 1 MiB + 16 KiB (TASK-019); XLSX ≤ 10 MiB descompactado e ≤ 10 000 linhas (TASK-031); mensagem WebSocket ≤ 8 KiB (TASK-025); `client_max_body_size 10m` no nginx (TASK-027). Em aberto: valores definitivos, limite de linhas do CSV, `defusedxml`, limite configurável por variável, limites do GLB | agente (análise TASK-002) | 2026-09-26 | uso fora do ambiente local |
| P-009 | Autenticação e autorização no MVP (quem pode cadastrar, importar e ativar tabelas), CORS e validação de `Origin` e limite de taxa no WebSocket | agente (análise TASK-002) | 2026-09-26 | expor a API fora da máquina (L-003) |
| P-010 | Onde fica o orquestrador de agentes: `tools/orquestrador/` neste repositório ou repositório separado | pessoa (ADR-003) | 2026-09-26 | orquestrador |
| P-011 | O que `homologation` e `production` (ADR-002) significam num projeto acadêmico; haverá demo hospedada? | agente (análise TASK-002) | 2026-09-26 | CI/deploy |
| P-012 | Equipe: quantas pessoas trabalham no repositório, quem aprova PRs e regras de negócio, e qual a política do curso sobre uso de IA | agente (análise TASK-002) | 2026-09-26 | fluxo de revisão |
| P-013 | Existe versão da documentação mais nova que a v0.1 (13/08/2026), ou respostas da Estação 1 às PEND? | agente (análise TASK-002) | 2026-09-26 | toda a Camada 1 |
| P-014 | Aceitar o ADR-014 (SQLAlchemy 2 + psycopg 3) e a licença LGPL-3.0 do psycopg | agente (TASK-011, 018) | 2026-09-26 | nada (já em uso) |
| P-015 | Ferramenta de auditoria de dependências (e se roda no CI) | agente (TASK-011 § 8 item 6) | 2026-09-26 | `policies/security.md` § 4 |
| P-016 | Licença do projeto | agente (TASK-012) | 2026-09-26 | publicação |
| P-017 | Regras de ativação da tabela: rebaixar a `ACTIVE` anterior para `SUPERSEDED` automaticamente, `DRAFT → VALIDATED` automático, 409 ao reativar, gravar tabelas `INVALID` (TASK-022 § 8 itens 1 e 4; TASK-031 § 8 itens 1–4) | agente (TASK-022, 031) | 2026-09-26 | RN de ciclo de vida da tabela |

### 4.1 Outras perguntas abertas nos handoffs

Sem bloqueio, todas sem resposta até a leva C. Resumo por tema; a pergunta exata está na § 8 do
handoff indicado (`handoffs/history/2026-09-26-TASK-NNN-implementacao.md`; para a TASK-033..036,
`handoffs/TASK-NNN.md` até serem arquivados).

| Tema | Onde |
|------|------|
| Domínio da tabela de carga (tolerâncias, capacidade 0 kg, valores a menos de ε) | TASK-008 (11 perguntas), TASK-010 (12), TASK-015 itens 1–6, TASK-020 itens 1–2 |
| Geometria (erro × resultado com violações, limites de giro, comparação sem tolerância, normalização do giro, R < 0 no frontend) | TASK-013 item 1, TASK-014 itens 1–3, TASK-016 itens 2–3 |
| Carga (peso 0 kg, dimensões nulas, descrição obrigatória, referencial do CG, orientação; na tela: peso só com a carga toda válida, CG pela metade) | TASK-028 itens 1–6, TASK-034 itens 1, 2 e 4 |
| Importação (primeira planilha, fórmulas, 415 × CSV, texto numérico, `/validate` ao lado do `/import`, `chart_id` do cliente, configuração inexistente como 404) | TASK-019 itens 2–5, TASK-023 itens 1–5, TASK-031 itens 4–9 |
| API de avaliação (rota avulsa × simulações, `CONFIGURATION_NOT_FOUND`, `crane_id`, mensagens legíveis dos motivos, carga completa na API) | TASK-024 itens 1–4, TASK-029 item 5 |
| WebSocket (rota provisória, limite, `sequence` negativo/repetido, `Origin`, textos de erro) | TASK-025 itens 1–6 |
| Modelo 3D (pose de repouso, avisos de calibração, onde fica o mapa de nós) | TASK-026 itens 1–4 |
| Docker (digest das imagens, migrations automáticas, teste de fumaça, healthcheck com banco `DOWN`, seed no job `docker`) | TASK-027 itens 3, 5 e 6, TASK-029 item 1, TASK-035 item 1 |
| Tela (fallback REST, debounce/reconexão, casas decimais, cabo sem c_max, ficha com L_min = 0, item recém-cadastrado escolhido, aviso de backend sem `DATABASE_URL`, tabelas com muitos pontos) | TASK-032 itens 1–4, TASK-033 itens 1–4, TASK-034 item 3 |
| Demonstração (valores FICTÍCIOS servem para a banca, ids fixos `demo-ficticio-*`, timeout de conexão do seed) | TASK-035 itens 2–4 |
| E2E e build (cena sob demanda, job `e2e` obrigatório ou informativo) | TASK-036 itens 1 e 3 |
| Documentação protegida ("Testes relacionados" de RN-001, 004, 005, 007 e 008 em `business-rules.md`, pela pessoa) | TASK-015 item 8, TASK-020 item 5, TASK-025 § 10, TASK-028 § 10 |

---

## 5. O que os agentes NÃO devem presumir

Lista explícita. Se está aqui, o agente deve **verificar** antes de depender.

- que existe simulação persistida, `SafetyValidator`, nível de alerta, upload de modelo 3D ou autenticação: ainda não (2026-09-26, leva C)
- que o E2E cobre cadastro e importação pela tela: cobre a cena, o catálogo carregando e a avaliação com os dados semeados ([`testing-strategy.md`](testing-strategy.md) § 2)
- que a API tem persistência sem `DATABASE_URL`: sem ela, a avaliação volta `NOT_EVALUABLE` e as rotas de catálogo e de tabelas gravadas não existem; as de importação com gravação exigem também `FILE_STORAGE_DIR`
- que a capacidade mostrada é a oficial: vem da consulta conservadora provisória (ADR-015) sobre dados FICTÍCIOS
- que os números dos exemplos da doc-fonte (§§ 14.2, 14.3 e 15.4: raio 13,5 m, capacidade 5200 kg etc.) são capacidades reais ou casos de teste: são ilustrativos
- que existe regra de interpolação, arredondamento, nível de alerta ou extrapolação: estão pendentes (PEND-001..004, RN-007)
- que o modelo 3D define capacidade ou geometria de cálculo: não define (RN-003; P-003)
- que o formato das tabelas da empresa é conhecido: não é (PEND-008); o CSV/XLSX aceito é provisório (P-006)
- que banco, migrations e Docker foram verificados localmente: só no CI (L-005)
- que `codex` ou `gemini` estão instalados: em 2026-09-26 só o `claude` (Claude Code 2.1.280) estava no PATH (ADR-003)
- que os termos de uso das assinaturas permitem automação local via CLI: não confirmado para nenhum fornecedor (ADR-003, princípio (e))
- que `claude -p` consome a cota da assinatura, e não crédito de API, nem qual é o formato do JSON de saída: não verificado, `claude -p` nunca foi executado (ADR-003, "Evidências")

---

## 6. Áreas sem cobertura de testes

Cópia de [`testing-strategy.md`](testing-strategy.md) § 7 para ficar visível aqui.

- E2E: não cobre cadastro pela tela, importação/ativação de tabela pela tela nem o WebSocket de forma explícita (o teste semeado aceita o resultado por qualquer transporte); o job `e2e` não foi executado localmente (Docker indisponível; TASK-036 § 7).
- Componentes React com interação no Vitest (exigiriam jsdom/Testing Library, dependências não autorizadas): a interação só é coberta pelos poucos fluxos do E2E e por verificação manual.
- Integração com banco na máquina de desenvolvimento: só no CI (L-005).
- WebSocket contra um servidor uvicorn real e pelo proxy do nginx (o job `docker` testa o proxy só com REST).
- Casos de paridade backend × frontend num arquivo único (hoje transcritos; D-004).
- Conferência automática dos tipos do frontend contra os schemas REST/WebSocket do backend.
- Usabilidade da interface 3D e desempenho interativo (RNF-003 sem meta).
- Cálculos contra a tabela oficial (golden tests): não há tabela oficial (L-002).
- Cobertura de código não é medida (sem ferramenta configurada).

---

## 7. Resolvidos

Histórico do que saiu das seções acima.

| # | Item | Resolvido em | Tarefa / PR |
|---|------|--------------|-------------|
| D-008 | O build do frontend avisava que o pacote passava de 500 kB (Three.js inteiro, um chunk de 806,91 kB; TASK-013 § 8 item 3). Resolvido pela divisão em `react`, `three-core`, `three`, `three-addons` e aplicação, sem o aviso; o carregamento sob demanda continua como D-010. Fechada na TASK-037, a pedido da sessão principal | 2026-09-26 | TASK-036 (PR #34) |
| D-009 | `EvaluationInputPanel.tsx` (campo de peso da TASK-032) ficou sem uso na mescla da leva C, porque o peso passou a vir do painel "Carga". Removido na branch da leva C | 2026-09-26 | TASK-033 (PR #34) |
