# Roteiro de demonstração reproduzível

> **⚠️ TUDO NESTA DEMONSTRAÇÃO É FICTÍCIO.** Fabricante, guindaste, configuração, ficha técnica e
> tabelas de carga foram inventados só para mostrar o funcionamento do sistema (ADR-012). Nenhum
> número vem de ficha técnica ou tabela de fabricante. **Nunca apresente estes valores como
> capacidade real de um guindaste**, nem use o resultado para planejar uma operação. A consulta de
> capacidade é a conservadora **provisória** do ADR-015 (sem interpolação; PEND-001, PEND-003) e o
> resultado não tem nível de alerta (PEND-004).

Roteiro da Estação 5 da doc-fonte (§ 23, "roteiro de demo reproduzível") para o item "a simulação de
demonstração puder ser repetida do início ao fim" da Definition of Done do MVP (§ 24). Criado na
TASK-035. Os valores esperados das seções 5 a 7 são conferidos automaticamente por
`backend/tests/test_demo_seed.py` (repositórios em memória) e
`backend/tests/test_demo_seed_integration.py` (PostgreSQL).

## 1. O que a demonstração cadastra

O seed (`backend/app/demo_seed.py`) usa os casos de uso reais (cadastro do catálogo, importação com
validação e preservação do arquivo-fonte, ativação) e é **idempotente**: rodar de novo não duplica
nada.

| Item | Id fixo | Valor (FICTÍCIO) |
|------|---------|------------------|
| Fabricante | `demo-ficticio-fabricante` | "Fabricante Demonstração FICTÍCIO" |
| Guindaste | `demo-ficticio-guindaste` | "Guindaste Demonstração FICTÍCIO" |
| Configuração | `demo-ficticio-configuracao` | "Configuração Demonstração FICTÍCIA" |
| Ficha técnica | — | a = −1,56 m; h = 3,3 m; lança 12–22 m; inclinação 0–80°; cabo 1–15 m; giro contínuo — coerente com o modelo 3D ilustrativo `guindaste-caminhao.glb` (TASK-043; até então, a = −1,2 m) |
| Tabela de carga | `demo-ficticio-tabela-v1` | versão `demo-ficticia-v1`, 27 pontos, lanças de 12, 17 e 22 m, **ACTIVE** |

> **Banco semeado antes da TASK-043 (a = −1,2 m):** o seed não sobrescreve uma configuração com
> ficha diferente e termina com erro ("não sobrescreve"). Recrie o banco antes de semear de novo
> (no Docker: `docker compose down -v`).

Arquivos em `backend/app/demo_data/` (ver o README da pasta):

- `tabela_carga_ficticia_demo_v1.csv` — importada e ativada pelo seed;
- `tabela_carga_ficticia_demo_v2.csv` — mesma grade com capacidade × 0,9, para a troca de versão (§ 7);
- `tabela_carga_ficticia_demo_com_erros.csv` — para ver o relatório de erros (§ 6).

## 2. Pré-requisitos

- Git e o repositório clonado.
- **Caminho A (Docker):** Docker com Compose v2 (a virtualização do Windows precisa estar ativa).
- **Caminho B (sem Docker):** Python 3.14 e uv 0.12.18 (ADR-012), Node.js 24 e npm, PostgreSQL 18.
- Navegador com WebGL.

## 3. Caminho A — stack completa no Docker

Na raiz do repositório:

```bash
cp .env.example .env
# edite o .env e preencha POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_DB (valores só seus)

docker compose up -d --build        # postgres + backend + frontend
docker compose ps                   # espere os três ficarem "healthy"

# migra e semeia a demonstração FICTÍCIA (um comando só)
docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"
```

Saída esperada do seed na primeira vez:

```text
Seed da demonstração — dados FICTÍCIOS (ADR-012): não representam capacidade real.
- fabricante 'demo-ficticio-fabricante': criado
- guindaste 'demo-ficticio-guindaste': criado
- configuração 'demo-ficticio-configuracao': criado
- tabela de carga 'demo-ficticio-tabela-v1': criado
- tabela de carga 'demo-ficticio-tabela-v1': ativada
Pronto: selecione a configuração 'demo-ficticio-configuracao' na tela.
```

Na segunda vez, todos os itens dizem "já existia; nada alterado", a tabela diz "já estava ativa;
nada alterado" e a última linha é "Nada a fazer: a demonstração já estava semeada.".

Conferir a API: `curl http://127.0.0.1:8000/api/v1/health` → `"status":"UP"` e
`"database":"UP"`. A tela fica em **http://127.0.0.1:8080** (portas mudam com `BACKEND_PORT` e
`FRONTEND_PORT` no `.env`).

