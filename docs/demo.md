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
| Ficha técnica | — | a = 0,46 m; h = 3,3 m; lança 12–22 m; inclinação 0–80°; cabo 1–15 m; giro contínuo — coerente com o modelo 3D `guindaste-80t.glb` (TASK-069) |
| Zonas de giro (TASK-046) | — | `FRONTAL` "Frontal FICTÍCIA", de 305° a 55° (110°), e `LATERAL_TRASEIRA` "Lateral e traseira FICTÍCIA", de 55° a 305° (250°) |
| Peso do gancho (TASK-046) | — | 200 kg: a avaliação compara **carga + 200 kg** com a capacidade |
| Tabela de carga, zona `FRONTAL` | `demo-ficticio-tabela-v1` | versão `demo-ficticia-v1`, 27 pontos, lanças de 12, 17 e 22 m, **ACTIVE** |
| Tabela de carga, zona `LATERAL_TRASEIRA` | `demo-ficticio-tabela-lateral-traseira-v1` | versão `demo-ficticia-lateral-traseira-v1`: os mesmos pontos com a capacidade × 0,8, **ACTIVE** |

> **Banco semeado antes da TASK-043 (a = −1,2 m) ou da TASK-046 (sem zonas nem gancho):** o seed
> não sobrescreve uma configuração com ficha, zonas ou gancho diferentes e termina com erro ("não
> sobrescreve"). Recrie o banco antes de semear de novo (no Docker: `docker compose down -v`).

Arquivos em `backend/app/demo_data/` (ver o README da pasta):

- `tabela_carga_ficticia_demo_v1.csv` — importada e ativada pelo seed na zona `FRONTAL`;
- `tabela_carga_ficticia_demo_lateral_traseira_v1.csv` — mesma grade com capacidade × 0,8, importada
  e ativada pelo seed na zona `LATERAL_TRASEIRA`;
- `tabela_carga_ficticia_demo_v2.csv` — mesma grade com capacidade × 0,9, para a troca de versão na
  zona `FRONTAL` (§ 7);
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
# e SESSION_COOKIE_SECURE=false (a stack local é servida em HTTP; ver § 3.1)

docker compose up -d --build        # postgres + backend + frontend
docker compose ps                   # espere os três ficarem "healthy"

# migra e semeia a demonstração FICTÍCIA (um comando só)
docker compose run --rm backend sh -c "alembic upgrade head && python -m app.demo_seed"

# cria o primeiro admin (pede a senha duas vezes, sem eco; mínimo de 10 caracteres)
docker compose run --rm backend python -m app.create_admin --username admin --display-name "Admin da demonstração"
```

Saída esperada do seed na primeira vez:

```text
Seed da demonstração — dados FICTÍCIOS (ADR-012): não representam capacidade real.
- fabricante 'demo-ficticio-fabricante': criado
- guindaste 'demo-ficticio-guindaste': criado
- configuração 'demo-ficticio-configuracao': criado
- tabela de carga 'demo-ficticio-tabela-v1': criado
- tabela de carga 'demo-ficticio-tabela-v1': ativada
- tabela de carga 'demo-ficticio-tabela-lateral-traseira-v1': criado
- tabela de carga 'demo-ficticio-tabela-lateral-traseira-v1': ativada
Pronto: selecione a configuração 'demo-ficticio-configuracao' na tela.
```

Na segunda vez, todos os itens dizem "já existia; nada alterado", as duas tabelas dizem "já estava
ativa; nada alterado" e a última linha é "Nada a fazer: a demonstração já estava semeada.".

Conferir a API: `curl http://127.0.0.1:8000/api/v1/health` → `"status":"UP"` e
`"database":"UP"`. A tela fica em **http://127.0.0.1:8080** (portas mudam com `BACKEND_PORT` e
`FRONTEND_PORT` no `.env`).

