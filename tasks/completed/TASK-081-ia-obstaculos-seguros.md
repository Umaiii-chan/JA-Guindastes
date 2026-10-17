# TASK-081 — IA: obstáculos em lugares possíveis

Contexto: em "gerar cenário a partir de texto" (TASK-076), o modelo de linguagem às vezes põe um obstáculo em lugar impossível (um carro sobre o guindaste, ou sobre o ponto de entrega). Regras: RN-004 e RN-008 (a IA não decide segurança); a correção é por código determinístico.

## Critérios de aceite

- [x] **CA-1** — Serviço de domínio puro `backend/app/domain/services/scenario_layout.py` desloca, depois da IA, os obstáculos que invadem zonas reservadas: guindaste principal e adicionais (retângulo 14 m x 8 m girado pelo `heading_deg`), carga na coleta (medidas da carga + 1,5 m de folga) e entrega (raio + 1 m).
- [x] **CA-2** — O deslocamento é radial a partir do centro da zona, em passos de 0,5 m, até não sobrepor nenhuma zona nem outro obstáculo já posicionado (limite de 60 m).
- [x] **CA-3** — Carreta ou caminhão plataforma (`caminhao-plataforma` ou rótulo com "carreta"/"plataforma") pode ficar sobre a entrega, mas não invade guindaste nem coleta. O barracão aberto (de onde a carga sai) também pode cobrir coleta e entrega.
- [x] **CA-4** — Cada obstáculo movido gera uma suposição em pt-BR no rascunho (ex.: "Carro movido de (3; -12) para (6,5; -14) para não ficar sobre o guindaste."), mostrada em "Suposições do assistente".
- [x] **CA-5** — O prompt de `scenario_from_text` reforça: área livre em volta do guindaste e das patolas; nada sobre a coleta; sobre a entrega, só a carreta de destino.
- [x] **CA-6** — Esforço de raciocínio configurável: `GROQ_REASONING_EFFORT` e `OPENAI_REASONING_EFFORT` (low|medium|high; vazio = não enviar; inválido = aviso e ignora), enviado como `reasoning_effort` a qualquer modelo; se o provedor recusar (HTTP 400 com `error.param`), o parâmetro sai e o pedido se repete. Documentado em `.env.example`, `render.yaml`, `docker-compose.yml` e `docs/deployment-railway.md`.

Testes essenciais: `backend/tests/domain/services/test_scenario_layout.py` (carro sobre o guindaste, carro sobre a entrega, carreta na entrega), `backend/tests/infrastructure/test_openai_provider.py` e `backend/tests/test_ai_composition.py` (esforço de raciocínio).

## Testes a escrever depois

- Guindastes adicionais e giro do guindaste (`heading_deg`).
- Carga girada na coleta; barracão aberto cobrindo a coleta.
- Falha por limite de 60 m (o obstáculo fica onde estava).
- Caso de uso `scenario_from_text` com resposta falsa do modelo trazendo o carro sobre o guindaste, conferindo a suposição no rascunho.
- Exibição das novas suposições na prévia do frontend.


## Encerramento

Mergeada pela pessoa responsável em 2026-10-14 (PR #35). Revisão independente (AGENTS.md § 3) dispensada por ela (autorização permanente, `handoffs/current.md` § 3, item 1).
