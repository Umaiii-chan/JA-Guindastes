# Segurança — contexto do projeto

> **Status deste documento:** preenchido na TASK-037 (2026-09-26) com o estado de `development` @
> `d58edf6`. O sistema roda **só em ambiente local**, sem autenticação (P-009) e com limites de
> upload **provisórios** (P-008): não deve ser exposto fora da máquina. Este arquivo descreve a
> situação de segurança **deste projeto**. As regras universais que todo agente segue estão em
> [`policies/security.md`](policies/security.md) e não precisam ser repetidas aqui.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 (TASK-037) |
| Responsável por segurança | PENDENTE: não designado (equipe e papéis em aberto, [`known-gaps.md`](known-gaps.md) P-012); até lá, a pessoa responsável pelo projeto ([`project-overview.md`](project-overview.md)) |

---

## 1. Dados tratados pelo sistema

O sistema não tem usuários nem cadastro de pessoas: **não trata dado pessoal**.

| Dado | Classificação | Onde é armazenado | Base legal / observação |
|------|---------------|-------------------|-------------------------|
| Catálogo (fabricantes, modelos, configurações e ficha técnica geométrica) | interno (técnico) | PostgreSQL (`manufacturers`, `cranes`, `crane_configurations`) | hoje só dados FICTÍCIOS de teste e demo |
| Tabelas de carga e seus pontos | interno (técnico; dado oficial do fabricante, quando chegar) | PostgreSQL (`load_charts`, `load_chart_points`) | se os dados oficiais podem ir ao repositório e a agentes de IA está **PENDENTE** (P-007) |
| Arquivo-fonte das tabelas importadas (CSV/XLSX) | interno (técnico) | disco local em `FILE_STORAGE_DIR`, nomeado pelo SHA-256 | fora do repositório; retenção e limpeza de arquivos órfãos **PENDENTES** (TASK-031 § 8 item 8) |
| Logs do backend | interno | saída do processo (uvicorn / `docker compose logs`) | a verificação de saúde registra só o tipo do erro; erros de configuração não repetem a `DATABASE_URL`; retenção não definida |

Regra para agentes: dados classificados como **pessoal** ou **sensível** nunca aparecem em logs,
mensagens de erro, fixtures de teste ou documentação.

---

## 2. Autenticação e autorização

| Aspecto | Como funciona neste projeto | Onde está no código |
|---------|-----------------------------|---------------------|
| Autenticação | **nenhuma** ("autenticação futura", doc-fonte § 8.4; P-009, L-003): qualquer cliente que alcance a API pode cadastrar, importar e ativar tabelas, o que afeta a capacidade calculada | — |
| Autorização | nenhuma (sem papéis) | — |
| Sessão | nenhuma; o WebSocket de avaliação não valida `Origin` nem limita taxa de mensagens (P-009) | `backend/app/presentation/websocket/evaluation.py` |
| Senhas | não há senhas de usuário; a única credencial é a do banco (§ 3) | — |
| CORS | nenhum middleware CORS configurado; o frontend usa a mesma origem (proxy do Vite ou do nginx) | `frontend/vite.config.ts`, `frontend/nginx.conf.template` |

Mitigação atual: todas as portas do Docker Compose são publicadas só em `127.0.0.1`
(`docker-compose.yml`), e os containers do backend e do frontend rodam sem root.

---

## 3. Segredos e configuração

| Segredo | Local | CI | development | homologation | production | Rotação |
|---------|-------|----|-------------|--------------|------------|---------|
| `POSTGRES_PASSWORD` (e `POSTGRES_USER`, `POSTGRES_DB`) | `.env` da raiz (lido pelo Docker Compose) | valor descartável no próprio workflow (`ci_only_not_a_secret`, só para o container efêmero) | PENDENTE (sem implantação; P-011) | PENDENTE | PENDENTE | PENDENTE |
| `DATABASE_URL` (contém a senha) | `.env`, exportado no shell para backend, Alembic e testes | idem, no ambiente do job `backend` | PENDENTE | PENDENTE | PENDENTE | PENDENTE |
| `BACKEND_DATABASE_URL` (opcional) | `.env` (lido pelo Compose) | não usada | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

Os *secrets* de cada ambiente ficariam no GitHub Environment de mesmo nome da branch; o job `deploy`
do CI ainda é placeholder e nenhum Environment está configurado. Ver
[`guides/git-github.md`](guides/git-github.md) § 8.3.

