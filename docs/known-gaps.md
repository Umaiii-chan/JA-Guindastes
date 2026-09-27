# Limitações conhecidas e dívidas técnicas

> Este documento existe para que **nenhum agente presuma que algo funciona quando não funciona**.
> Qualquer pessoa ou agente pode adicionar itens. Só a pessoa responsável remove (quando resolvido,
> mova para a seção "Resolvidos" com a tarefa que resolveu).

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-045, estado com a leva D — TASK-038..043 — integrada; TASK-044 em andamento) |

---

## 1. Limitações funcionais

Coisas que o sistema **não faz** hoje, mesmo que pareça que deveria.

| # | Limitação | Impacto | Decisão / plano | Tarefa |
|---|-----------|---------|-----------------|--------|
| L-001 | O fluxo básico roda, pela tela e pela API, com login e perfis quando há banco (ADR-016): cadastro e seleção de fabricante → guindaste → configuração com ficha técnica, importação CSV/XLSX com relatório de inconsistências e ativação de tabela, carga (descrição, peso, dimensões, CG opcional), avaliação por WebSocket (REST de reserva) lendo do banco, simulador guiado com o resultado do backend e gestão de usuários pelo admin; a demo FICTÍCIA é reproduzível pelo seed ([`demo.md`](demo.md)). **Não existem:** simulação persistida (`Simulation`, `SimulationState`, `SimulationResult`; RF-021/022), `SafetyValidator` e níveis de alerta (RF-019), upload/cadastro de modelo 3D (`Crane3DModel`, `CraneKinematics` no backend), exportação de resumo (RF-023), obstáculos (RF-024). Editar/excluir cadastros de verdade (L-006, L-011). A API de avaliação recebe só `load_weight_kg`: descrição, dimensões e CG da carga ficam na tela (as dimensões só desenham a caixa no gancho; a `Load` completa existe no backend só no domínio, via `execute_for_load`). A cena desenha o modelo **ilustrativo** do caminhão (L-002, L-012); da ficha técnica vêm só os limites dos sliders e a/h | o fluxo de `project-overview.md` § 4 roda sem alertas e sem simulação salva | sem tarefa | TASK-022..043 |
| L-002 | Ainda **não há tabela de carga oficial**: todas as tabelas são FICTÍCIAS. Há um modelo 3D **ilustrativo** do guindaste sobre caminhão (`frontend/public/models/guindaste-caminhao.glb`, convertido de um FBX comercial do CGTrader com licença confirmada; TASK-043), que não é o guindaste real da empresa nem define medidas de cálculo (RN-003); a ficha FICTÍCIA de demo passou a a = −1,56 m para bater com ele. Continua o GLB de exemplo FICTÍCIO do guindaste provisório (`assets/example-models/guindaste-provisorio.ficticio.glb`); os requisitos de um GLB real estão em `assets/example-models/README.md` | motor de cálculo, golden tests e demo não usam dados reais; o visual não é o equipamento da empresa | tabela oficial e modelo real dependem da Guindastes Ribas (PEND-008; doc-fonte § 26, perguntas 1 a 5) | TASK-026, 043 |
| L-004 | A composição usa a `ConservativeTabulatedLookup` (ADR-015, **provisória**): comprimento de lança tem de coincidir (±1e-6 m) com uma coluna da tabela (senão `BOOM_LENGTH_NOT_IN_CHART`); entre dois raios tabelados vale o ponto de **menor** capacidade; abaixo do menor ou acima do maior raio, "fora do domínio". A `ExactPointLookup` fica só como referência e nos testes. Não há interpolação, arredondamento nem nível de alerta | com o comprimento da lança fora das colunas da tabela, a avaliação volta "não avaliável"; a capacidade entre pontos é conservadora, não a oficial | trocar a estratégia atrás da porta `LoadChartInterpolator` quando PEND-001..003 forem respondidas | TASK-008, 020, 024 |
| L-005 | O PostgreSQL e o Docker não foram verificados na máquina de desenvolvimento: o Docker não sobe porque a virtualização do Windows está desativada | banco, migrations conectadas, testes de integração, seed, stack Docker e E2E contra a stack só são exercitados no CI (TASK-018, 027, 035, 036) | a pessoa ativa a "Plataforma de Máquina Virtual"/virtualização no BIOS e roda o teste manual da TASK-011 (`handoffs/current.md` § 7, item 6) | TASK-011 |
| L-006 | Catálogo só cria, lista e lê: não edita nem exclui (as FKs são `ON DELETE RESTRICT`); nomes não são únicos, não são normalizados nem têm tamanho máximo; sem paginação. A configuração tem só nome e ficha técnica: os atributos que selecionam a tabela estão pendentes (PEND-005) | cadastro errado não se corrige pela API; na tela, "Editar" grava uma cópia (L-011) | edição: **em andamento (TASK-044)**; exclusão, unicidade e PEND-005: pendências TASK-022 § 8 e TASK-030 § 8 | TASK-022, 030 |
| L-007 | Ciclo de vida da tabela incompleto: a importação grava só `DRAFT`; a ativação leva `DRAFT → VALIDATED → ACTIVE` e rebaixa a `ACTIVE` anterior para `SUPERSEDED` (interpretação a confirmar); tabelas `INVALID` e o relatório de inconsistências **não são gravados**; não há `POST /load-charts/{id}/validate`, reativação de `SUPERSEDED` nem listagem de tabelas por configuração | rollback de versão e auditoria das importações recusadas não são possíveis; a página Tabelas só lista as versões que o navegador conhece (L-011) | listagem: **em andamento (TASK-044)**; o resto: pendências TASK-022 § 8 e TASK-031 § 8 | TASK-022, 031 |
| L-008 | Stack Docker: desde a TASK-035, o backend tem `FILE_STORAGE_DIR=/data/load-charts` num volume nomeado e o healthcheck usa `/api/v1/health`. Continuam: migrations e seed só sob demanda (`docker compose run ...`); o healthcheck dá 200 mesmo com o banco `DOWN`; imagens base por tag, não por digest; `--ws-max-size` do uvicorn não configurado; o job `docker` do CI não roda o seed (o job `e2e` roda) | subir a stack não deixa o banco pronto sozinho | TASK-027 § 8 itens 3, 5 e 6; TASK-029 § 8 item 1; TASK-035 § 8 item 1 | TASK-027, 029, 035 |
| L-009 | Tela: a configuração é escolhida na seleção fabricante → guindaste → configuração (TASK-033); sem ficha técnica, os sliders usam os limites FICTÍCIOS do guindaste provisório (rotulados), e sem c_max na ficha o máximo do cabo é FICTÍCIO (15 m); a câmera não se ajusta ao tamanho do guindaste; o peso só vai para a avaliação quando o formulário de carga inteiro é válido (TASK-034); a tabela importada lista todos os pontos, sem paginação; sem backend com `DATABASE_URL`, a lista de fabricantes mostra só "HTTP 404"/"HTTP 502"; debounce (150/400 ms) e reconexão (2 s, sem limite nem backoff) provisórios; utilização com 2 casas e capacidade sem casas enquanto PEND-002 está aberta | valores fora das faixas da ficha voltam "não avaliável" pelo backend | pendências TASK-032 § 8, TASK-033 § 8, TASK-034 § 8 | TASK-032, 033, 034 |
| L-011 | Rotas de backend que as páginas da leva D precisam e que faltaram na TASK-042: (1) listar as tabelas de uma configuração; (2) saber a tabela ativa; (3) editar fabricante, guindaste e configuração. Contornos no frontend: a linha do tempo de versões usa os ids que o navegador guardou no `localStorage` (`knownChartsStorage`) ou que se acompanham pelo id; o detalhe do Catálogo mostra "Nenhuma tabela ativa conhecida" quando o navegador não conhece a ativa; "Editar" grava uma cópia como item novo, com aviso. Também: o `/load-charts/validate` só lê CSV, então XLSX fica "não verificado" até a importação | a lista de versões e a ativa dependem do navegador usado; cadastro não se corrige | (1) a (3): **em andamento (TASK-044)**; `/validate` com XLSX: sem tarefa (TASK-042 § 8 item 4) | TASK-042, 044 |
| L-012 | Cena e modelo 3D (TASK-041, 043): o guindaste provisório aparece por uma fração de segundo antes do GLB; com ficha de outra configuração (a, h ou L_min diferentes do modelo), o GLB é usado mesmo assim, com aviso de calibração no console (erro só visual, sem critério de recusa, G-7); o olho da câmera do operador é achado pelo nome das malhas de vidro do GLB; a carga pende do fundo do moitão, cerca de 2,4 m abaixo de G, e pode entrar no chão com cabo curto; as três seções da lança se movem juntas (o controller tem uma extensão só); o GLB tem 1,81 MiB, sem compressão (Draco/meshopt) | só visual: o cálculo não usa o modelo | pendências TASK-041 § 8 item 2 e § 12.5, TASK-043 § 7 | TASK-041, 043 |
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
| D-011 | Limite de tentativas de login em memória, por processo (5 falhas por username em 15 min) | `backend/app/infrastructure/security/login_attempt_limiter.py` | basta para o MVP local com uma réplica (ADR-016 § 3) | com mais de uma réplica, cada uma conta à parte; reiniciar o backend zera o limite | TASK-038 § 8 item 4 |
| D-012 | `PATCH /api/v1/users/{id}` monta o estado novo a partir de uma leitura feita antes da trava: um campo que não foi enviado pode sobrescrever uma mudança simultânea desse campo (atualização perdida). A regra do último admin não é afetada, porque é conferida sob trava | `backend/app/application/use_cases/manage_users.py`, `backend/app/infrastructure/repositories/sqlalchemy_user_repository.py` | a trava cobre só a invariante do admin (TASK-038 § 11) | dois admins editando o mesmo usuário ao mesmo tempo perdem uma das mudanças | TASK-038 § 11 |
| D-013 | Desempenho da cena não medido: o critério de 60 fps num notebook comum (TASK-041 CA-6) ficou sem medição em hardware real; só houve SwiftShader (CPU), que não serve de referência. A cena desenha sob demanda e o GLB tem cerca de 103 mil triângulos com sombra | `frontend/src/three/scene/mountCraneScene.ts` | não havia GPU na máquina de desenvolvimento | travamentos em GPU fraca sem ninguém saber; o `backdrop-filter` dos painéis também pesa (ADR-017, riscos) | TASK-041 § 7 e § 12.5 |
| D-014 | Situação "atenção" (`warning`, âmbar) existe no tipo, na paleta da cena e nos tokens, mas não é usada: não há critério enquanto a PEND-004 (níveis de alerta) está aberta. Hoje só `ok` (até 100 %, inclusive), `over` (acima de 100 %) e `unknown` | `frontend/src/application/evaluation/evaluationStatus.ts`, `frontend/src/three/scene/palette.ts`, `frontend/src/presentation/theme/tokens.css` | não inventar regra (RN-008, PEND-004) | a faixa âmbar precisa entrar no medidor e na cena quando o critério vier | TASK-039 § 8 item 2, TASK-041 § 8 item 1 |
| D-015 | As cores de situação estão duplicadas em `palette.ts` (cena) e `tokens.css` (UI), sem teste que compare as duas | `frontend/src/three/scene/palette.ts`, `frontend/src/presentation/theme/tokens.css` | a TASK-039 não tinha o `palette.ts` na branch (TASK-039 § 5, decisão 3) | as duas divergirem sem aviso | TASK-039 § 10 item 3 |
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
| P-005 | Status provisório dos alertas enquanto a PEND-004 não é respondida (os exemplos da doc-fonte já usam `WARNING`); carga = capacidade **não** é violação (utilização de 100 % aparece como dentro do limite, em verde: decisão da pessoa responsável em chat, 2026-09-26); se a carga comparada é bruta (PEND-006). Hoje não há `SafetyValidator`; o peso comparado passa por `weight_compared_with_capacity` (TASK-028), ponto único onde a PEND-006 entrará | agente (análise TASK-002) | 2026-09-26 | `SafetyValidator`, RF-019 |
| P-006 | Formato canônico interno de importação enquanto a PEND-008 está aberta. Provisório: CSV UTF-8 com cabeçalho `boom_length_m,working_radius_m,max_capacity_kg` (unidade pelo sufixo; TASK-010) e XLSX no mesmo formato, só a primeira planilha (TASK-023) | agente (análise TASK-002) | 2026-09-26 | importação de tabela real |
| P-007 | Dados de teste: ~~usar dados fictícios, rotulados como tal, até a tabela oficial chegar?~~ **Sim, só em testes e rotulados FICTÍCIO** (pessoa, 2026-09-26; ADR-012). Ainda em aberto: os dados oficiais podem ir para o repositório e para agentes de IA? Qual tolerância nos golden tests? | agente (análise TASK-002) | 2026-09-26 | testes do motor de cálculo |
| P-008 | Requisitos de segurança dos uploads GLB/XLSX/CSV. Limites **provisórios** em uso: arquivo ≤ 1 MiB e corpo ≤ 1 MiB + 16 KiB (TASK-019); XLSX ≤ 10 MiB descompactado e ≤ 10 000 linhas (TASK-031); mensagem WebSocket ≤ 8 KiB (TASK-025); `client_max_body_size 10m` no nginx (TASK-027). Em aberto: valores definitivos, limite de linhas do CSV, `defusedxml`, limite configurável por variável, limites do GLB | agente (análise TASK-002) | 2026-09-26 | uso fora do ambiente local |
| P-009 | ~~Autenticação e autorização no MVP (quem pode cadastrar, importar e ativar tabelas) e validação de `Origin` no WebSocket~~ **Respondidas** pelo [ADR-016](decisions/ADR-016-autenticacao-e-perfis.md) e implementadas na TASK-038/040 (L-003 em "Resolvidos"). Ainda em aberto: limite de taxa de mensagens no WebSocket e CORS, se um dia houver outra origem | agente (análise TASK-002) | 2026-09-26 | expor a API fora da máquina |
| P-010 | Onde fica o orquestrador de agentes: `tools/orquestrador/` neste repositório ou repositório separado | pessoa (ADR-003) | 2026-09-26 | orquestrador |
| P-011 | O que `homologation` e `production` (ADR-002) significam num projeto acadêmico; haverá demo hospedada? | agente (análise TASK-002) | 2026-09-26 | CI/deploy |
| P-012 | Equipe: quantas pessoas trabalham no repositório, quem aprova PRs e regras de negócio, e qual a política do curso sobre uso de IA | agente (análise TASK-002) | 2026-09-26 | fluxo de revisão |
| P-013 | Existe versão da documentação mais nova que a v0.1 (13/08/2026), ou respostas da Estação 1 às PEND? | agente (análise TASK-002) | 2026-09-26 | toda a Camada 1 |
| P-014 | Aceitar o ADR-014 (SQLAlchemy 2 + psycopg 3) e a licença LGPL-3.0 do psycopg | agente (TASK-011, 018) | 2026-09-26 | nada (já em uso) |
| P-015 | Ferramenta de auditoria de dependências (e se roda no CI) | agente (TASK-011 § 8 item 6) | 2026-09-26 | `policies/security.md` § 4 |
| P-016 | Licença do projeto | agente (TASK-012) | 2026-09-26 | publicação |
| P-018 | Aceitar o código `409 OWN_ADMIN_ACCESS` (admin tentando se desativar ou se rebaixar) como complemento do contrato do ADR-016 § 4 | agente (TASK-038 § 8 item 1) | 2026-09-26 | nada (já em uso no backend e na página Usuários) |
| P-019 | Trocar a senha deveria revogar as outras sessões do usuário? Hoje não revoga (o ADR-016 não pede) | agente (TASK-038 § 8 item 5) | 2026-09-26 | nada |
| P-017 | Regras de ativação da tabela: rebaixar a `ACTIVE` anterior para `SUPERSEDED` automaticamente, `DRAFT → VALIDATED` automático, 409 ao reativar, gravar tabelas `INVALID` (TASK-022 § 8 itens 1 e 4; TASK-031 § 8 itens 1–4) | agente (TASK-022, 031) | 2026-09-26 | RN de ciclo de vida da tabela |

