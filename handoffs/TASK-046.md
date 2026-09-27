# Handoff — TASK-046 — implementação (backend)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-27 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-046-zonas-de-giro-e-gancho.md` |
| **Etapa concluída** | implementação do backend (CA-1, CA-2, CA-3 e a parte de backend do CA-8) |
| **Papel exercido** | Implementador (e Engenheiro de testes) |
| **Ferramenta/agente** | Claude Code (modelo Opus 5.5), subagente em worktree, a pedido do orquestrador |
| **Branch** | `task/TASK-046-zonas-backend` (a partir de `7f0b88b`); o frontend anda em paralelo em outra branch |

---

## 1. Objetivo desta etapa

Zonas de giro por configuração, tabela ativa por (configuração, zona), escolha da tabela pelo giro ψ
(menor capacidade na fronteira) e peso comparado = carga + gancho, do domínio à API, com migration
nova, testes e seed FICTÍCIO.

## 2. O que foi feito

- **Domínio** (`backend/app/domain/`): `RotationZone` e `RotationZones`
  (`value_objects/rotation_zone.py`): código `[A-Z0-9_]{1,32}`, nome 1–80, ângulos em [0, 360), ≥ 2
  zonas, códigos únicos, cobertura de 360° sem buraco nem sobreposição (fronteiras iguais a ±ε);
  `zones_at(ψ)` devolve 1 zona ou, a ±ε = 1e-6° de uma fronteira, as 2 vizinhas na ordem declarada.
  `LoadChart.rotation_zone_code` (opcional). `weight_compared_with_capacity(load | peso, gancho)`
  = carga + gancho. Erro novo `InvalidRotationZonesError`.
- **Aplicação**: porta nova `ConfigurationLoadRulesProvider` (zonas + gancho);
  `ActiveLoadChartProvider.get_active_load_chart(configuration_id, rotation_zone_code=None)`;
  `CraneConfiguration` com `rotation_zones` e `hook_block_weight`; `EvaluateOperation` escolhe a
  zona, consulta as duas na fronteira e fica com a menor capacidade (empate → primeira na ordem
  declarada), compara carga + gancho, e os resultados trazem `rotation_zone`, `load_weight`,
  `hook_block_weight` e `compared_weight`; `ManageCraneCatalog` cria/edita zonas e gancho e recusa
  remover/renomear zona com tabelas (`RotationZoneInUseError`); `ImportLoadChart` confere a zona
  antes de ler o arquivo (`RotationZoneRequiredError`, `UnknownRotationZoneError`,
  `RotationZoneNotAllowedError`); `ListConfigurationLoadCharts` devolve as ativas por zona.
- **Infraestrutura**: migration nova `b4e1d7c93a52_zonas_de_giro_e_peso_do_gancho.py` (upgrade e
  downgrade); modelos com `crane_configurations.rotation_zones` (JSON), `hook_block_weight_kg`
  (CHECK 0–100 000), `load_charts.rotation_zone_code` (VARCHAR(32), CHECK do formato) e o índice
  único parcial `uq_load_charts_one_active_per_configuration_zone` sobre
  `(configuration_id, coalesce(rotation_zone_code, ''))` no lugar do antigo; repositórios gravam e
  leem zonas/gancho/zona da tabela, a ativação rebaixa só a ativa da mesma zona
  (`IS NOT DISTINCT FROM`) e o catálogo implementa `ConfigurationLoadRulesProvider`.
- **API**: contrato do § 3 (abaixo); erros novos com corpo `{"detail", "code"}` via `ApiError`
  (generalizado para qualquer `StrEnum`); composição liga o catálogo à importação e à avaliação e a
  listagem ao router do catálogo.
- **Seed FICTÍCIO**: zonas `FRONTAL` (305°→55°) e `LATERAL_TRASEIRA` (55°→305°), gancho de 200 kg,
  v1 importada na `FRONTAL` e `tabela_carga_ficticia_demo_lateral_traseira_v1.csv` (v1 × 0,8)
  importada e ativada na `LATERAL_TRASEIRA`. `docs/demo.md` recalculado (cenários A–E e v2) e
  cenários novos F (giro 180°) e G (fronteira 55°), conferidos por `tests/test_demo_seed.py` e pela
  versão de integração.
