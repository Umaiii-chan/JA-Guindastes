# ADR-013 — Convenções geométricas provisórias para o motor de cálculo e a cena 3D

| Campo | Valor |
|-------|-------|
| **Status** | Aceito |
| **Data** | 2026-09-26 |
| **Autor** | agente Claude Code (modelo Opus 5.5), sessão de 2026-09-26 |
| **Decisores** | Anderson Sehnem (aceita ou rejeita). Os itens marcados **A VALIDAR** dependem da Guindastes Ribas |
| **Tarefa relacionada** | TASK-009 |
| **Substitui** | — |

> **Este ADR é uma proposta provisória.** Ele serve para destravar o `GeometryService` e a PoC
> Three.js enquanto a Guindastes Ribas não responde. Não cria regra de negócio (não altera
> [`business-rules.md`](../business-rules.md)) e não traz nenhum valor oficial de guindaste. Cada
> item é de um de dois tipos:
>
> - **proposta de engenharia:** escolha interna do projeto, que a pessoa responsável pode aceitar sem
>   ouvir a empresa;
> - **A VALIDAR:** depende da Guindastes Ribas ou da documentação do fabricante. Até a resposta, vale
>   a proposta. Se a resposta for diferente, um novo ADR substitui este.

## Contexto

A doc-fonte ([`documentacao-tecnica-v0.1.md`](../produto/documentacao-tecnica-v0.1.md)) diz que o
`GeometryService` "calcula grandezas geométricas a partir do estado operacional" (§ 14.1). Também
pede raio e altura do gancho em tempo de execução (RF-015), um `SimulationState` com comprimento e
ângulo da lança, giro, cabo, raio e altura (§ 10.2) e um `CraneController` com
`getOperationalGeometry()` (§ 17.3). Mas ela **não define** a geometria:

- sistema de coordenadas, unidades, zero e sentido dos ângulos (P-001);
- de onde se mede o raio de trabalho e a altura do gancho (P-001);
- o que é "comprimento de lança" numa lança telescópica (P-002);
- onde ficam os dados geométricos do guindaste (P-003);
- como evitar que frontend e backend calculem geometrias diferentes (P-004).

Esses itens estão em [`known-gaps.md`](../known-gaps.md) § 4. O glossário de
[`project-overview.md`](../project-overview.md) § 9 também marca "Raio de trabalho" e "Comprimento de
lança" como **definição PENDENTE**.

Restrições que já valem:

- RN-003: o arquivo 3D não define capacidade; fornece representação e cinemática.
- RN-006: unidades internas consistentes.
- RN-007: consultas fora da tabela são identificadas explicitamente.
- RN-008: o backend valida os dados operacionais; o estado visual do frontend não é fonte de verdade.
- RNF-002: o domínio não depende de Three.js nem de React.
- RNF-004: escala física consistente, de preferência em metros.
- RNF-010: cálculo reproduzível.
- Doc-fonte § 2.2: simulação física de deformação de lança e cabos está fora do escopo.

**Se nada for decidido:** o `GeometryService` não pode ser escrito nem testado. A PoC Three.js vai
escolher convenções sem registro, e o backend provavelmente vai escolher outras (P-004). Os golden
tests (doc-fonte § 20.4) também não podem ser montados.

## Decisão

Propõe-se adotar, **provisoriamente**, as convenções C-1 a C-7 abaixo no domínio do backend, na API e
na cena 3D.

### C-1 — Sistema de coordenadas e unidades

