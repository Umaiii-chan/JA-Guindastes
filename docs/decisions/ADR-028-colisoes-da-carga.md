# ADR-028 — colisões da carga: OBB, SAT e guarda de comandos na cena

| Campo                  | Valor                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Status**             | Proposto                                                               |
| **Data**               | 2026-10-14                                                             |
| **Autor**              | agente Claude Code, sessão de 2026-10-14                               |
| **Decisores**          | Anderson Sehnem                                                        |
| **Tarefa relacionada** | TASK-053                                                               |
| **Substitui**          | —                                                                      |

## Contexto

A RN-012 pede que a carga suspensa e os acessórios não atravessem o terreno, o corpo do guindaste nem
os obstáculos, e que o comando que causaria colisão seja bloqueado no último estado seguro e
sinalizado. O terreno e os obstáculos são descritos pelo contrato da leva E
(`domain/environment/environment.ts`); o desenho deles é da TASK-052. Capacidade e segurança seguem
sendo decididas só no backend (RN-008): a colisão é lógica de cena, em pré-visualização.

## Decisão

1. **Módulo puro** `frontend/src/domain/collision/` (sem Three.js, ADR-005): caixas orientadas (OBB),
   teste por eixos separadores (SAT, 15 eixos), segmento contra caixa (lajes) e a avaliação
   (`evaluateCollisions`). A caixa da carga (`loadBox.ts`) passou de `three/scene/` para o domínio;
   o arquivo antigo reexporta.
2. **Quem colide.** A carga (e, sem carga, o gancho) contra: o terreno (amostragem da superfície da
   caixa contra `terrainHeightAt`, folga de 0,1 mm); o corpo do guindaste (uma caixa por nó
   `crane-base`, `crane-turret`, `crane-boom` e `crane-boom-extension`, medida no rig em uso, serve ao
   provisório e ao GLB); e os obstáculos (SAT; o cilindro vira a caixa que o envolve, aproximação
   conservadora). O **gancho sem carga não é testado contra o corpo**: ele sobe até a ponta da lança
   por construção e a caixa aproximada daria falso positivo. O **cabo (T a G) e a lança (P a T)
   contra obstáculos só geram alerta**.
3. **Posição no mundo.** G, T e P vêm da geometria operacional do ADR-013 (fórmulas 1 a 5); o
   guindaste fica em `scenario.crane`, apoiado em `terrainHeightAt` nesse ponto, com o rumo
   `headingDeg` girando o chassi em torno de +Y (mesmo sentido de `rotation.y`; 0° = cena original).
4. **Guarda de comandos** em `SwitchableCrane.setCollisionGuard`: o estado proposto é avaliado; se
   colide e o anterior era seguro, busca binária (30 iterações) entre o valor anterior e o pedido
   aplica o estado seguro mais próximo (cabo para no contato, sem carga o gancho para no chão). Se o
   estado anterior já colidia (o cenário mudou sob o guindaste), os comandos passam sem corte, para a
   pessoa poder sair; o estado segue sinalizado. A busca assume um trecho seguro contínuo a partir
   do valor anterior.
5. **Handle e UI.** `mountCraneScene` ganha `setEnvironment(ScenarioSpec)`, `getCollisionState()` e a
   opção `onCollisionChange`; a carga atingida fica vermelha e o obstáculo ou a peça do guindaste
   atingida ganha contorno vermelho. `CraneViewport` ganha as props `scenario` e `onCollisionChange`;
   `useCollisionState` expõe o estado à UI e à gravação (TASK-057); `CollisionAlerts` mostra os
   alertas acima do resultado.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| A (escolhida) OBB + SAT no domínio, guarda no `SwitchableCrane` | testável sem WebGL; vale para provisório e GLB | caixas por nó são aproximadas | — |
| Raycast / malhas do Three.js | colisão exata | depende de WebGL e de malhas; difícil de testar | contra o ADR-005 |
| Bloquear só no backend | uma só fonte | atraso de rede por quadro; o backend não conhece o cenário | RNF de resposta |
| Não bloquear, só avisar | simples | contraria a RN-012 | — |

## Consequências

**Positivas:** a RN-012 vale na cena; a lógica é pura e testada; o contrato (`setEnvironment`) deixa a
TASK-052 só desenhar.

**Negativas / custos:** o corpo é uma caixa alinhada ao nó (o chassi inteiro é uma caixa): a carga
pode raspar na cabine do chassi em poses baixas, como no pose inicial com carga de 4 m. O terreno é
amostrado (passo de 0,5 m), então cristas mais estreitas que isso podem passar.

**Riscos:** o gancho do GLB e o corpo medido dependem das malhas dos nós; um GLB com nós extras no
`crane-base` (patolas, TASK-054) aumenta a caixa da base.

## Impacto na documentação

- [ ] `docs/architecture.md` atualizado
- [ ] `docs/known-gaps.md` atualizado
- [ ] índice em `docs/decisions/README.md` atualizado (a pessoa que integra a leva E, para não
      conflitar entre as branches paralelas)