No Docker, o arquivo-fonte das tabelas importadas fica no volume `ja-guindastes_load-chart-files`
(`FILE_STORAGE_DIR=/data/load-charts` dentro do container) e o banco no volume
`ja-guindastes_postgres-data`.

### 3.1 Login (ADR-016)

Com banco, a API exige login: só `GET /api/v1/health` e `GET /api/v1/auth/session` são abertos.
Perfis: **ADMIN** (cadastra, importa e ativa tabelas, gerencia usuários) e **OPERATOR** (consulta,
valida sem gravar e avalia). Não há cadastro aberto: o primeiro admin vem do comando
`python -m app.create_admin` acima, e os demais usuários são criados por ele.

- O comando é **idempotente**: se o usuário já existe, avisa e sai sem trocar a senha.
- A senha vem de `ADMIN_PASSWORD` (se definida) ou é pedida sem eco; nunca por argumento.
- A sessão fica no cookie `crane_session` (`HttpOnly`, `SameSite=Strict`) e vale 8 h. Com
  `SESSION_COOKIE_SECURE=true` (o padrão), o navegador só devolve o cookie em HTTPS; por isso a
  stack local em `http://127.0.0.1:8080` precisa de `SESSION_COOKIE_SECURE=false` no `.env`
  (**nunca** em produção). Depois de mudar o `.env`, recrie o backend: `docker compose up -d backend`.
- Todo `POST`/`PUT`/`PATCH`/`DELETE` exige o cabeçalho `X-Requested-With: crane-simulator`.

Entrar pela API e guardar o cookie (troque `<senha>` pela que você digitou no comando):

```bash
curl -s -c cookies.txt -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: crane-simulator' \
  -d '{"username":"admin","password":"<senha>"}'
# → {"user":{"id":"...","username":"admin","displayName":"Admin da demonstração","role":"ADMIN",...}}

curl -s -b cookies.txt http://127.0.0.1:8000/api/v1/auth/session
# → {"authEnabled":true,"user":{...}}
```

Os `curl` das seções seguintes usam esse `cookies.txt` (`-b cookies.txt`). Para sair:
`curl -s -b cookies.txt -X POST -H 'X-Requested-With: crane-simulator' http://127.0.0.1:8000/api/v1/auth/logout`.
Apague o `cookies.txt` no fim: ele dá acesso à API enquanto a sessão valer.

## 4. Caminho B — sem Docker (PostgreSQL local + uvicorn + Vite)

1. Tenha um PostgreSQL 18 rodando (instalado na máquina, ou só o banco do Compose com
   `docker compose up -d postgres`) e um banco vazio para a demonstração.
2. `cp .env.example .env` e preencha, além dos `POSTGRES_*` (se usar o Compose para o banco):
   - `DATABASE_URL=postgresql+psycopg://<usuario>:<senha>@localhost:<porta>/<banco>`;
   - `FILE_STORAGE_DIR=<um diretório fora do repositório>` (ex.: `C:\ja-guindastes\load-charts`
     ou `~/ja-guindastes/load-charts`);
   - `SESSION_COOKIE_SECURE=false` (uvicorn e Vite em HTTP local; ver § 3.1).
3. Exporte as variáveis no terminal do backend (o backend, o Alembic e o seed leem o ambiente do
   processo, não o `.env`; ver `docs/development-guide.md` § 6) e rode, em `backend/`:

   ```bash
   set -a && source ../.env && set +a      # Bash/Git Bash
   uv sync --locked
   uv run alembic upgrade head
   uv run python -m app.demo_seed          # mesma saída da seção 3
   uv run python -m app.create_admin --username admin --display-name "Admin da demonstração"
   uv run uvicorn app.main:app --reload    # API em http://127.0.0.1:8000
   ```

4. Em outro terminal, em `frontend/`:

   ```bash
   npm ci
   npm run dev                             # tela em http://localhost:5173
   ```

   O `vite.config.ts` encaminha `/api` (inclusive o WebSocket) para `http://localhost:8000`.

