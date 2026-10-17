# ADR-044 — colisões entre guindastes, da cadeia de acessórios e do terreno sob a carga

| Campo                  | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Status**             | Aceito                                                   |
| **Data**               | 2026-10-16                                               |
| **Autor**              | agente Claude Code (Opus 5.5), sessão de 2026-10-16      |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-17                   |
| **Tarefa relacionada** | TASK-091                                                 |
| **Substitui**          | — (complementa o ADR-028, que segue Aceito e sem mudança) |

## Contexto

A auditoria de 2026-10-16 mostrou que a matemática do ADR-028 (OBB, SAT de 15 eixos) está certa, mas
a cobertura não: com dois guindastes fora do tandem só se comparava corpo com corpo (F-07); a cadeia
de acessórios ficava fora da colisão (F-10); o terreno era amostrado com no máximo 12 pontos por
aresta, e não com o passo de 0,5 m que o ADR-028 descreve (F-17); e o tandem usava a caixa envolvente
dos objetos da biblioteca (F-23). A RN-012 já pede que a carga e os acessórios não atravessem o terreno,
o corpo do guindaste nem os obstáculos.

## Decisão

1. **O que pende de cada guindaste contra os outros**, com ou sem tandem: a carga, o gancho e a
   cadeia de acessórios de um guindaste são conferidos contra todas as caixas do corpo dos outros
   (`multiCraneCollisions.ts`, `MultiCrane.crossReport`), e bloqueiam o comando como as outras
   colisões da carga. O **cabo** (de G à ponta) de um guindaste contra a **lança** de outro também
   **bloqueia** (aceito por Anderson Sehnem, em chat em 2026-10-17: "pode bloquear o cabo contra a
   lança de outro guindaste"): é contato entre guindastes, como lança contra lança (contra obstáculos, o cabo
   continua só alertando, ADR-028 § 2). O cabo vira uma caixa fina vertical de 0,1 m de lado
   (FICTÍCIO, `CABLE_HALF_WIDTH_M`), para ter profundidade de penetração. A colisão leva o nome do
   guindaste dono (`CollisionHit.owner`), e só a carga dele fica vermelha.
2. **Cadeia de acessórios** como uma caixa de G − `attachOffsetM` até G − `attachOffsetM` − soma de
   `riggingHeightM` (os mesmos valores com que a cena desce a carga, lidos de `HookLoad`), com 0,3 m de
   lado (FICTÍCIO, `ACCESSORY_CHAIN_HALF_WIDTH_M`: o catálogo não tem largura de acessório). Como o
   gancho, ela é conferida contra o terreno, os obstáculos (inclusive a carga no chão) e o
   chassi/torre, não contra a lança de onde pende.
3. **Terreno sob a caixa**: as caixas da carga, do gancho e da cadeia só giram em Y, então basta a face
   de baixo, numa grade de passo fixo de 0,5 m com teto de 1 024 pontos **no total** (acima disso o
   passo cresce por igual), mais os picos analíticos das feições que tocam a pegada (ponto da pegada
   mais perto do centro de elevação, platô e aplainamento; borda alta e laterais da rampa).
   `terrainSampling.ts`. Uma caixa inclinada (não acontece hoje) volta à superfície inteira, com o
   mesmo teto no total.
4. **Tandem e biblioteca**: a carga do tandem usa `obstacleObbs`, como o guindaste único.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| A (escolhida) caixas do que pende contra o corpo dos outros; cabo contra lança bloqueia | mesma guarda e mesma mensagem das outras colisões | larguras FICTÍCIAS | — |
| Cabo contra a lança do outro só alertar (como contra obstáculo) | igual ao ADR-028 § 2 | deixa um guindaste passar a lança pelo cabo do outro sem parar | contato entre guindastes já bloqueia (lança × lança) |
| Carga contra carga de dois guindastes | cobre mais um caso | no tandem os dois ganchos ficam juntos na carga e acusariam | fora dos critérios; fica em "testes a escrever depois" |
| Terreno: só aumentar o teto por aresta | mudança mínima | custo cresce com o tamanho da carga e um monte mais estreito que o passo ainda passa | os picos analíticos resolvem o caso estreito |

## Consequências

**Positivas:** a RN-012 vale também entre guindastes e para os acessórios; cargas compridas veem
montes estreitos; menos falso alarme no tandem.

**Negativas / custos:** a cruzada entre dois guindastes passou de ~0,008 ms para ~0,04 ms por
avaliação (medido; a avaliação do próprio guindaste fica em ~0,3 ms). A largura da cadeia e a do
cabo são FICTÍCIAS.

**Riscos e como mitigar:** com o moitão de 4 polias na cadeia (`replacesHook`), `HookLoad` ainda
devolve a amarração do gancho escondido (F-09, TASK-093); a caixa da cadeia herda esse valor até a
TASK-093 corrigir os getters. A carga no chão assenta pelo maior de 9 pontos (`cargoBaseY`), não pela
grade nova: sobre um monte estreito no meio da pegada, a carga pendurada para no monte e "Soltar" pode
dizer que ela está no ar.

## Impacto na documentação

- [ ] `docs/architecture.md` atualizado (não cita as colisões em detalhe; nada a mudar)
- [ ] `docs/known-gaps.md` atualizado (a pendência do cabo contra a lança foi decidida em 2026-10-17: bloqueia; veja Decisores)
- [ ] índice em `docs/decisions/README.md` atualizado (fica para quem integrar as frentes paralelas,
      como no ADR-028, para não conflitar)

## Evidências

Verificado com testes em `frontend/tests/domain/collision/` e `frontend/tests/three/scene/` (saídas no
`handoffs/TASK-091.md`), com as sondas da auditoria rodadas antes e depois e com o tempo medido nos
dois. A largura de 0,3 m da cadeia e a de 0,1 m do cabo são hipóteses FICTÍCIAS, não medidas.