| Item | Convenção proposta | Tipo |
|------|--------------------|------|
| Sistema | cartesiano **destro**, eixo **Y para cima** (contra a gravidade), plano horizontal XZ | proposta de engenharia |
| Origem | O = ponto onde o eixo de giro encontra o plano de apoio do guindaste ("nível do solo") | proposta de engenharia; o ponto exato do "solo" é **A VALIDAR** (G-6) |
| Orientação | eixos fixos no chassi: **+Z aponta para a frente do chassi** (lado da cabine de condução) | **A VALIDAR** (G-5) |
| Comprimento | **metro (m)** no domínio, na persistência, na API e na cena | proposta de engenharia (RNF-004, RN-006) |
| Ângulo | **grau (°)** no domínio, na persistência, na API e na UI, como os campos `*_deg` da doc-fonte § 14.2. Radianos só dentro das funções de cálculo e ao aplicar rotação no Three.js | proposta de engenharia |
| Premissas | guindaste nivelado (eixo de giro vertical, plano de apoio horizontal) e parado | simplificação (S-5) |

Os eixos do domínio são os mesmos do glTF e do Three.js, então não há troca de eixos entre backend e
cena. A especificação glTF 2.0 (§ 3.4) usa sistema destro, +Y para cima e +Z para frente, e diz que a
frente do asset fica voltada para +Z. No Three.js, `Object3D.DEFAULT_UP` é `(0, 1, 0)` e
`Object3D.rotation` usa radianos (ver "Evidências").

O domínio sempre trabalha no referencial do guindaste. Se a cena um dia posicionar o guindaste em
outro ponto do mundo (por exemplo, com obstáculos, RF-024), essa transformação é só de visualização.

### C-2 — Ângulos

**Giro da torre** (ψ, campo `turret_rotation_deg`):

- gira em torno do eixo Y (o eixo de giro);
- **zero:** a projeção horizontal da lança aponta para +Z, a frente do chassi (**A VALIDAR**, G-5);
- **sentido positivo:** anti-horário visto de cima (regra da mão direita em torno de +Y). É o mesmo
  sentido positivo de `rotation.y` no Three.js;
- ψ = 90° deixa a lança sobre o lado esquerdo do chassi (+X), ψ = 180° sobre a traseira (−Z) e
  ψ = 270° sobre o lado direito (−X). No glTF, −X é a direita do asset;
- o valor é guardado normalizado em [0°, 360°). Limites de giro, se o modelo tiver, vêm da ficha
  técnica (C-4);
- direção horizontal da lança: **u(ψ) = (sin ψ, 0, cos ψ)**.

Se a UI preferir mostrar o giro de outra forma (por exemplo, no sentido horário), a conversão fica na
apresentação. O domínio não muda.

**Inclinação da lança** (θ, campo `boom_angle_deg`):

- é o ângulo entre o eixo geométrico da lança (a reta que vai do pino do pé da lança P até o ponto
  de referência da ponta T, ver C-3) e o plano horizontal;
- **0° = horizontal**; positivo quando a ponta sobe; **90° = vertical**;
- as fórmulas valem para −90° < θ ≤ 90°. Os limites de operação (mínimo e máximo) vêm da ficha
  técnica (C-4). Se a lança pode operar abaixo da horizontal é **A VALIDAR** (G-8);
- se o fabricante mede o ângulo nessa mesma reta ou no eixo estrutural da lança é **A VALIDAR** (G-3).

### C-3 — Pontos de referência, raio e altura

| Ponto / grandeza | Definição proposta | Tipo |
|------------------|--------------------|------|
| **P** (pino do pé da lança) | centro do pino de articulação da lança, no plano vertical que contém o eixo de giro e a lança | proposta de engenharia |
| **T** (ponta da lança) | eixo da polia da ponta, de onde o cabo desce. Fica na reta que sai de P com inclinação θ | simplificação (S-3) |
| **G** (gancho) | ponto de suspensão da carga, na vertical que passa por T | simplificação (S-2, S-3) |
| **L** (`boom_length_m`) | distância de P a T | **A VALIDAR** (G-3) |
| **c** (`cable_length_m`) | distância vertical de T até G: quanto o gancho está abaixo da ponta. **Não depende** do número de partes de cabo e **não é** o cabo desenrolado do guincho | proposta de engenharia; **A VALIDAR** (G-6) |
| **Raio de trabalho** (`working_radius_m`) | distância horizontal do eixo de giro até a vertical que passa pelo gancho G. Com o cabo vertical, é igual à distância horizontal do eixo de giro até T | **A VALIDAR** (G-1) |
| **Altura do gancho** (`hook_height_m`) | cota vertical de G em relação ao plano de apoio (y = 0) | **A VALIDAR** (G-6) |