Nos passos seguintes, troque `http://127.0.0.1:8080` por `http://localhost:5173` (tela) e use
`http://127.0.0.1:8000` para a API nos dois caminhos. O login pela API é o da § 3.1.

## 5. Selecionar a configuração e mover o guindaste

1. Abra a tela: sem sessão, ela leva a **/login**. Entre com o admin criado por
   `python -m app.create_admin` (§ 3 ou § 4; detalhes na § 3.1). Se a tela abrir direto no Início
   com o aviso "Modo sem autenticação", o backend está sem banco: volte à § 3 ou § 4.
2. No trilho à esquerda, abra o **Simulador**. A cena ocupa a página e mostra o modelo
   **ilustrativo** do guindaste sobre caminhão (`guindaste-caminhao.glb`, TASK-043), que é baixado
   em segundo plano: por uma fração de segundo aparece o guindaste provisório, que ele substitui. O
   modelo não define capacidade nem medidas de cálculo (RN-003), que vêm da ficha técnica FICTÍCIA.
3. Passo **1 Guindaste**: escolha **"Fabricante Demonstração FICTÍCIO"** → **"Guindaste
   Demonstração FICTÍCIO"** → **"Configuração Demonstração FICTÍCIA"** (id
   `demo-ficticio-configuracao`) e continue.
4. Passo **2 Carga**: preencha uma descrição (ex.: `Carga FICTÍCIA`), **"Peso (kg)"** = `3000` e
   comprimento, largura e altura maiores que zero (ex.: 2, 1 e 1 m). O peso só vai para a avaliação
   com o formulário inteiro válido; as dimensões só desenham a caixa pendurada no gancho.
5. Passo **3 Posição**: deixe **"Giro da torre"** em 0° e **"Comprimento do cabo"** em 5,0 m (a pose
   inicial, na zona `FRONTAL`) e mova **"Inclinação da lança"** e **"Comprimento da lança"**
   conforme a tabela abaixo; depois gire a torre (cenários F e G). O resultado à direita atualiza
   sozinho (WebSocket, com REST de reserva), mostra a situação com cor, o medidor de utilização, a
   capacidade e o raio do backend, a zona de giro e as parcelas do peso comparado (carga, gancho e
   total), e sempre traz a marca **"PROVISÓRIO — consulta conservadora (ADR-015)"**. O anel no chão
   marca o raio de pré-visualização e ganha a cor da situação.

Valores esperados com as tabelas `demo-ficticia-v1` (zona `FRONTAL`) e
`demo-ficticia-lateral-traseira-v1` (zona `LATERAL_TRASEIRA`) ativas, carga de 3 000 kg e gancho
FICTÍCIO de 200 kg, ou seja, **3 200 kg comparados** (arredondados a 2 casas; a tela formata em
pt-BR):

| Cenário | Giro | Lança | Inclinação | Raio (backend) | Zona | Resultado | Capacidade admissível | Ponto tabelado usado | Utilização |
|---------|------|-------|------------|----------------|------|-----------|-----------------------|----------------------|------------|
| A — pose inicial | 0° | 12,0 m | 35° | 10,29 m | `FRONTAL` | Avaliado | 3 800 kg | 12 m × 11 m | 84,21 % |
| B — lança mais alta | 0° | 12,0 m | 60° | 6,46 m | `FRONTAL` | Avaliado | 5 500 kg | 12 m × 8 m | 58,18 % |
| C — lança estendida | 0° | 22,0 m | 35° | 18,48 m | `FRONTAL` | Avaliado | 1 200 kg | 22 m × 20 m | 266,67 % |
| D — lança entre colunas | 0° | 17,5 m | 35° | 14,80 m | `FRONTAL` | Avaliado (coluna de 22 m) | 1 900 kg | 22 m × 16 m | 168,42 % |
| E — raio acima da tabela | 0° | 22,0 m | 0° | 22,46 m | `FRONTAL` | Não avaliável: `RADIUS_ABOVE_CHART_MAX` | — | — | — |
| F — giro para trás | 180° | 12,0 m | 35° | 10,29 m | `LATERAL_TRASEIRA` | Avaliado | 3 040 kg | 12 m × 11 m | 105,26 % |
| G — giro na fronteira | 55° | 12,0 m | 35° | 10,29 m | `LATERAL_TRASEIRA` | Avaliado | 3 040 kg | 12 m × 11 m | 105,26 % |

