# ADR-042 — conferência contínua do plano: giro denso, lança, cabo, coleta e entrega

| Campo                  | Valor                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| **Status**             | Proposto                                                                 |
| **Data**               | 2026-10-16                                                               |
| **Autor**              | agente Claude Code (Opus 5.5), sessão de 2026-10-16                      |
| **Decisores**          | Anderson Sehnem (pendente de confirmação)                                |
| **Tarefa relacionada** | TASK-088                                                                 |
| **Complementa**        | ADR-038 (planejamento da operação); substitui só a frase "O giro é amostrado da coleta à entrega (12 trechos)" do ADR-038 § Decisão, "Caminho", quanto à conferência de colisão |

## Contexto

A auditoria AUD-01 (2026-10-16) provou que o planejador do ADR-038 aprovava planos impossíveis:
o giro era conferido só nos 13 quadros-chave (F-01: um poste a meio caminho entre duas amostras
passava, e a trajetória reproduzida tinha 230 quadros com a carga dentro dele); só a carga era
conferida, nunca a lança nem o cabo (F-02: lança atravessando um prédio de 12 m); e a coleta e a
entrega usavam sempre a altura do terreno, sem conferir as fases verticais (F-13: gancho dentro de
um galpão, carga solta dentro de uma carreta).

## Decisão

1. **Giro em grade densa.** Os quadros-chave da trajetória continuam 12 trechos (a animação não
   muda), mas a conferência usa uma grade com no máximo 0,25 m entre amostras no maior raio (teto de
   1440 trechos; acima dele o passo cresce e a margem cresce junto). Cada distância conferida ganha
   meio passo, então nada entre duas amostras escapa. A distância a uma forma muda no máximo um passo
   por amostra, e a busca pula as amostras que certamente estão longe.
2. **Terreno sob a carga.** A altura de transporte usa um limite superior do terreno no círculo da
   carga em todo o giro (plano inclinado mais o pico de cada feição que o toca), não 13 pontos.
3. **Lança e cabo.** Em cada amostra densa do movimento como a cena o interpola (L, θ, ψ e c em
   linha reta entre os quadros-chave), conferem-se a carga, o cabo com o gancho e as lingas (linha
   vertical da ponta ao topo da carga, meia-largura FICTÍCIA de 0,3 m) e a lança (do pino à ponta,
   meia-seção FICTÍCIA de 0,6 m). Também a pose de partida, a aproximação e as poses de coleta e de
   entrega (que cobrem engatar, levantar e baixar). A opção que bate é descartada; o motivo aparece
   nas notas quando nada atende ("com a lança batendo em obstáculo"...).
4. **Coleta.** Carga com a pegada (largura em X local, comprimento em Z local, como a cena) sob ou
   dentro de qualquer obstáculo é recusada antes da busca, com o nome dele: o gancho não a alcança
   por cima (a cena assenta a carga no terreno).
5. **Entrega.** Só o veículo-plataforma (`is_platform_vehicle`: carreta ou caminhão plataforma, a
   mesma regra do layout da IA da TASK-081) recebe a carga por cima: ela pousa no topo dele (no
   caminhão plataforma da biblioteca, no topo da caixa do modelo, porque o backend não conhece a
   altura da carroceria). Outro obstáculo sob a pegada recusa a entrega. A pegada na entrega é girada
   do quanto a torre girou (a carga gira com o gancho); no tandem, vale o giro pedido para a entrega.
6. **Base da carga.** Na coleta e na entrega, a base da carga fica no ponto mais alto do terreno
   sob a pegada (espelho de `cargoBaseY` do frontend).

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| Grade densa com margem de meio passo (escolhida) | simples, conservadora, prova fácil; o pulo de amostras mantém o custo | quinas dos obstáculos crescidas em quadrado (um pouco conservador) | — |
| Mais quadros-chave na trajetória | sem código novo de conferência | a animação fica mais lenta (0,4 s mínimos por trecho) e o custo da avaliação cresce | muda a tela e não resolve a lança |
| Interseção analítica do anel varrido com os retângulos | exata | espiral (raio variável) contra retângulos girados, cilindros, terreno e lança: muitos casos | custo de manutenção alto |

## Consequências

**Positivas:**
- O plano deixa de atravessar obstáculos finos, prédios e o galpão da coleta; a carga pousa sobre a
  carreta em vez de dentro dela.
- As posições passam a ser avaliadas em ordem de raio, parando nas 30 primeiras livres (o resultado é
  o mesmo de avaliar todas), e o corpo do guindaste ganhou um pré-filtro: a busca ficou 2,5 a 3 vezes
  mais rápida no fixture (handoff da TASK-088 § 4).

**Negativas / custos:**
- Cenários da IA com a carga dentro do "barracão aberto" (o prompt pede isso) passam a ser
  recusados, com o motivo. A carga precisa ficar fora do barracão.
- Entregar sobre um container ou outra caixa que não é a carreta é recusado.
- As contagens de descarte das notas mudam (só as posições avaliadas contam).

**Riscos e como mitigar:**
- A cena só solta a carga perto do terreno (`checkRelease`, `cargoOperation.ts:263`): com a carga
  planejada sobre a carreta, a soltura na tela ainda falha. Registrado no handoff da TASK-088 para
  uma tarefa do frontend.
- Meias-medidas da lança e do cabo são FICTÍCIAS (ADR-012): trocar pelas da ficha técnica.

## Impacto na documentação

- [ ] `docs/architecture.md` atualizado — não descreve o planejador por dentro; nada a mudar
- [ ] `docs/development-guide.md` atualizado — comandos não mudaram
- [ ] `docs/known-gaps.md` atualizado — a diferença com a soltura da cena ficou no handoff (outras frentes editam o arquivo em paralelo)
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- Verificado: provas p1, p2 e p8 da auditoria rodadas contra o código antes (`784a9e1`) e depois;
  testes de regressão em `backend/tests/application/test_recommend_lift_plan_caminho.py` e
  `backend/tests/domain/services/planning/test_sweep.py`.
- Verificado: medições de tempo antes e depois no handoff da TASK-088.
- Hipótese: o desvio entre a reta amostrada e o raio que a cena interpola fica em L·Δθ²/8 por
  trecho (alguns centímetros); a folga de 0,15 m na escolha dos obstáculos cruzados o cobre, e a
  conferência da opção refaz a conta no movimento interpolado.