Suponho (sem evidência verificada) que medir o raio a partir do eixo de giro é a definição usual das
tabelas de carga. Por isso ela é a proposta, mas depende da confirmação da empresa (G-1), inclusive
sobre o raio da tabela incluir ou não a deflexão da lança com carga (risco R-1).

Para uma resposta diferente mudar um ponto só, o raio deve ser calculado numa **única função** do
domínio (por exemplo, `working_radius(state, geometry)`), separada do cálculo da posição do gancho.

### C-4 — Parâmetros geométricos do guindaste (ficha técnica no backend)

O domínio precisa guardar, por guindaste, os parâmetros abaixo. Se algum deles mudar com a
configuração (por exemplo, a altura do pino com a montagem dos estabilizadores), ele passa a ficar
por configuração (**A VALIDAR**, G-2). O nome `CraneGeometry` é só sugestão. A tarefa de modelagem
do domínio decide onde isso fica: atributos de `CraneKinematics`, entidade própria ou parte de
`CraneConfiguration`. Este ADR fixa só o conteúdo, as unidades e a origem dos dados.

| Parâmetro (sugestão de nome) | Símbolo | Unidade | Definição | Obrigatório |
|------------------------------|---------|---------|-----------|-------------|
| `boom_pivot_offset_m` | a | m | distância horizontal do eixo de giro até P, medida na direção u(ψ) da lança. **Tem sinal:** positiva se P fica do lado da ponta, negativa se fica atrás do eixo. O pino pode ficar à frente ou atrás do eixo conforme o modelo | sim (0 é válido) |
| `boom_pivot_height_m` | h | m | altura de P acima do plano de apoio | sim |
| `boom_length_min_m`, `boom_length_max_m` | L_min, L_max | m | faixa de L: lança toda recolhida e toda estendida. Iguais se a lança for fixa | sim |
| `boom_angle_min_deg`, `boom_angle_max_deg` | θ_min, θ_max | ° | faixa de θ | sim |
| `turret_rotation_min_deg`, `turret_rotation_max_deg` | ψ_min, ψ_max | ° | faixa de ψ, se o giro não for contínuo | não (sem valor = giro contínuo) |
| `cable_length_min_m`, `cable_length_max_m` | c_min, c_max | m | faixa de c, com c_min ≥ 0 | c_min sim; c_max não |

Regras propostas:

1. **Origem dos dados:** ficha técnica do guindaste cadastrada no backend (cadastro por API, doc-fonte
   § 15.1). Esses valores **nunca** são lidos do GLB (RN-003; P-003), e é com eles que o backend
   valida e calcula (RN-008). Proposta: guardar também de qual documento e revisão veio cada valor,
   como a RNF-005 pede para a tabela de carga.
2. **Enquanto a empresa não fornece a ficha técnica:** testes e PoC usam valores fictícios, rotulados
   FICTÍCIO ([ADR-012](ADR-012-toolchain-de-desenvolvimento.md)), nunca apresentados como dados do
   guindaste real.
3. **Relação com o GLB:** o asset deve ser coerente com esses parâmetros para a imagem bater com o
   cálculo. Mas, se não bater, o erro é só visual. Comparar as posições dos nós do GLB com os pontos
   calculados é um teste visual de calibração (doc-fonte § 12.1), e não fonte de dado.