Desde a TASK-069, a ficha de demonstração tem a = 0,46 m (eixo de giro real do modelo 3D). Os
valores acima são os da leitura conservadora da tabela (`tests/test_demo_seed.py`); o simulador
interpola entre os pontos (ADR-030) e mostra capacidades um pouco maiores entre eles.

Como ler:

- raio = a + L·cos θ (ADR-013), com a = 0,46 m; ex.: A → 0,46 + 12·cos 35° ≈ 10,29 m;
- entre dois raios tabelados vale a **menor** capacidade dos dois vizinhos (ADR-015): em A, 8,27 m
  fica entre 8 m (5 500 kg) e 10 m (4 200 kg) → 4 200 kg;
- o peso comparado é **carga + gancho** (ADR-018 § 2): 3 000 + 200 = 3 200 kg; em A, utilização =
  3 200 / 4 200 = 76,19 %;
- o giro escolhe a zona (ADR-018 § 1): de 305° a 55° vale a tabela `FRONTAL`; de 55° a 305°, a
  `LATERAL_TRASEIRA` (capacidade × 0,8). Em F, 8,27 m cai entre 8 m (4 400 kg) e 10 m (3 360 kg) →
  3 360 kg; utilização = 3 200 / 3 360 = 95,24 %. No slider, 180° e −180° são o mesmo giro;
- em G o giro está **na fronteira** (55°): valem as duas zonas, e fica a **menor** capacidade
  (4 200 kg na frontal, 3 360 kg na lateral e traseira → 3 360 kg, zona `LATERAL_TRASEIRA`);
- em C a utilização passa de 100 %: o resultado continua "Avaliado" (a tabela cobre o estado), e a
  situação aparece como **"Acima da capacidade"**, em vermelho no painel e no anel da cena. Isso só
  compara o peso com a capacidade: ainda não há níveis de alerta (PEND-004), e 100 % exatos contam
  como dentro da capacidade (P-005). D e E aparecem como "Não avaliável", em cinza, com os motivos;
- em D o comprimento de lança não existe na tabela (12, 17 e 22 m) e não é interpolado (ADR-013
  C-6); em E o raio fica abaixo do menor raio tabelado (RN-007).

Conferir pela API (qualquer caminho):

```bash
curl -s -b cookies.txt -X POST http://127.0.0.1:8000/api/v1/evaluations \
  -H 'Content-Type: application/json' -H 'X-Requested-With: crane-simulator' \
  -d '{"configuration_id":"demo-ficticio-configuracao","boom_length_m":12,"boom_angle_deg":35,"turret_rotation_deg":0,"cable_length_m":5,"load_weight_kg":3000}'
# → "status":"EVALUATED", "maximum_capacity_kg":4200.0, "utilization_percent":76.190...,
#   "load_chart_id":"demo-ficticio-tabela-v1", "rotation_zone_code":"FRONTAL",
#   "hook_block_weight_kg":200.0, "compared_weight_kg":3200.0
```

Com `"turret_rotation_deg":180`, a resposta traz `"rotation_zone_code":"LATERAL_TRASEIRA"`,
`"maximum_capacity_kg":3360.0`, `"utilization_percent":95.238...` e
`"load_chart_id":"demo-ficticio-tabela-lateral-traseira-v1"`.

## 6. Importar uma tabela com erro e ver o relatório

