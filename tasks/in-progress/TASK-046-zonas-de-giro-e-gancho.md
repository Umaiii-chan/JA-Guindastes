# TASK-046 — Tabelas por zona de giro e peso do gancho na comparação (ADR-018)

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | alta |
| **Criada em** | 2026-09-27 por pessoa responsável (tabelas oficiais do MD 300L, via orquestrador) |
| **Iniciada em** | 2026-09-27 |
| **Concluída em** | — |
| **Branch** | `task/TASK-046-zonas-de-giro-e-gancho` |
| **PR** | — |
| **Requisitos** | tabela oficial do MD 300L (área frontal 110° e áreas lateral/traseira 250°; capacidades incluem o gancho de 235 kg); PEND-006 |
| **Regras de negócio** | ADR-018 (contrato abaixo); ADR-013 (convenção de ψ); ADR-015 (ε e lado seguro); RN-001, RN-004, RN-005, RN-007 |
| **Estimativa** | L |

---

## 1. Objetivo

Uma configuração pode ter **zonas de giro**, cada uma com a sua tabela ativa. A avaliação escolhe a
tabela pelo giro ψ e compara **carga + peso do gancho** com a capacidade.

## 2. Contexto

As primeiras tabelas oficiais chegaram e ficam **fora do git**, em `dados-oficiais/`.
**Nenhum agente lê essa pasta.** Testes, seed e E2E continuam com dados FICTÍCIOS, e as zonas FICTÍCIAS
de teste podem imitar o formato "frontal 110° / lateral e traseira 250°".

## 3. Contrato (snake_case, como o resto da API)

### Configuração

`ConfigurationCreateRequest`, `ConfigurationPatchRequest` e `ConfigurationResponse` ganham dois
campos, opcionais na criação e no PATCH:

- `rotation_zones: [{ "code", "name", "start_deg", "end_deg" }] | null`:
  - `code` único na configuração, 1 a 32 caracteres `[A-Z0-9_]`;
  - `name` com 1 a 80 caracteres;
  - ângulos em [0, 360), na convenção de ψ do ADR-013; o setor vai de `start_deg` a `end_deg` no
    sentido crescente e pode passar por 0;
  - as zonas precisam cobrir 360° sem sobreposição, com pelo menos 2 zonas; senão, 422
    `INVALID_ROTATION_ZONES`;
  - `null` ou ausente = sem zonas;
  - no PATCH, `rotation_zones` presente substitui a lista; `[]` ou `null` explícito remove as zonas;
  - remover ou renomear o `code` de uma zona que já tem tabelas → 409 `ROTATION_ZONE_IN_USE`.
- `hook_block_weight_kg: number | null`: ≥ 0 e ≤ 100000; `null` = 0.

### Importação

`POST /api/v1/load-charts/import` ganha o campo de formulário `rotation_zone_code`, opcional:

- obrigatório se a configuração tem zonas → senão 422 `ROTATION_ZONE_REQUIRED`;
- precisa existir na configuração → senão 422 `UNKNOWN_ROTATION_ZONE`;
- numa configuração sem zonas, precisa estar ausente → senão 422 `ROTATION_ZONE_NOT_ALLOWED`.

Os erros usam o mesmo formato de erro das rotas de importação.

### Tabelas

- `LoadChartResponse` (e o item da listagem) ganha `rotation_zone_code: str | null`.
- Na listagem `GET /configurations/{id}/load-charts`:
  - entra `active_charts: [{ "rotation_zone_code": str | null, "chart_id": str }]`;
  - `active_chart_id` continua existindo e é a ativa com zona `null`, ou `null`.
- Ativação: **uma ativa por (configuração, zona)**. Ativar outra tabela da mesma zona substitui a
  anterior, e as outras zonas não mudam. A resposta de ativação traz a zona.

### Avaliação (REST e WebSocket)

`EvaluationResponse` ganha:

- `rotation_zone_code` e `rotation_zone_name` (`str | null`): a zona usada. Na fronteira, entre ±ε,
  vem o `code` da zona cuja tabela deu a menor capacidade;
- `hook_block_weight_kg` (`float`, 0 se não houver);
- `compared_weight_kg` (`float`): carga + gancho, o valor comparado com a capacidade. A utilização
  passa a ser `compared_weight_kg / capacidade`.

Configuração com zonas e sem tabela ativa na zona de ψ → "não avaliável" com
`ACTIVE_LOAD_CHART_NOT_FOUND`, informando a zona.

### Banco

Uma migration Alembic **nova**, sem alterar as existentes:

- `load_chart.rotation_zone_code` (texto, nulo);
- a unicidade de "uma ativa" passa a valer por `(configuration_id, coalesce(rotation_zone_code, ''))`;
- na configuração, `rotation_zones` (JSON) e `hook_block_weight_kg` (numérico, nulo).

A migration deve voltar (`downgrade`) sem perder as tabelas sem zona.

## 4. Critérios de aceite

- [ ] **CA-1** — Domínio e aplicação:
  - zonas (validação de cobertura e de sobreposição, e ψ → zona com fronteira ±ε);
  - peso comparado = carga + gancho, em `weight_compared_with_capacity`;
  - na fronteira, menor capacidade entre as duas zonas;
  - testes unitários com dados FICTÍCIOS.
- [ ] **CA-2** — Infraestrutura: migration, repositórios e testes de integração com o marcador
  `integration`, incluindo o índice de "uma ativa" por zona.
- [ ] **CA-3** — API conforme o § 3, com testes de API: perfis, CSRF e todos os códigos de erro.
  O seed FICTÍCIO de demo ganha zonas FICTÍCIAS e peso do gancho FICTÍCIO, com os valores esperados de
  `docs/demo.md` recalculados e conferidos por teste.
- [ ] **CA-4** — Frontend, Catálogo:
  - a ficha da configuração ganha o editor de zonas, com o atalho "Frontal 110° + lateral e traseira
    250°" e a edição manual, e o campo de peso do gancho;
  - o detalhe mostra as zonas e a tabela ativa de cada uma.
- [ ] **CA-5** — Frontend, Tabelas:
  - a importação pede a zona quando a configuração tem zonas;
  - a linha do tempo mostra a zona de cada versão;
  - a ativa é destacada por zona;
  - o Dialog de ativação compara com a ativa **da mesma zona**.
- [ ] **CA-6** — Frontend, Simulador:
  - o HUD mostra a zona atual e as parcelas (carga, gancho e peso comparado);
  - a cena desenha os setores de zona no chão e destaca o atual.
- [ ] **CA-7** — E2E com backend (pulados sem ele): importar tabelas FICTÍCIAS em duas zonas, girar a
  torre e ver a zona e a capacidade mudarem.
- [ ] **CA-8** — Gates do backend e do frontend e `scripts/check-structure.sh` passam.
  `docs/architecture.md` (rotas e modelo) atualizado.

## 5. Escopo

### Dentro do escopo

`backend/**`, `frontend/**`, `docs/architecture.md`, `docs/demo.md`, `docs/known-gaps.md`,
`handoffs/TASK-046.md`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- ler `dados-oficiais/`;
- tabelas sem comprimento de lança (TM 130);
- JIB;
- lingas;
- `docs/business-rules.md` (só a pessoa responsável edita);
- ADRs e `handoffs/current.md`.

## 6. Riscos e dependências

- Banco e Docker não rodam localmente (o WSL está quebrado): integração e E2E só no CI.
- A ficha técnica oficial do MD 300L (a, h) não veio nos PDFs.