4. **Pose de repouso do asset** (recomendação para a preparação do GLB): lança horizontal (θ = 0),
   apontando para +Z (ψ = 0) e toda recolhida. Se o asset vier em outra pose, o mapeamento de
   `CraneKinematics` registra os ângulos de repouso.

### C-5 — Fórmulas simplificadas

Entradas: estado operacional (L, θ, ψ, c) e parâmetros do guindaste (a, h).

```text
(1) alcance horizontal da ponta     R   = a + L·cos θ
(2) altura da ponta                 y_T = h + L·sin θ
(3) altura do gancho                y_G = y_T − c = h + L·sin θ − c
(4) raio de trabalho                working_radius = R            (definição C-3, A VALIDAR)
(5) posições no referencial do guindaste (x, y, z):
      pino    P = (a·sin ψ, h,   a·cos ψ)
      ponta   T = (R·sin ψ, y_T, R·cos ψ)
      gancho  G = (R·sin ψ, y_G, R·cos ψ)
```

Vista lateral, no plano vertical da lança (horizontal = direção u(ψ); vertical = +Y):

```text
  +Y
   |                   T   y_T = h + L·sin θ
   |                  /|
   |                 / |
   |            L   /  |   c (cabo vertical)
   |               /   |
   |              /    G   y_G = y_T − c
   |             / θ   :
   |            P------:----  (horizontal que passa por P)
   |            |      :
   |            | h    :
   |            |      :
   O------------+------+------>  u(ψ)
   |<--- a ---->|      |
   |<----- R --------->|       R = a + L·cos θ
   ^ eixo de giro              plano de apoio: y = 0
```

**Validade** (proposta de engenharia):

- o `GeometryService` sinaliza, e não corrige, estados fora das faixas de C-4: L fora de
  [L_min, L_max], θ fora de [θ_min, θ_max], c < c_min (ou c > c_max, se houver) e ψ fora dos limites;
- se R < 0, a ponta está atrás do eixo de giro. Nesse caso o raio **não** vira |R|: o estado é
  sinalizado como fora do domínio geométrico e não é consultado na tabela (RN-007, RF-020);
- y_G negativo (gancho abaixo do plano de apoio) não é bloqueado por este ADR (G-8).

**Simplificações explícitas:**

| # | Simplificação | Efeito conhecido |
|---|---------------|------------------|
| S-1 | **sem deflexão** da lança nem da estrutura com carga (doc-fonte § 2.2) | com carga, o raio real tende a ser maior que R (risco R-1) |
| S-2 | **cabo vertical**, rígido e sem massa. Sem balanço, vento ou inércia | G fica sempre exatamente abaixo de T |
| S-3 | **sem dimensões de moitão, polia ou gancho.** T e G são pontos, e T fica na reta P–θ. O afastamento do eixo da polia em relação ao eixo da lança é ignorado (PEND-006) | pequeno erro sistemático em R e em y_G |
| S-4 | c é a queda vertical de T até G, sem considerar o número de partes de cabo | c não serve para calcular cabo desenrolado |
| S-5 | guindaste **nivelado**: eixo de giro vertical, plano de apoio horizontal, sem inclinação do chassi nem recalque | desnível real não é representado |
| S-6 | P fica no plano vertical que contém o eixo de giro (sem afastamento lateral), e a e h não mudam com o giro | — |
| S-7 | lança reta, de um só segmento, **sem jib** nem extensão articulada (RN-002 cita jib como configuração) | jib fica para um ADR futuro |
| S-8 | lança telescópica tratada como um segmento de comprimento L; a divisão entre as seções não muda a geometria | pode mudar a tabela (C-6, G-4) |

### C-6 — Lança telescópica (P-002)

- **Na geometria**, L é contínuo em [L_min, L_max]. R, y_T e y_G são calculados para qualquer L
  dentro da faixa.