No Docker, o arquivo-fonte das tabelas importadas fica no volume `ja-guindastes_load-chart-files`
(`FILE_STORAGE_DIR=/data/load-charts` dentro do container) e o banco no volume
`ja-guindastes_postgres-data`.

## 4. Caminho B — sem Docker (PostgreSQL local + uvicorn + Vite)

1. Tenha um PostgreSQL 18 rodando (instalado na máquina, ou só o banco do Compose com
   `docker compose up -d postgres`) e um banco vazio para a demonstração.
2. `cp .env.example .env` e preencha, além dos `POSTGRES_*` (se usar o Compose para o banco):
   - `DATABASE_URL=postgresql+psycopg://<usuario>:<senha>@localhost:<porta>/<banco>`;
   - `FILE_STORAGE_DIR=<um diretório fora do repositório>` (ex.: `C:\ja-guindastes\load-charts`
     ou `~/ja-guindastes/load-charts`).
3. Exporte as variáveis no terminal do backend (o backend, o Alembic e o seed leem o ambiente do
   processo, não o `.env`; ver `docs/development-guide.md` § 6) e rode, em `backend/`:

   ```bash
   set -a && source ../.env && set +a      # Bash/Git Bash
   uv sync --locked
   uv run alembic upgrade head
   uv run python -m app.demo_seed          # mesma saída da seção 3
   uv run uvicorn app.main:app --reload    # API em http://127.0.0.1:8000
   ```

4. Em outro terminal, em `frontend/`:

   ```bash
   npm ci
   npm run dev                             # tela em http://localhost:5173
   ```

   O `vite.config.ts` encaminha `/api` (inclusive o WebSocket) para `http://localhost:8000`.

Nos passos seguintes, troque `http://127.0.0.1:8080` por `http://localhost:5173` (tela) e use
`http://127.0.0.1:8000` para a API nos dois caminhos.

## 5. Selecionar a configuração e mover o guindaste

1. Abra a tela. A cena 3D mostra o guindaste **provisório** (caixas e cilindros; medidas e limites
   FICTÍCIOS).
2. Selecione a configuração **"Configuração Demonstração FICTÍCIA"** (id
   `demo-ficticio-configuracao`). Se a tela de seleção do catálogo ainda não estiver disponível,
   digite o id no campo **"Configuração (configuration_id)"**.
3. Em **"Peso da carga (kg)"**, digite `3000`.
4. Deixe **giro = 0°** e **cabo = 5,0 m** (a pose inicial) e mova a inclinação e o comprimento da
   lança conforme a tabela abaixo. O painel do backend atualiza sozinho (WebSocket, com REST de
   reserva) e sempre mostra a marca **"PROVISÓRIO — consulta conservadora (ADR-015)"**.

Valores esperados com a tabela `demo-ficticia-v1` ativa (arredondados a 2 casas; a tela formata em
pt-BR):

| Cenário | Lança | Inclinação | Raio (backend) | Resultado | Capacidade admissível | Ponto tabelado usado | Utilização |
|---------|-------|------------|----------------|-----------|-----------------------|----------------------|------------|
| A — pose inicial | 12,0 m | 35° | 8,27 m | Avaliado | 4 200 kg | 12 m × 10 m | 71,43 % |
| B — lança mais alta | 12,0 m | 60° | 4,44 m | Avaliado | 7 000 kg | 12 m × 6 m | 42,86 % |
| C — lança estendida | 22,0 m | 35° | 16,46 m | Avaliado | 1 500 kg | 22 m × 18 m | 200,00 % |
| D — lança fora da tabela | 17,5 m | 35° | 12,78 m | Não avaliável: `BOOM_LENGTH_NOT_IN_CHART` | — | — | — |
| E — raio abaixo da tabela | 12,0 m | 80° | 0,52 m | Não avaliável: `RADIUS_BELOW_CHART_MIN` | — | — | — |

Como ler:

- raio = a + L·cos θ (ADR-013), com a = −1,56 m; ex.: A → −1,56 + 12·cos 35° ≈ 8,27 m;
- entre dois raios tabelados vale a **menor** capacidade dos dois vizinhos (ADR-015): em A, 8,27 m
  fica entre 8 m (5 500 kg) e 10 m (4 200 kg) → 4 200 kg; utilização = 3 000 / 4 200 = 71,43 %;
- em C a utilização passa de 100 %, mas o status continua "Avaliado": ainda não há níveis de alerta
  (PEND-004), e "Avaliado" só quer dizer que a tabela cobre o estado;
- em D o comprimento de lança não existe na tabela (12, 17 e 22 m) e não é interpolado (ADR-013
  C-6); em E o raio fica abaixo do menor raio tabelado (RN-007).