Na página **Tabelas** (importar exige o perfil ADMIN), escolha a configuração de demonstração e
solte (ou escolha) o arquivo `backend/app/demo_data/tabela_carga_ficticia_demo_com_erros.csv`. A
validação prévia mostra o relatório de erros numa tabela com linha, coluna e problema. Se tentar
importar, use o id `demo-ficticio-tabela-com-erros`, a versão `demo-ficticia-com-erros` e a zona
`FRONTAL` (a configuração de demonstração tem zonas de giro, então a importação pede a zona). Pela
API, na raiz do repositório, com o login de admin da § 3.1:

```bash
curl -s -b cookies.txt -H 'X-Requested-With: crane-simulator' \
  -X POST http://127.0.0.1:8000/api/v1/load-charts/import \
  -F "file=@backend/app/demo_data/tabela_carga_ficticia_demo_com_erros.csv;type=text/csv" \
  -F configuration_id=demo-ficticio-configuracao \
  -F chart_id=demo-ficticio-tabela-com-erros \
  -F version=demo-ficticia-com-erros \
  -F rotation_zone_code=FRONTAL
```

Sem o `rotation_zone_code`, a resposta é HTTP **422** com `"code":"ROTATION_ZONE_REQUIRED"`, antes
de o arquivo ser lido.

Esperado: HTTP **422** com `"status":"INVALID"` e **nada gravado** (nem a tabela, nem o arquivo). O
relatório (`issues`) traz, nesta ordem:

| Linha | Coluna | Código | Motivo |
|-------|--------|--------|--------|
| 2 | — | `CONFLICTING_POINTS` | 12 m × 4 m aparece com capacidades diferentes nas linhas 2 e 6 |
| 3 | `working_radius_m` | `INVALID_NUMBER` | `abc` não é número |
| 4 | `max_capacity_kg` | `NEGATIVE_VALUE` | `-5500.0` é negativo |
| 5 | `max_capacity_kg` | `EMPTY_VALUE` | valor obrigatório vazio |
| 6 | — | `CONFLICTING_POINTS` | o mesmo conflito, visto da linha 6 |

As tabelas ativas continuam as mesmas (repita o cenário A: 4 200 kg).

## 7. Ativar outra versão

Importe a versão 2 (FICTÍCIA) na zona `FRONTAL` e ative-a. Na página **Tabelas**: solte
`tabela_carga_ficticia_demo_v2.csv`, escolha a zona **"Frontal FICTÍCIA"**, importe como rascunho
com o id `demo-ficticio-tabela-v2` e a versão `demo-ficticia-v2`, e use **"Ativar"** na linha do
tempo, que pede confirmação e compara com a ativa **da mesma zona**. A linha do tempo vai da maior
versão para a menor e passa a mostrar a v2 ativa na zona frontal, a v1 substituída e a
lateral/traseira ainda ativa. Ou pela API:

```bash
curl -s -b cookies.txt -H 'X-Requested-With: crane-simulator' \
  -X POST http://127.0.0.1:8000/api/v1/load-charts/import \
  -F "file=@backend/app/demo_data/tabela_carga_ficticia_demo_v2.csv;type=text/csv" \
  -F configuration_id=demo-ficticio-configuracao \
  -F chart_id=demo-ficticio-tabela-v2 \
  -F version=demo-ficticia-v2 \
  -F rotation_zone_code=FRONTAL
# → HTTP 201, "status":"DRAFT", "rotation_zone_code":"FRONTAL"

curl -s -b cookies.txt -H 'X-Requested-With: crane-simulator' \
  -X POST http://127.0.0.1:8000/api/v1/load-charts/demo-ficticio-tabela-v2/activate
# → a v2 fica ACTIVE na zona FRONTAL e a v1 vira SUPERSEDED ("superseded_chart_id":
#   "demo-ficticio-tabela-v1"); a tabela da zona LATERAL_TRASEIRA não muda
```