- **Na consulta à tabela**, até a PEND-001 ser respondida, só os comprimentos de lança que existem na
  tabela (`LoadChartPoint.boom_length`) ficam "no domínio". Para um L diferente de todos eles, o
  resultado é "fora do domínio da tabela" (RN-007, RF-020). Não se interpola entre colunas nem se
  arredonda para a coluna mais próxima. A geometria continua aparecendo; a capacidade, não.
- Para dizer se L é "igual" a um comprimento tabelado, usa-se uma tolerância só para absorver erro de
  ponto flutuante. O valor fica para a tarefa do `LoadChartInterpolator`. Isso não é política de
  arredondamento (PEND-002).
- Sugestão de UI, não obrigatória: o controle de extensão pode "encaixar" nos comprimentos tabelados,
  para o usuário conseguir chegar aos pontos do domínio.
- Interpolação no raio também é PEND-001 e fica fora deste ADR.
- Se existirem modos ou sequências de telescopagem que mudam a tabela, eles são atributo da
  configuração (PEND-005; **A VALIDAR**, G-4).

### C-7 — Fonte de verdade e pré-visualização (RN-008, P-004)

- **O backend é a fonte de verdade da geometria.** O `GeometryService` (em
  `backend/app/domain/services/`, planejado em [`architecture.md`](../architecture.md) § 2) calcula R
  e y_G com as entradas operacionais recebidas e os parâmetros cadastrados (C-4). A consulta à tabela
  e o `SafetyValidator` usam só esses valores.
- **O frontend envia só entradas operacionais** (L, θ, ψ, c e carga), como na mensagem da doc-fonte
  § 15.4. Ele nunca envia raio nem altura como entrada. Se enviar, o backend não usa.
- **O frontend pode calcular a mesma geometria** (fórmulas de C-5, com os mesmos parâmetros obtidos do
  backend por REST), mas só como **pré-visualização**: para mover o gancho na cena e mostrar um raio
  provisório enquanto a resposta não chega (RNF-003). Capacidade, utilização e status mostrados vêm
  sempre do backend (`simulation.evaluated`).
- Proposta para a tarefa de API: a resposta de avaliação traz `working_radius_m` e `hook_height_m`,
  como na saída conceitual da doc-fonte § 14.3 (o exemplo de WebSocket da § 15.4 traz só o raio).
  Assim a UI troca o valor provisório pelo oficial quando a resposta chega.
- O frontend **não** lê a posição dos nós do GLB para calcular raio ou altura.
  `getOperationalGeometry()` (doc-fonte § 17.3) devolve o resultado das fórmulas de C-5. As posições
  dos nós servem só para desenhar a cena e para o teste visual de calibração (C-4, regra 3).
- **Testes de paridade (futuro, fora desta tarefa):** um conjunto único de casos (entradas,
  parâmetros e saídas esperadas, rotulados FICTÍCIO) rodado no backend (pytest) e no frontend
  (Vitest), com tolerância explícita. Ele é criado quando as duas implementações existirem; o local do
  arquivo é decidido nessa tarefa.

## Verificação numérica do exemplo da doc-fonte (§§ 14.2 e 14.3)

Dados de entrada (§ 14.2): L = 18,2 m; θ = 42,0°; ψ = 120,0°; c = 8,4 m.
Saída esperada (§ 14.3): raio 13,5 m; altura do gancho 11,7 m.
O exemplo **não informa** a nem h.

Valores usados: cos 42° = 0,743145; sin 42° = 0,669131.

**Raio**, pela fórmula (1):

```text
L·cos θ = 18,2 × 0,743145 = 13,5252 m
R       = a + 13,5252
a = 0         →  R = 13,5252 m ≈ 13,5 m (1 casa decimal)       → FECHA
R = 13,50 m   →  a = 13,50 − 13,5252 = −0,025 m (dentro do arredondamento)
```

O raio fecha com a ≈ 0, ou seja, com o pino sobre o eixo de giro. Ele também fecharia com o raio
medido a partir do pino (alternativa A-1), porque com a = 0 as duas definições dão o mesmo número. O
exemplo não distingue uma da outra.