Conferir pela API (qualquer caminho):

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/evaluations \
  -H 'Content-Type: application/json' \
  -d '{"configuration_id":"demo-ficticio-configuracao","boom_length_m":12,"boom_angle_deg":35,"turret_rotation_deg":0,"cable_length_m":5,"load_weight_kg":3000}'
# → "status":"EVALUATED", "maximum_capacity_kg":4200.0, "utilization_percent":71.428...,
#   "load_chart_id":"demo-ficticio-tabela-v1"
```

## 6. Importar uma tabela com erro e ver o relatório

Use a tela de importação (se já estiver disponível) com o arquivo
`backend/app/demo_data/tabela_carga_ficticia_demo_com_erros.csv`, a configuração de demonstração,
id `demo-ficticio-tabela-com-erros` e versão `demo-ficticia-com-erros`. Pela API, na raiz do
repositório:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/load-charts/import \
  -F "file=@backend/app/demo_data/tabela_carga_ficticia_demo_com_erros.csv;type=text/csv" \
  -F configuration_id=demo-ficticio-configuracao \
  -F chart_id=demo-ficticio-tabela-com-erros \
  -F version=demo-ficticia-com-erros
```

Esperado: HTTP **422** com `"status":"INVALID"` e **nada gravado** (nem a tabela, nem o arquivo). O
relatório (`issues`) traz, nesta ordem:

| Linha | Coluna | Código | Motivo |
|-------|--------|--------|--------|
| 2 | — | `CONFLICTING_POINTS` | 12 m × 4 m aparece com capacidades diferentes nas linhas 2 e 6 |
| 3 | `working_radius_m` | `INVALID_NUMBER` | `abc` não é número |
| 4 | `max_capacity_kg` | `NEGATIVE_VALUE` | `-5500.0` é negativo |
| 5 | `max_capacity_kg` | `EMPTY_VALUE` | valor obrigatório vazio |
| 6 | — | `CONFLICTING_POINTS` | o mesmo conflito, visto da linha 6 |

A tabela ativa continua sendo a `demo-ficticia-v1` (repita o cenário A: 4 200 kg).

## 7. Ativar outra versão

Importe a versão 2 (FICTÍCIA) e ative-a — pela tela de importação e ativação, se disponível, ou
pela API:

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/load-charts/import \
  -F "file=@backend/app/demo_data/tabela_carga_ficticia_demo_v2.csv;type=text/csv" \
  -F configuration_id=demo-ficticio-configuracao \
  -F chart_id=demo-ficticio-tabela-v2 \
  -F version=demo-ficticia-v2
# → HTTP 201, "status":"DRAFT"

curl -s -X POST http://127.0.0.1:8000/api/v1/load-charts/demo-ficticio-tabela-v2/activate
# → a v2 fica ACTIVE e a v1 vira SUPERSEDED
```

Volte à tela com a pose do cenário A (12,0 m, 35°, carga 3 000 kg). Esperado: capacidade
admissível **3 780 kg** (ponto 12 m × 10 m da v2), utilização **79,37 %** e "Tabela de carga"
mostrando `demo-ficticia-v2`.

## 8. Repetir do início

- Rodar o seed de novo depois do § 7 **não** reativa a v1: a saída diz
  "está SUPERSEDED (outra versão foi ativada); não reativada" (reativar `SUPERSEDED` não está no
  fluxo da doc-fonte § 13.2).
- Para recomeçar do zero no Docker: `docker compose down --volumes` (apaga **os dois** volumes
  locais: banco e arquivos importados) e volte à seção 3.
- Sem Docker: recrie o banco vazio, apague o conteúdo de `FILE_STORAGE_DIR` e volte à seção 4.

## 9. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| Seed: `ERRO: defina DATABASE_URL` ou `defina FILE_STORAGE_DIR` | variável ausente no processo | exporte as duas (Caminho B) ou use o comando do Compose (Caminho A) |
| Seed: `ERRO: falha no banco (ProgrammingError)` | migrations não aplicadas | `alembic upgrade head` antes do seed |
| Seed: `ERRO: falha no banco (OperationalError)` | PostgreSQL fora do ar ou URL errada | confira o banco e a `DATABASE_URL` |
| Seed: "já existe com outro guindaste ou outra ficha técnica" | banco com dados de demonstração alterados | recomece do zero (§ 8) |
| Painel: `CRANE_GEOMETRY_NOT_FOUND` / `ACTIVE_LOAD_CHART_NOT_FOUND` | seed não rodou, id digitado errado ou API sem `DATABASE_URL` | rode o seed e confira o id |
| Importação responde 404 na rota | API sem `FILE_STORAGE_DIR` ou sem `DATABASE_URL` (rotas não registradas) | defina as duas e reinicie a API |