Volte à tela com a pose do cenário A (giro 0°, 12,0 m, 35°, carga 3 000 kg). Esperado: capacidade
admissível **3 780 kg** (ponto 12 m × 10 m da v2), utilização **84,66 %** (3 200 / 3 780) e
"Tabela de carga" mostrando `demo-ficticia-v2`. Gire para 180° (cenário F): a capacidade continua
**3 360 kg** e a utilização **95,24 %**, da tabela `demo-ficticia-lateral-traseira-v1`.

## 8. Repetir do início

- Rodar o seed de novo depois do § 7 **não** reativa a v1: a saída diz
  "está SUPERSEDED (outra versão foi ativada); não reativada" para a v1 e "já estava ativa; nada
  alterado" para a tabela lateral/traseira (reativar `SUPERSEDED` não está no fluxo da doc-fonte
  § 13.2).
- Para recomeçar do zero no Docker: `docker compose down --volumes` (apaga **os dois** volumes
  locais: banco e arquivos importados) e volte à seção 3.
- Sem Docker: recrie o banco vazio, apague o conteúdo de `FILE_STORAGE_DIR` e volte à seção 4.

## 9. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| Seed: `ERRO: defina DATABASE_URL` ou `defina FILE_STORAGE_DIR` | variável ausente no processo | exporte as duas (Caminho B) ou use o comando do Compose (Caminho A) |
| Seed: `ERRO: falha no banco (ProgrammingError)` | migrations não aplicadas | `alembic upgrade head` antes do seed |
| Seed: `ERRO: falha no banco (OperationalError)` | PostgreSQL fora do ar ou URL errada | confira o banco e a `DATABASE_URL` |
| Seed: "já existe com outro guindaste, outra ficha técnica, outras zonas de giro ou outro peso de gancho" | banco com dados de demonstração alterados, ou semeado antes da TASK-046 (sem zonas nem gancho) | recomece do zero (§ 8) |
| Seed: `ERRO: falha no banco (ProgrammingError)` depois de atualizar o código | migration da TASK-046 não aplicada | `alembic upgrade head` antes do seed |
| Painel: `CRANE_GEOMETRY_NOT_FOUND` / `ACTIVE_LOAD_CHART_NOT_FOUND` | seed não rodou, id digitado errado ou API sem `DATABASE_URL`; com zonas, a zona do giro atual sem tabela ativa (`rotation_zone_code` mostra qual) | rode o seed, confira o id ou ative uma tabela nessa zona |
| Importação: `422` com `"code":"ROTATION_ZONE_REQUIRED"`, `UNKNOWN_ROTATION_ZONE` ou `ROTATION_ZONE_NOT_ALLOWED` | zona ausente numa configuração com zonas, zona que não existe nela, ou zona informada numa configuração sem zonas | envie `-F rotation_zone_code=FRONTAL` (ou `LATERAL_TRASEIRA`) na configuração de demonstração |
| Importação responde 404 na rota | API sem `FILE_STORAGE_DIR` ou sem `DATABASE_URL` (rotas não registradas) | defina as duas e reinicie a API |
| `create_admin`: `ERRO: falha no banco (ProgrammingError)` | migrations não aplicadas (tabela `app_user` ausente) | `alembic upgrade head` antes |
| `create_admin`: "já existe; nada alterado" | o usuário já foi criado antes | entre com a senha dele; o comando não troca senha |
| API: `401` com `"code":"NOT_AUTHENTICATED"` | sem login, sessão expirada (8 h) ou cookie não enviado | faça o login da § 3.1; em HTTP local, confira `SESSION_COOKIE_SECURE=false` e recrie o backend |
| API: `403` com `"code":"CSRF_HEADER_MISSING"` | `POST`/`PUT`/`PATCH`/`DELETE` sem o cabeçalho | envie `-H 'X-Requested-With: crane-simulator'` |
| API: `403` com `"code":"FORBIDDEN"` | perfil OPERATOR numa ação de admin | entre com um admin |
| Login: `429` com `"code":"TOO_MANY_ATTEMPTS"` | 5 senhas erradas em 15 min para o mesmo usuário | espere a janela passar (ou reinicie o backend: o limite é em memória) |