**Altura do gancho**, pelas fórmulas (2) e (3):

```text
L·sin θ = 18,2 × 0,669131 = 12,1782 m
y_G     = h + 12,1782 − 8,4 = h + 3,7782
h = 0         →  y_G = 3,78 m   (≠ 11,7 m)                      → NÃO FECHA
y_G = 11,7 m  →  h = 11,7 − 3,7782 = 7,92 m
c = 0, h = 0  →  altura da ponta = 12,18 m (nem sem cabo chega a 11,7 m)
```

Para a altura bater, o pino da lança teria de estar a 7,92 m do solo. O exemplo não informa esse
valor. Para o pino de um guindaste móvel, ele parece alto (hipótese: não há ficha técnica para
confirmar).

**Posição do gancho** no exemplo, com a = 0 e h desconhecido, pela fórmula (5):

```text
G = (13,5252·sin 120°, h + 3,7782, 13,5252·cos 120°) = (11,713; h + 3,778; −6,763) m
```

**Resultado registrado:** com as fórmulas propostas, o raio do exemplo é consistente (com a ≈ 0). Já a
altura do gancho só fecha com h ≈ 7,92 m, valor que não foi informado e é implausível sem ficha
técnica. Portanto o exemplo da doc-fonte é **ilustrativo e inconsistente com estas fórmulas quanto à
altura do gancho**, e **não deve ser usado como caso de teste**. Isso confirma o que já dizem
[`known-gaps.md`](../known-gaps.md) § 5 e [`architecture.md`](../architecture.md) § 9.

O número 11,7 coincide com outras contas: 18,2 × sin 40° = 11,70, e a coordenada horizontal X do
gancho (não a altura) dá 11,71. Não há evidência de que alguma delas seja a origem do número, e isso
não muda a conclusão.

Fora da geometria, só para completar: a utilização de 96,15 % bate com 5000 / 5200 × 100 = 96,1538.
A capacidade de 5200 kg continua ilustrativa.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **A-0: convenções C-1 a C-7 (proposta)** | mesmos eixos do glTF e do Three.js; parâmetros explícitos; o que depende da empresa fica isolado em dados e numa única função de raio | pode não bater com a definição da empresa (retrabalho) | — |
| A-1: raio medido a partir do pino da lança (R = L·cos θ) | não depende de a; menos parâmetros | se a ≠ 0, difere da definição que se supõe usual; a posição do gancho no mundo continua precisando de a | não adotada até a resposta da empresa (G-1). Se ela confirmar, muda só a função do raio |
| A-2: Z para cima (comum em CAD e em textos de engenharia) | igual aos arquivos CAD e aos textos técnicos | exige trocar eixos entre domínio e cena (glTF e Three.js usam Y para cima), o que costuma gerar erro de sinal | a conversão de Z para Y fica na preparação do GLB, fora do runtime (doc-fonte § 12) |
| A-3: origem no eixo de giro na altura da mesa de giro, e não no solo | não depende da montagem dos estabilizadores | o operador usa a altura do gancho em relação ao solo (saída da doc-fonte § 14.3); exigiria mais um parâmetro para converter | a altura em relação ao solo é a saída pedida |
| A-4: zero do giro em +X, anti-horário (convenção da trigonometria plana) | conhecida da trigonometria | com Y para cima e sistema destro, a direção vira (cos ψ, 0, −sin ψ), fácil de errar; não coincide com a frente do asset glTF (+Z) | — |
| A-5: ângulo da lança medido a partir da vertical | aparece em alguns contextos | a doc-fonte usa `boom_angle_deg` sem dizer a referência, e suponho que as tabelas usem a horizontal (hipótese, G-3) | — |
| A-6: geometria lida do GLB (posição dos nós) | não exige cadastrar ficha técnica | contraria RN-003 e P-003; o backend não roda Three.js; escala e pivôs do asset podem estar errados (doc-fonte § 25) | rejeitada |
| A-7: frontend calcula o raio e envia ao backend | um cálculo só | contraria RN-008 (o backend valida os dados operacionais) | rejeitada |
| A-8: modelo completo (deflexão, afastamento da polia, moitão) | mais perto do real | deformação está fora do escopo (doc-fonte § 2.2); exige dados que não temos | pode entrar depois, por novo ADR, se a empresa exigir |
| A-9: radianos em toda parte | nativo em `Math` e no Three.js | tabelas, doc-fonte (`*_deg`) e UI usam graus; a conversão ficaria espalhada | radianos só dentro do cálculo |
| A-10: não fazer nada (esperar a empresa) | nenhum retrabalho | bloqueia `GeometryService`, PoC e golden tests; as convenções acabam escolhidas sem registro no código | — |