- **Docs**: `docs/architecture.md` (fluxo, rotas, componentes, modelo e migrations),
  `docs/known-gaps.md` (PEND-006/P-005 respondida em parte com carga + gancho; L-014 TM 130; L-015
  limites das zonas), `docs/demo.md`, `backend/app/demo_data/README.md`.

## 3. Arquivos modificados

`git diff --stat 7f0b88b..HEAD` → `62 files changed, 3850 insertions(+), 342 deletions(-)`. Só
`backend/**`, `docs/architecture.md`, `docs/demo.md`, `docs/known-gaps.md` e este handoff. Nada em
`frontend/**`, `docs/business-rules.md`, `handoffs/current.md` ou nos ADRs. `dados-oficiais/` não
foi lida (nem existe nesta worktree).

Arquivos novos principais:
- `backend/app/domain/value_objects/rotation_zone.py`
- `backend/app/application/ports/configuration_load_rules_provider.py`
- `backend/app/presentation/api/rotation_zone_errors.py`
- `backend/alembic/versions/b4e1d7c93a52_zonas_de_giro_e_peso_do_gancho.py`
- `backend/app/demo_data/tabela_carga_ficticia_demo_lateral_traseira_v1.csv` (FICTÍCIA)
- testes: `tests/domain/test_rotation_zones.py`, `tests/application/test_evaluate_operation_rotation_zones.py`,
  `tests/application/test_rotation_zones_use_cases.py`, `tests/presentation/test_rotation_zones_api.py`,
  `tests/infrastructure/repositories/test_rotation_zones_mapping.py`,
  `tests/infrastructure/repositories/test_rotation_zones_integration.py` (integration),
  `tests/infrastructure/database/test_rotation_zones_migration.py` (offline + integration),
  `tests/fixtures/rotation_zones_ficticias.py`.

## 4. Comandos executados e resultados

Em `backend/`:

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `uv run ruff check .` | ✅ | `All checks passed!` |
| `uv run ruff format --check .` | ✅ | `208 files already formatted` |
| `uv run mypy app` | ✅ | `Success: no issues found in 114 source files` |
| `uv run lint-imports` | ✅ | `Contracts: 3 kept, 0 broken.` |
| `uv run pytest` | ✅ | `1259 passed, 78 skipped` (os pulados são os de integração: sem PostgreSQL local) |
| `bash scripts/check-structure.sh` (raiz) | ✅ | `OK: 0 erros, 0 aviso(s)` |

Testes com marcador `integration` (repositórios, migration, catálogo pela API, seed): **NÃO
EXECUTADOS** localmente (sem PostgreSQL/Docker, L-005); rodam no CI. Conferi à mão, com o código do
Alembic 1.20, que o `compare_metadata` considera iguais a expressão do modelo
`coalesce(rotation_zone_code, '')` e a refletida pelo PostgreSQL
(`COALESCE(rotation_zone_code, ''::character varying)`): as duas viram `coalesce(rotation_zone_code,)`
depois da limpeza de `_cleanup_index_expr`.

## 5. Decisões tomadas

1. **Validação das zonas no domínio, forma no Pydantic.** O Pydantic só confere tipos (texto,
   números finitos, campos). Tudo o que é regra (código, nome, faixa dos ângulos, cobertura, ≥ 2,
   códigos únicos) vem do `RotationZones` e responde 422 `INVALID_ROTATION_ZONES`. Tipo errado ou
   campo a mais continua sendo o 422 padrão do FastAPI (`detail` em lista).
2. **`[]` na criação = sem zonas**, como `null` e ausente (o contrato só dizia isso para o PATCH).
3. **Nome da zona não pode ser só espaços** (além de 1–80 caracteres), como os outros nomes do
   catálogo.
4. **Fronteira com uma zona sem tabela ativa ou fora da tabela → "não avaliável"** (lado seguro:
   sem as duas capacidades não há "menor" confiável). **Confirmada** pela pessoa responsável em
   2026-09-27 (§ 8, item 2).