### 4.1 Outras perguntas abertas nos handoffs

Sem bloqueio, todas sem resposta até a leva D, salvo onde indicado. Resumo por tema; a pergunta
exata está na § 8 do handoff indicado (`handoffs/history/2026-09-26-TASK-NNN-implementacao.md`; para
a TASK-033..043, `handoffs/TASK-NNN.md` até serem arquivados).

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
| Autenticação (`OWN_ADMIN_ACCESS`, limite em memória, troca de senha e sessões; a origem do WebSocket sem a porta e o último admin atômico já foram **respondidos**) | TASK-038 itens 1, 4 e 5 (P-018, P-019, D-011) |
| Cena e modelo 3D (critério de `warning`, nós do GLB para o olho do operador e as lingas, troca visível do provisório pelo GLB; a licença do modelo e a ficha com a = −1,56 m já foram **respondidas**) | TASK-039 item 2, TASK-041 itens 1–2 e § 12.5, TASK-043 § 8 |
| Documentação protegida ("Testes relacionados" de RN-001, 004, 005, 007 e 008 em `business-rules.md`, pela pessoa) | TASK-015 item 8, TASK-020 item 5, TASK-025 § 10, TASK-028 § 10 |

---

## 5. O que os agentes NÃO devem presumir

Lista explícita. Se está aqui, o agente deve **verificar** antes de depender.