## Consequências

**Positivas:**

- O `GeometryService` e a PoC Three.js podem começar com parâmetros FICTÍCIO, seguindo uma convenção
  escrita num lugar só.
- Frontend e backend partem da mesma especificação, que é a base dos testes de paridade (P-004).
- O que depende da empresa fica em dados (a, h e faixas) e numa única função (raio). Uma resposta
  diferente muda pouco código.

**Negativas / custos:**

- Retrabalho (novo ADR, código e testes) se a empresa responder diferente.
- Surge um dado novo para pedir à empresa e cadastrar: a ficha técnica geométrica (C-4).
- O mesmo cálculo existe em Python e em TypeScript, e isso precisa de testes de paridade.

**Riscos e como mitigar:**

- **R-1 — Raio sem deflexão menor que o real, o que é inseguro.** Hipótese a validar: nas tabelas, o
  raio costuma ser o raio real com a carga suspensa, já com a deflexão da lança. Se for assim, o R
  geométrico (S-1) fica menor que o real, e como em geral a capacidade cai quando o raio aumenta, **a capacidade
  consultada fica maior que a correta**. → Perguntar à empresa (G-1). Deixar claro na UI e no
  relatório que o raio é geométrico, sem deflexão. Não aplicar margem ou correção sem regra da
  empresa (doc-fonte § 2.3).
- **R-2 — Pino e altura mudam com a configuração** (por exemplo, estabilizadores). → Parâmetros por
  configuração, se a empresa confirmar (G-2).
- **R-3 — L e θ do fabricante medidos de outro jeito** (por exemplo, no eixo estrutural e não na reta
  do pino até a polia). → Erro sistemático pequeno. Perguntar (G-3); os golden tests com a tabela
  oficial vão mostrar a diferença.
- **R-4 — Exemplo da doc-fonte usado como caso de teste.** → Não usar: a verificação acima mostra que
  a altura não fecha.
- **R-5 — Frontend e backend divergindo.** → C-7 (o valor oficial vem do backend) e testes de paridade.
- **R-6 — Eixo ou sinal trocado na preparação do GLB** (CAD com Z para cima). → Checklist de
  preparação e teste visual de calibração (doc-fonte § 12.1; C-4, regra 3).
- **R-7 — Proposta tratada como decisão.** → Status `Proposto`, itens marcados **A VALIDAR**, e
  P-001 a P-004 continuam abertos em `known-gaps.md`.

## Perguntas novas para a Guindastes Ribas

Elas complementam a doc-fonte § 26 e as PEND-001..008. Quando forem respondidas, a pessoa
responsável transforma a resposta em RN, em novo ADR ou nos dois.

