# ADR-037 — içamento com dois guindastes (tandem)

| Campo                  | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Status**             | Aceito                                                       |
| **Data**               | 2026-10-14                                                   |
| **Autor**              | agente Claude Code, registrando pedido da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                       |
| **Tarefa relacionada** | TASK-074                                                     |
| **Complementa**        | ADR-022 (limite por modelo), ADR-023 (cenários), ADR-028 (colisões) |

## Contexto

Há cargas que um guindaste só não levanta. A pessoa responsável pediu o içamento com dois
guindastes pela regra de norma: cada um usa no máximo 75 % da própria capacidade, e a carga se divide
pela posição dos pontos de içamento em relação ao centro de gravidade (alavanca). RN-016.

## Decisão

1. **Divisão da carga no domínio** (`tandem_load_split.py`): o CG é projetado na reta entre os dois
   pontos de içamento; o ponto A leva `peso × (1 − t)` e o B leva `peso × t`, com `t` a posição do CG
   de A (0) a B (1). Com o CG na reta é exatamente "peso × distância do outro ponto ao CG ÷ distância
   entre os pontos". Com o CG fora do trecho entre os pontos, as partes ficam limitadas a 0 e ao peso
   todo, e o içamento não é permitido (alerta `TANDEM_CG_OUTSIDE_POINTS`).
2. **`POST /api/v1/evaluations/tandem`**: reaproveita o `EvaluateOperation` para cada guindaste, com
   o peso dele (o gancho entra pelo próprio caso de uso). O fator 0,75 entra como `capacity_factor` do
   `execute`, multiplicado à capacidade efetiva junto aos fatores de inclinação e de vento (RN-011,
   RN-015); o padrão 1 não muda a avaliação individual. `tandem_ok` só é verdadeiro quando os dois
   são avaliáveis, nenhum fica acima do limite do tandem e nenhum tem risco de tombamento alto. A
   faixa de atenção (a partir de 90 % do limite) conta como permitido, com alerta. Pontos de
   içamento iguais respondem 422. Os alertas são em pt-BR.
3. **Cenário**: `cranes?` (guindastes adicionais: `id`, `configurationId`, `placement`; até 3) e
   `cargo?` (`x`, `z`, `rotationYDeg`; contrato da TASK-073, criado aqui porque a TASK-073 corre em
   paralelo). Persistidos em `cranes` e `cargo` do JSON do cenário; cenários antigos continuam iguais.
4. **Cena**: cada guindaste adicional é um rig completo (o mesmo GLB) com controller, gancho,
   colisões e patolas próprios. O tandem usa os dois primeiros: o guindaste 1 conduz e o 2 acompanha.
   Os pontos de içamento ficam no comprimento da carga, a 1/4 e 3/4 dele. No engate, os dois ganchos
   vão aos pontos, na altura em que a carga apoia no chão (cinemática inversa, dentro dos limites da
   ficha). A cada comando do 1, a carga translada com o gancho dele e o 2 leva o gancho ao outro
   ponto, na mesma altura. O ângulo de lança escolhido é o mais próximo do atual, para o movimento
   ser contínuo.
5. **Colisões** (`multiCraneCollisions.ts`, sobre `domain/collision`): lança contra lança e contra
   o corpo do outro, e a carga içada contra o terreno, os obstáculos e o corpo dos dois. A guarda de
   comandos do que conduz inclui o guindaste 2 e a carga, então um movimento que o 2 não consegue
   seguir (fora do alcance) ou que faria algo colidir é cortado no último estado seguro.
6. **Tela**: seletor "Guindaste 1 / Guindaste 2" para os controles; seção "Içamento com dois
   guindastes" (ativar, posicionar a carga, engatar, soltar); ficha com a divisão (kg e %) e o uso do
   permitido de cada guindaste.

## Consequências

- A pré-visualização (alcance, cinemática inversa, colisões) é só desenho; a divisão e a segurança
  vêm do backend (RN-008).
- O tandem usa só o primeiro guindaste adicional. A gravação (TASK-057) continua gravando só o
  guindaste 1 e a carga do passo Carga. Os guindastes adicionais trabalham com as patolas estendidas
  e apoiadas, sem entrar no risco de tombamento por patolas do guindaste 1.
- O arranjo padrão é lado a lado, com as lanças paralelas: de frente um para o outro, as lanças
  (caixas medidas no modelo) se tocam com os ganchos a menos de ~4 m.