- que existe simulação persistida, `SafetyValidator`, nível de alerta ou upload de modelo 3D: ainda não (2026-09-26, leva D)
- que a API sempre exige login: só com `DATABASE_URL` (sem banco, as rotas que existem ficam abertas; ADR-016 § 5)
- que as guardas de rota e os botões escondidos do frontend protegem algo: são só apresentação; quem autoriza é o backend
- que a cor âmbar ("atenção") tem critério: não tem (PEND-004, D-014)
- que o modelo 3D do caminhão é o guindaste da empresa: é ilustrativo (L-002)
- que a página Tabelas mostra todas as versões de uma configuração, ou que "Editar" altera o cadastro: ainda não (L-011, em andamento na TASK-044)
- que o E2E cobre o cadastro do catálogo pela tela: não cobre; cobre as páginas, a cena, o login e perfis, a importação pela página Tabelas e a avaliação com os dados semeados ([`testing-strategy.md`](testing-strategy.md) § 2)
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

- E2E: não cobre cadastro do catálogo pela tela nem o WebSocket de forma explícita (o teste semeado aceita o resultado por qualquer transporte); os specs com backend (avaliação, login e perfis, importação pela tela) e o job `e2e` não foram executados localmente (Docker indisponível; TASK-036, 038, 040 e 042 § 7).
- A cena 3D não tem teste de imagem: anel, carga, cores, câmeras e o modelo do caminhão são conferidos por testes sem renderer e por capturas manuais (TASK-041, 043).
- Desempenho da cena: os 60 fps num notebook comum não foram medidos em hardware real (só SwiftShader; TASK-041 CA-6; D-013).
- Integração com banco na máquina de desenvolvimento: só no CI (L-005); inclui os testes de login, `create_admin` e a corrida do último admin (TASK-038).
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
| L-003 | Sem autenticação nem autorização: todas as rotas abertas, inclusive cadastro, importação e **ativação** de tabelas, e o WebSocket sem validação de `Origin`. Resolvido pelo [ADR-016](decisions/ADR-016-autenticacao-e-perfis.md): com banco, login com sessão em cookie `HttpOnly`, perfis `ADMIN`/`OPERATOR`, escrita só para `ADMIN`, cabeçalho anti-CSRF, WebSocket com a mesma sessão e `Origin` conferido, gestão de usuários com o último admin atômico e primeiro admin por `python -m app.create_admin`; no frontend, login, guardas de rota e página Usuários. Sem banco continua sem login (ADR-016 § 5, só desenvolvimento). Dívidas que ficaram: D-011, D-012 | 2026-09-26 | TASK-038, TASK-040 (PR #39) |
| P-005 (parte) | Carga igual à capacidade (100 % de utilização): **fica dentro do limite** (verde), decisão da pessoa responsável em chat. O resto da P-005 (status dos alertas, carga bruta × líquida) continua aberto na § 4 | 2026-09-26 | TASK-039 (PR #39) |
| D-009 | `EvaluationInputPanel.tsx` (campo de peso da TASK-032) ficou sem uso na mescla da leva C, porque o peso passou a vir do painel "Carga". Removido na branch da leva C | 2026-09-26 | TASK-033 (PR #34) |