| # | Pergunta | Relaciona-se com |
|---|----------|------------------|
| G-1 | Nas tabelas do modelo da demonstração, o raio de trabalho é medido do eixo de giro até a vertical do gancho? É o raio com a carga suspensa (com deflexão da lança) ou o raio geométrico? | P-001; C-3; R-1; § 26 q. 7–8 |
| G-2 | Qual a posição do pino do pé da lança em relação ao eixo de giro (distância horizontal, e se fica à frente ou atrás) e qual a altura dele em relação ao solo? Ela muda com a montagem dos estabilizadores ou com outra configuração? Em que documento isso aparece? | P-001; P-003; C-4; § 26 q. 2 e 6 |
| G-3 | Como o fabricante define o comprimento da lança (do pino até o eixo da polia da ponta?) e o ângulo da lança (em relação à horizontal? medido em qual linha?) | P-001; P-002; C-2; C-3 |
| G-4 | Na lança telescópica, a tabela vale só nos comprimentos tabelados, ou pode interpolar entre colunas de comprimento? Há modos ou sequências de telescopagem que mudam a tabela? | P-002; C-6; PEND-001; PEND-005 |
| G-5 | Que referência de 0° e que sentido de giro os operadores e as tabelas usam (frente do chassi? traseira?), e como isso se relaciona com os setores de trabalho? | C-1; C-2; PEND-007 |
| G-6 | A altura do gancho é medida de onde até onde (do solo até a boca do gancho?)? As dimensões do moitão e do gancho precisam entrar? Para o operador, o "comprimento de cabo" é a queda abaixo da ponta ou o cabo desenrolado? | C-3; S-3; S-4; PEND-006 |
| G-7 | Que diferença entre o raio ou a altura calculados e os medidos em campo é aceitável para a ferramenta ser útil? | P-007 (tolerância dos golden tests) |
| G-8 | Quais os ângulos mínimo e máximo da lança (inclusive abaixo da horizontal), os limites de giro e se o gancho pode descer abaixo do plano de apoio? | C-2; C-4; C-5 |

## Impacto na documentação

- [x] `docs/architecture.md` § 8 lista este ADR como `Aceito`
- [ ] `docs/development-guide.md`: não se aplica (não muda comando nem convenção de código)
- [x] `docs/known-gaps.md`: P-001 a P-004 apontam para esta proposta, sem apagar o texto (continuam abertos)
- [x] índice em `docs/decisions/README.md` atualizado
- [ ] `docs/business-rules.md`: **não alterado** (regras de negócio vêm da pessoa responsável)
- [ ] `docs/project-overview.md` § 9 (glossário de "Raio de trabalho" e "Comprimento de lança") e
  `docs/architecture.md` § 9: continuam **PENDENTE**. Atualizar só depois do aceite e da validação
  com a empresa.

## Evidências

- **Verificado nesta sessão:**
  - doc-fonte §§ 10, 12, 14, 15, 17.3 e 26: nenhuma define coordenadas, referência do raio, altura do
    gancho ou parâmetros do pino (leitura do arquivo congelado);
  - especificação glTF 2.0, § 3.4 (<https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html>): sistema
    destro, +Y para cima, +Z para frente, −X à direita, e a frente do asset voltada para +Z. As unidades
    (metro, radiano) **não** foram confirmadas no trecho obtido;
  - documentação do Three.js, `Object3D` (<https://threejs.org/docs/pages/Object3D.html>):
    `DEFAULT_UP` é `(0, 1, 0)` e `rotation` usa radianos;
  - as contas da verificação numérica, refeitas com `awk` (cos 42° = 0,743145; sin 42° = 0,669131;
    L·cos θ = 13,5252; L·sin θ = 12,1782; h necessário = 7,9218; 5000/5200 × 100 = 96,1538).
- **Não verificado nesta sessão:** que o Three.js usa sistema destro (tratado como fato conhecido, e
  coerente com o glTF).
- **Hipóteses (não verificadas):** que o raio das tabelas se mede do eixo de giro e é o raio com
  carga (G-1, R-1); que as tabelas medem o ângulo a partir da horizontal (G-3); que 7,92 m é alto para
  o pino de um guindaste móvel. Nenhum valor de guindaste real foi usado.