13. **Zonas em configuração com tabelas sem zona → 409 `ZONELESS_LOAD_CHARTS_EXIST`**, decisão da
    pessoa responsável em 2026-09-27 (§ 8, item 1). A conferência fica no `ManageCraneCatalog`,
    logo depois da de `ROTATION_ZONE_IN_USE`, e só vale quando a configuração ainda não tem zonas e
    o PATCH traz uma lista não vazia.
5. **Zona informada em `NOT_EVALUABLE`**: sem tabela ativa, a zona sem tabela; consulta fora da
   tabela, a zona da tabela consultada; sem geometria (ou fronteira sem consulta), a zona de ψ (na
   fronteira, a primeira na ordem declarada).
6. **Empate na fronteira** → a primeira zona na ordem declarada da configuração.
7. **Zona conferida antes de ler o arquivo**, e configuração inexistente vira 404 **antes** do
   relatório do conteúdo (antes, um arquivo inválido numa configuração inexistente dava 422). Com
   `configuration_id` em branco, o comportamento antigo foi mantido (relatório com
   `MISSING_METADATA`).
8. **`rotation_zone_code` vazio ou só espaços = ausente** no formulário da importação.
9. **Índice**: um só índice único parcial por expressão, `(configuration_id, coalesce(rotation_zone_code, ''))`,
   como pede o contrato; `''` nunca é código válido (CHECK do formato).
10. **Downgrade**: não apaga tabela nenhuma; as `ACTIVE` com zona passam a `SUPERSEDED` (senão o
    índice antigo não seria recriado) e a zona se perde; zonas e gancho das configurações são
    descartados.
11. **Seed**: configuração existente sem zonas/gancho (banco semeado antes da TASK-046) termina com
    `DemoSeedError` pedindo para recriar o banco, como já acontecia com a ficha da TASK-043.
12. **Nomes dos schemas**: o contrato fala em `ConfigurationPatchRequest`; o schema real continua
    `ConfigurationUpdateRequest` (TASK-044). Só o nome da classe difere; o JSON é o do contrato.

## 6. Regras de negócio aplicadas

- ADR-018 § 1 (zona pelo giro; menor capacidade na fronteira) e § 2 (carga + gancho) — testes em
  `tests/application/test_evaluate_operation_rotation_zones.py` e `tests/domain/test_rotation_zones.py`.
- ADR-013 (convenção de ψ: 0° frente, anti-horário, normalizado em [0, 360)).
- ADR-015 (ε = 1e-6, aplicado em graus na fronteira; lado seguro).
- RN-001, RN-004, RN-005 (versão única por configuração, inclusive entre zonas), RN-007.
- RN-009 e RN-010 ainda **não** estão em `docs/business-rules.md`: é a pessoa responsável quem
  registra (ADR-018 § 4).

## 7. O que NÃO foi feito e por quê

- Frontend (CA-4..CA-7): fora desta etapa; feito em paralelo por outro agente.
- Testes de integração e E2E: NÃO EXECUTADOS localmente (sem PostgreSQL); escritos para o CI.
- TM 130 (tabelas sem comprimento de lança), JIB e lingas: fora do escopo (L-014; P-005).
- Não gravei tabelas `INVALID` nem mudei o ciclo de vida além da ativação por zona.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| 1 | Adicionar zonas a uma configuração que já tem tabelas **sem zona** deve ser recusado? Era aceito, e essas tabelas deixavam de valer na avaliação (L-015 item 2) | não | **Recusar com 409 `ZONELESS_LOAD_CHARTS_EXIST`**. O `detail` explica que há tabelas importadas sem zona e que é preciso criar outra configuração ou tratar essas tabelas antes. Vale no PATCH quando a configuração passa de "sem zonas" para "com zonas" e existe tabela com `rotation_zone_code` nulo; nada é gravado. Remover todas as zonas de uma configuração com tabelas com zona continua em `ROTATION_ZONE_IN_USE`. Implementado na branch `task/TASK-046-zonas-backend-2` | 2026-09-27 (pessoa responsável, em chat) |
| 2 | Na fronteira, se só uma das zonas cobre a consulta, "não avaliável" (hoje) ou usar a que cobre? | não | **"Não avaliável"**, como já estava (lado seguro). Nenhuma mudança de código | 2026-09-27 (pessoa responsável, em chat) |
| 3 | Registrar RN-009 e RN-010 em `docs/business-rules.md` e aceitar o ADR-018 | não | | |

