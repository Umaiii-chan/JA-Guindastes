# ADR-039 — assistente de IA (Gemini): cenário por texto, explicação, relatório e revisão

| Campo | Valor |
|-------|-------|
| **Status** | Aceito (Anderson Sehnem, em chat em 2026-10-14) |
| **Tarefa** | TASK-076 |
| **Regras** | RN-004 e RN-008 (a IA nunca decide capacidade, utilização nem segurança) |

## Contexto

A pessoa pediu quatro usos de IA no simulador: (1) descrever uma operação em texto e receber o
cenário, a carga e a entrega; (2) explicar a recomendação do planejador; (3) gerar o relatório de
içamento para imprimir e exportar; (4) revisar uma gravação. Capacidade e segurança vêm só do cálculo
determinístico (tabela, limites, RN-011 a RN-015): isso não muda.

## Decisão

- **Provedor:** Gemini API (chave do Google AI Studio, faixa gratuita), por HTTP simples
  (`urllib`, sem dependência nova) em `app.infrastructure.ai.gemini_provider`, atrás da porta
  `LlmProvider` (`app.application.ports.llm_provider`). Endpoint
  `POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`, chave no
  cabeçalho `x-goog-api-key` (nunca na URL, em log, em mensagem de erro nem no frontend).
- **Modelos:** padrão `gemini-3.7-flash`; reservas `gemini-3-flash-preview` e
  `gemini-flash-lite-latest`. Variáveis: `GEMINI_API_KEY` (sem ela, a IA fica desligada),
  `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` e `AI_RATE_LIMIT_PER_HOUR` (padrão 20).
- **Resiliência:** o modelo padrão às vezes responde "high demand" (503). Cada modelo é tentado até
  2 vezes, com espera de 1,5 s, em erro passageiro (500, 502, 503, 504, rede); 429, 404 e prazo
  vencido passam direto ao próximo modelo. Prazo de 20 s por chamada e de 55 s no total. A resposta
  diz qual modelo respondeu (`model`, `fallback_used`), e a tela mostra isso.
- **Raciocínio limitado:** `thinkingConfig.thinkingLevel = "low"`. Sem isso, uma resposta
  estruturada levou até 44 s no `gemini-3-flash-preview`; com ele, 4 s (medido em 2026-10-14). Se um
  modelo recusar o nível (HTTP 400), o adaptador repete sem ele.
- **Quatro usos (`/api/v1/ai/*`, mesma autorização da avaliação: sessão de qualquer perfil):**
  1. `scenario-from-text`: a resposta é JSON estruturado (`responseMimeType: application/json` e
     `responseSchema`), convertido em `ScenarioSpec` pelo **mesmo domínio** que valida os cenários
     salvos, mais a carga (`Load`, mesma validação) e a posição da carga e a entrega
     (`cargo` e `delivery`, contrato da leva F). A pessoa vê a prévia e só então aplica.
  2. `explain-recommendation`: recebe a recomendação como o planejador a calculou e a explica.
  3. `lift-report`: o backend **avalia de novo** o estado enviado (RN-008); a tabela "Dados do
     cálculo" é montada por código a partir dessa avaliação, e a IA escreve só o texto descritivo.
  4. `review-recording`: os indicadores (picos de utilização, quadros por situação, alertas,
     colisões, linha do tempo resumida) são calculados por código; a IA comenta e sugere.
- **Limites:** descrição de até 1.500 caracteres; dados de contexto de até 20.000 caracteres; 20 usos
  por hora por usuário, em memória (por processo, como o limite de login, ADR-016); cada chamada
  conta antes de ir ao provedor.
- **Injeção de prompt:** o texto do usuário e os dados vão entre marcas `<dados>`, sem `<` nem `>`, e
  as instruções mandam tratá-los como conteúdo. Toda saída estruturada é validada antes de chegar à
  tela; textos viram elementos da página (Markdown próprio, nunca HTML).
- **Frontend:** `GET /ai/status` decide se o assistente aparece; com `enabled=false` (ou erro), nada
  do assistente é desenhado. Botão "Assistente" na barra do simulador, "Gerar relatório de içamento"
  sob o resultado, "Revisar" na lista de gravações e `ExplainRecommendationButton`, componente
  exportado que recebe a recomendação por props (o painel do planejador é da TASK-075).
  O relatório é Markdown renderizado, imprimível (cópia própria com CSS `@media print`) e exportável
  em `.md`.

## Consequências

- A faixa gratuita tem cota e instabilidade: o uso é limitado e as falhas viram mensagens amigáveis
  (503, 504, 429 do usuário, 502 de resposta inutilizável). Os modelos mudam de nome com frequência;
  por isso ficam em variáveis de ambiente.
- O limite por usuário é por processo: com mais de uma réplica, cada uma conta as suas.
- A qualidade do cenário depende do modelo; por isso há prévia, suposições listadas e aplicação
  explícita. A posição da carga e da entrega só desenha quando a TASK-073 integra; os campos já são
  salvos no cenário.
- Os textos da IA não são determinísticos e não substituem o plano de içamento do responsável técnico
  (o relatório diz isso no rodapé).
