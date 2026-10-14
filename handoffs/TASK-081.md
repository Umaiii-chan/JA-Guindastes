# Handoff — TASK-081 — implementação

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Tarefa** | `tasks/in-progress/TASK-081-ia-obstaculos-seguros.md` |
| **Etapa concluída** | implementação |
| **Papel exercido** | Implementador |
| **Ferramenta/agente** | Claude Code (subagente da leva F) |
| **Branch** | `task/TASK-081-ia-obstaculos-seguros`, a partir de `anderson/development` |

## O que foi feito

- `backend/app/domain/services/scenario_layout.py` (novo, domínio puro): `make_scenario_layout_safe(spec, load_length_m, load_width_m)` devolve o cenário com os obstáculos fora das zonas reservadas e a lista `ObstacleMove` (cada uma com `describe()` em pt-BR). Geometria: retângulos girados por teste do eixo separador; círculo da entrega por distância ao retângulo; só encostar na borda não conta como sobreposição.
- `ai_assistant.py` (`_draft_from_json`): chama o serviço depois de montar o `ScenarioSpec` e acrescenta as frases às suposições do rascunho (as da IA continuam limitadas a 10; as de deslocamento vêm depois).
- `ai_prompts.py`: regra "Área livre" no `SCENARIO_SYSTEM`.
- Esforço de raciocínio: `OpenAiProvider(reasoning_effort=...)`, lido em `ai_composition.py` (`GROQ_REASONING_EFFORT`, `OPENAI_REASONING_EFFORT`); documentado em `.env.example`, `render.yaml`, `docker-compose.yml` e `docs/deployment-railway.md`.

## Decisões e suposições (verifique antes de confiar)

- Constantes do guindaste (14 m x 8 m): não procurei constantes de chassi/patolas no backend além do domínio (a geometria das patolas está no frontend), então usei as do pedido. O comprimento fica ao longo da frente (+Z local) e a largura em X local, como em `craneAttitude.ts`; o giro segue a convenção do editor 3D (rotação em Y).
- Pegada de caixa, cilindro e modelo: sempre retângulo `width_m x depth_m` (cilindro também, de forma conservadora).
- Exceção além do pedido: o `barracao-aberto` (a carga sai de dentro dele, regra do prompt) não é movido por causa da coleta, da entrega nem de outros objetos; só do guindaste. Sem isso, o barracão seria empurrado para longe da carga.
- Ordem: ancorados (barracão) primeiro; os demais na ordem da IA. Se não achar vaga em 60 m, o obstáculo fica onde estava, sem suposição.
- Direção radial: do centro da zona invadida (a primeira da lista) para o centro do obstáculo; centros coincidentes andam para +X.
- `reasoning_effort` configurado vale para qualquer modelo; sem ele, continua o comportamento antigo (só gpt-5/o* recebem o nível do pedido).

## Gates (em `backend/`)

| Comando | Resultado |
|---------|-----------|
| `uv run ruff check .` | passou |
| `uv run ruff format --check .` | passou (318 arquivos formatados) |
| `uv run mypy app` | passou (173 arquivos) |
| `uv run lint-imports` | passou (3 contratos mantidos) |
| `uv run pytest` (domínio, aplicação, apresentação, infraestrutura, `test_ai_composition.py`) | passou; testes de integração com banco pulam sem Postgres local |

## Testes a escrever depois

Ver a seção de mesmo nome em `tasks/in-progress/TASK-081-ia-obstaculos-seguros.md`.