## 9. ⚠️ Segurança

- nada a relatar. Nenhum dado real usado; tudo rotulado FICTÍCIO.

## 10. Contrato final do backend (para o frontend)

Tudo em snake_case. Erros novos: `{"detail": "<mensagem>", "code": "<CÓDIGO>"}` (o `detail` em
texto das rotas de catálogo e importação, mais `code`).

### Configuração

- `POST /api/v1/cranes/{crane_id}/configurations` e `PATCH /api/v1/configurations/{id}` aceitam
  `rotation_zones: [{code, name, start_deg, end_deg}] | null` e `hook_block_weight_kg: number | null`
  (0 a 100 000); `ConfigurationResponse` sempre traz os dois (`null` quando não há).
- `rotation_zones` volta na **ordem cadastrada**; `null`, `[]` e ausente = sem zonas (a resposta
  mostra `null`).
- `hook_block_weight_kg` volta como gravado (`null` fica `null`; a avaliação usa 0).
- PATCH: campo ausente mantém; `rotation_zones` presente substitui (`[]`/`null` remove);
  `hook_block_weight_kg: null` apaga; `name`/`geometry` continuam sem aceitar `null`; ao menos um
  campo.
- Ordem das validações no PATCH: 422 padrão (tipos, campo desconhecido, gancho fora de 0–100 000,
  body vazio) → 422 `INVALID_ROTATION_ZONES` → 404 (configuração) → 409 `ROTATION_ZONE_IN_USE`
  (remover ou renomear código com tabelas; nada é gravado) → 409 `ZONELESS_LOAD_CHARTS_EXIST`
  (configuração sem zonas, com tabela de `rotation_zone_code` nulo, recebendo uma lista não vazia;
  nada é gravado). No POST: 422 padrão → 422 `INVALID_ROTATION_ZONES` → 404 (guindaste).

### Importação

- `POST /api/v1/load-charts/import`, campo de formulário `rotation_zone_code` opcional (vazio ou só
  espaços = ausente).
- Ordem: nome do arquivo vazio (422 padrão) → 415 → 413 → 404 (configuração inexistente) → 422
  `ROTATION_ZONE_REQUIRED` / `UNKNOWN_ROTATION_ZONE` / `ROTATION_ZONE_NOT_ALLOWED` → 422 relatório
  (`status: INVALID`) → 409 (versão/id repetidos). A versão continua única por configuração, **entre
  todas as zonas**.
- Código em formato inválido (ex.: minúsculo) numa configuração com zonas vira
  `UNKNOWN_ROTATION_ZONE`; numa sem zonas, `ROTATION_ZONE_NOT_ALLOWED`.

### Tabelas

- `LoadChartResponse` (import, `GET /load-charts/{id}`, ativação) e o item da listagem trazem
  `rotation_zone_code: str | null`.
- `GET /api/v1/configurations/{id}/load-charts` →
  `{items, active_chart_id, active_charts: [{rotation_zone_code, chart_id}]}`. `active_charts`: a
  sem zona primeiro, depois as zonas na ordem cadastrada (zona sem ativa não aparece);
  `active_chart_id` = a ativa **sem zona** (numa configuração com zonas, em geral `null`).
- `POST /load-charts/{id}/activate`: substitui só a ativa da mesma zona; `superseded_chart_id` é a
  da mesma zona (ou `null`); a resposta traz `rotation_zone_code`.

### Avaliação (REST `EvaluationResponse` e WS `simulation.evaluated.payload`, nos dois resultados)

- `rotation_zone_code: str | null`, `rotation_zone_name: str | null`,
  `hook_block_weight_kg: float` (0 sem gancho), `compared_weight_kg: float` (carga + gancho).
- `utilization_percent = compared_weight_kg / capacidade × 100`.
- Na fronteira (±1e-6°), a zona reportada é a da menor capacidade.
- Zona de ψ sem tabela ativa → `NOT_EVALUABLE` com `ACTIVE_LOAD_CHART_NOT_FOUND` e a zona em
  `rotation_zone_code`.

### Seed FICTÍCIO (para o E2E e a demo)

