# ADR-018 — Tabelas por zona de giro e peso do gancho na comparação

| Campo | Valor |
|-------|-------|
| **Status** | Proposto |
| **Data** | 2026-09-27 |
| **Autor** | agente Claude Code 2.1.280 (modelo Opus 5.5), registrando as escolhas da pessoa responsável |
| **Decisores** | Anderson Sehnem (em chat, 2026-09-27: "Zona pelo giro da torre", "Carga + gancho ≤ capacidade", "TM 130 para depois", dados oficiais "fora do git, só importar") |
| **Tarefa relacionada** | TASK-046 |
| **Substitui** | — (complementa ADR-009, ADR-013 e ADR-015) |

## Contexto

A Guindastes Ribas enviou as primeiras tabelas oficiais (PDFs de fabricante). A do **MD 300L** (Madal
Palfinger) traz, para sapatas com extensão máxima, **duas matrizes lança × raio**:

- **área frontal**: setor de 110° sobre a frente do chassi;
- **áreas lateral e traseira**: os 250° restantes.

As duas trazem a nota "incluindo peso do gancho principal (235 kg)". A capacidade tabelada já conta
com o gancho, então o que se pendura nele é a capacidade menos o peso do gancho.

Até aqui, o sistema tinha **uma** tabela ativa por configuração e comparava **só o peso da carga**
(`weight_compared_with_capacity`, TASK-028; PEND-006).

A tabela do TM 130 (Luna) usa outro formato: capacidade só por raio e zona, sem comprimento de lança.
Fica para depois (lacuna registrada).

## Decisão

### 1. Zonas de giro por configuração

- A configuração pode declarar **zonas de giro**: `rotation_zones: [{code, name, start_deg, end_deg}]`.
  - Os ângulos seguem a convenção de ψ do ADR-013: 0° = lança sobre a frente, 90° = lado esquerdo,
    no sentido anti-horário visto de cima, em [0°, 360°).
  - Um setor vai de `start_deg` a `end_deg` no sentido crescente e pode passar por 0°. Exemplo:
    frontal de 305° a 55°.
  - As zonas precisam **cobrir 360° sem sobreposição**. As fronteiras são compartilhadas.
  - `code` é único na configuração: 1 a 32 caracteres `[A-Z0-9_]`.
  - Configuração **sem zonas** continua como hoje: uma tabela vale para todo o giro.
- Cada tabela de carga importada numa configuração com zonas indica a sua **zona**
  (`rotation_zone_code`). Numa configuração sem zonas, o campo é `null`.
- A ativação passa a ser **uma tabela ativa por (configuração, zona)**. A ativação de outra tabela da
  mesma zona continua substituindo a anterior (TASK-031).
- Na avaliação, **ψ escolhe a zona**:
  - dentro de um setor, usa a tabela ativa daquela zona;
  - sobre uma fronteira (±ε do ADR-015), consulta as duas zonas vizinhas e usa a **menor capacidade**,
    do lado seguro;
  - se a zona não tiver tabela ativa, a resposta é "não avaliável", com o motivo
    `ACTIVE_LOAD_CHART_NOT_FOUND` e a zona informada;
  - o resultado informa a zona usada.

### 2. Peso do gancho na comparação

- A configuração pode declarar `hook_block_weight_kg` (≥ 0; padrão `null` = 0): o peso do gancho que a
  tabela considera.
- O peso comparado com a capacidade passa a ser **carga + gancho**. É o ponto único
  `weight_compared_with_capacity` (TASK-028). O resultado mostra as três parcelas: carga, gancho e
  peso comparado.
- Lingas e acessórios de içamento entram como parcela futura, no mesmo ponto único.

### 3. Dados oficiais fora do repositório

As tabelas reais e os PDFs de origem ficam em `dados-oficiais/`, uma pasta **ignorada pelo git**, na
máquina da pessoa responsável, e são importados pela página Tabelas. O repositório e os testes
continuam com dados FICTÍCIOS (ADR-012). Os agentes **não leem** essa pasta, salvo pedido explícito da
pessoa responsável.

### 4. Regras de negócio

Esta decisão cria duas regras que a **pessoa responsável** precisa registrar em
`docs/business-rules.md` (agentes não editam esse arquivo):

- **RN-009:** a capacidade depende da zona de giro quando a tabela oficial separa zonas; a zona é
  escolhida pelo giro, e na fronteira vale a menor capacidade;
- **RN-010:** quando a tabela inclui o gancho, o peso comparado é carga + gancho.

## Alternativas consideradas

| Alternativa | Vantagens | Desvantagens | Por que não |
|-------------|-----------|--------------|-------------|
| **Zonas na configuração, tabela por zona (escolhida)** | reflete a tabela real; o giro muda a capacidade como na operação | migration, mudança no domínio e na tela | — |
| Uma configuração por zona | nenhuma mudança de código | o operador escolhe a zona à mão; o giro não muda a capacidade | recusada pela pessoa responsável |
| Comparar só a carga | como hoje | subestima o peso quando a tabela inclui o gancho | recusada (lado inseguro) |

## Consequências

**Positivas:**
- a tabela oficial do MD 300L entra sem perder informação;
- a comparação fica do lado seguro.

**Negativas / custos:**
- migration nova: zona na tabela de carga, índice de "uma ativa" por (configuração, zona), zonas e
  peso do gancho na configuração;
- mudanças no contrato de configuração, importação, listagem e avaliação;
- a tela precisa editar zonas e escolher a zona na importação.

**Riscos:**
- zonas mal cadastradas (setor trocado) dão capacidade errada. A tela deve mostrar os setores no
  chão da cena para conferência visual.
- a ficha técnica do MD 300L (a, h) não está nos PDFs. Sem ela, a configuração oficial fica sem ficha
  até a Guindastes Ribas informar (pendência).