**Nunca** no repositório. `.env.example` lista os nomes, sem valores. O `repr` das configurações do
banco mascara a senha e as mensagens de erro não ecoam a URL (`backend/app/infrastructure/database/config.py`).

---

## 4. Superfície de ataque conhecida

Todos os limites abaixo são **PROVISÓRIOS — A VALIDAR (P-008)**, escolhidos para o ambiente local.

| Entrada | Validação existente | Riscos considerados |
|---------|---------------------|---------------------|
| Upload de tabela CSV para validação (`POST /api/v1/load-charts/validate`) | arquivo ≤ 1 MiB e corpo ≤ 1 MiB + 16 KiB, recusados com 413 antes de ler o formulário; UTF-8 obrigatório; nada é gravado | tamanho; conteúdo malformado vira relatório de inconsistências, sem exceção |
| Upload de tabela CSV/XLSX com gravação (`POST /api/v1/load-charts/import`) | mesmos limites de tamanho; formato escolhido pelo nome/tipo do arquivo (415 se não reconhecido); XLSX: ≤ 10 MiB descompactado e ≤ 10 000 linhas, conferidos antes do openpyxl; openpyxl com `read_only`, `data_only`, `keep_vba=False`, `keep_links=False`; fórmulas nunca avaliadas; tabela inválida não é gravada | zip bomb, macros, links externos; `defusedxml` **não** está instalado (TASK-023 § 8 item 4); CSV sem limite de linhas além do tamanho |
| Arquivo-fonte gravado no disco | nome derivado só do SHA-256 calculado (nunca do nome enviado); URI `local://<sha256>` validada por regex e caminho resolvido dentro de `FILE_STORAGE_DIR`; escrita em temporário + `os.link` (nunca sobrescreve) | path traversal, sobrescrita, arquivo trocado (erro de integridade) |
| JSON da avaliação e do catálogo (REST) | schemas Pydantic estritos, sem campos extras, sem `NaN`/infinito; handler do 422 que não quebra com números não finitos | payload malformado; nomes sem limite de tamanho nem normalização (TASK-030 § 8) |
| WebSocket de avaliação | mensagem ≤ 8 KiB (bytes UTF-8); JSON recusando `NaN`/`Infinity`; validação estrita; qualquer recusa vira `simulation.error` sem fechar a conexão | sem `Origin`, sem autenticação, sem limite de taxa; `--ws-max-size` do uvicorn não configurado (TASK-025 § 8) |
| nginx do frontend (container) | `client_max_body_size 10m`, `server_tokens off`, `X-Content-Type-Options: nosniff` | — |
| Modelo 3D (GLB/glTF) | carregado só no navegador a partir de arquivo do repositório; **sem upload** para o backend | limites de tamanho/polígonos para upload futuro **PENDENTES** (P-008) |

---

## 5. Dependências

- Ferramenta de auditoria: **PENDENTE** (não definida; TASK-011 § 8 item 6) — comando: nenhum
  ([`development-guide.md`](development-guide.md) § 3, "A VALIDAR").
- Roda no CI? não.
- Dependabot habilitado? não (não há `.github/dependabot.yml`).
- Dependências novas e licenças são registradas nos handoffs (ex.: psycopg 3 é LGPL-3.0, aceitação
  **PENDENTE** em `handoffs/current.md` § 7; `openpyxl` MIT, TASK-023).

---

## 6. Checklist de segurança por tarefa

O revisor verifica (também está em [`checklists/code-review-checklist.md`](checklists/code-review-checklist.md)):

- [ ] nenhuma credencial, token ou dado pessoal real no diff;
- [ ] entradas externas validadas antes do uso;
- [ ] erros não vazam detalhes internos (stack trace, SQL, caminhos);
- [ ] dependências novas justificadas no handoff e sem vulnerabilidade conhecida;
- [ ] autorização verificada em toda operação nova que toca dado de usuário.

---

## 7. Incidentes e reporte

PENDENTE: não há canal definido pela equipe. O que já vale para agentes
([`policies/security.md`](policies/security.md) §§ 1 e 9): não corrigir em silêncio nem expor
detalhes em issue pública; registrar o achado, com o mínimo necessário, na seção "⚠️ Segurança" do
handoff da tarefa; a pessoa responsável decide como tratar. Segredo já commitado é incidente e
precisa ser rotacionado, não só removido.