- Configuração `demo-ficticio-configuracao`: zonas `FRONTAL` "Frontal FICTÍCIA" (305→55) e
  `LATERAL_TRASEIRA` "Lateral e traseira FICTÍCIA" (55→305); gancho 200 kg.
- Ativas: `demo-ficticio-tabela-v1` (FRONTAL) e `demo-ficticio-tabela-lateral-traseira-v1`
  (LATERAL_TRASEIRA, v1 × 0,8). Pose A (ψ 0°, 12 m, 35°, 3 000 kg): 4 200 kg, 76,19 %; ψ 180°:
  3 360 kg, 95,24 %.

## 11. Próximo passo

**Papel:** Revisor (outra sessão/ferramenta), depois a pessoa responsável para o merge com a parte
de frontend.

1. Revisar o diff `7f0b88b..task/TASK-046-zonas-backend`.
2. Conferir no CI os testes `integration` (migration com `compare_metadata`, índice por zona,
   downgrade que mantém as tabelas sem zona, seed).
3. Juntar com a branch do frontend e preencher a seção "Frontend" abaixo.

**Ler primeiro:** `AGENTS.md`, este handoff, `tasks/in-progress/TASK-046-zonas-de-giro-e-gancho.md`
§ 3, `docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md`,
`backend/app/application/use_cases/evaluate_operation.py`.

**Cuidado com:** o teste de integração da migration (`test_rotation_zones_migration.py`) grava e
apaga linhas FICTÍCIAS de verdade (fora de transação), porque precisa rodar o Alembic em
subprocesso; ele limpa no `finally`.

## 12. Como revisar

- Comece por `backend/app/domain/value_objects/rotation_zone.py` (cobertura e fronteira) e
  `backend/app/application/use_cases/evaluate_operation.py` (escolha da tabela e menor capacidade).
- Maior risco: a comparação do índice por expressão no `compare_metadata` (conferida à mão, não
  executada) e a descida da migration.
- Menos certeza: decisões 4, 5 e 7 do § 5 (comportamentos que o contrato não fixava).

---

## Frontend

Resumo das notas do agente do frontend (CA-4..CA-7 e a parte de frontend do CA-8), integradas pela
sessão principal em `f42f48c`.

### O que foi feito

- **Catálogo:** editor de zonas `RotationZonesEditor` (atalho "Frontal 110° + lateral e traseira
  250°", edição manual, "Sem zonas", validação local e o diagrama `RotationZoneDiagram`) e campo de
  peso do gancho. O detalhe da configuração mostra zona, setor e tabela ativa de cada zona. Mudar
  zonas ou gancho com tabela ativa pede confirmação.
- **Tabelas:** Select de zona na importação, zona de cada versão na linha do tempo, "Tabela ativa por
  zona" e o Dialog de ativação comparando com a ativa **da mesma zona**.
- **Códigos de erro:** lidos por `frontend/src/infrastructure/shared/apiErrorCode.ts`.
- **HUD do simulador:** zona atual e "Carga + Gancho = Peso comparado".
- **Cena:** `frontend/src/three/scene/RotationZoneSectors.ts`, com as props `rotationZones` e
  `activeZoneCode`; a zona destacada vem de `frontend/src/app/sceneRotationZone.ts`.
- **E2E:** `rotationZones.spec.ts`, com casos sem backend (passam) e com backend (rodam no CI).

### Comandos executados e resultados

| Comando | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| testes do frontend | ✅ | 640 passaram, 1 pulado |
| E2E sem backend | ✅ | 11 passaram, 11 pulados (os que precisam de backend) |

### Pendências

| # | Pergunta | Bloqueia? | Resposta | Respondida em |
|---|----------|-----------|----------|---------------|
| F-1 | Confirmar no CI (E2E com backend) que −180° no slider, com o seed, cai em `LATERAL_TRASEIRA` | não | | |
| F-2 | Código novo `409 ZONELESS_LOAD_CHARTS_EXIST` (backend-2, depois de `f42f48c`). Verifiquei que `catalogRestClient.ts` já mostra o `detail` de qualquer 409 que não seja `ROTATION_ZONE_IN_USE`, então a mensagem do backend aparece. Uma mensagem própria no editor de zonas é opcional | não | | |
