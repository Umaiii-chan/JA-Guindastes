# ADR-050 — estabilidade por física: momentos no polígono das patolas, vento EN 13000 e inclinação como momento

| Campo                  | Valor                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Status**             | Aceito                                                                         |
| **Data**               | 2026-10-17                                                                     |
| **Autor**              | agente Claude Code, implementador da TASK-106                                  |
| **Decisores**          | Anderson Sehnem (decisão D1 da auditoria da física, em chat, 2026-10-16)       |
| **Tarefa relacionada** | TASK-106                                                                       |
| **Substitui**          | RN-013 (tombamento por regras) e RN-015 (fatores de inclinação, vento e solo)  |
| **Complementa**        | ADR-012 (valores fictícios), ADR-013 (geometria), ADR-018, ADR-022, ADR-033    |

## Contexto

A auditoria da física de 2026-10-16 apontou que o simulador decidia o tombamento por regras e
percentuais fixos, sem estática:

- o risco de tombamento era só "utilização acima do limite, patolas não estendidas, inclinação acima do
  máximo ou fora da tabela" (RN-013): nenhuma conta de momentos;
- a pressão nas sapatas usava `(massa + peso) × 0,5 ÷ área` em todas as sapatas, um 0,5 fictício que
  não depende do raio nem do giro (RN-015); com a lança sobre a diagonal e a 85 % do tombamento a
  fração real da sapata mais carregada é de cerca de 0,59, e no caso comum, 0,36;
- o vento era uma rampa de 9,8 a 13,8 m/s que cortava a capacidade a 50 % (RN-015), sem relação com a
  área exposta da carga, que é o que a EN 13000 usa;
- a inclinação residual reduzia a capacidade em 10 % por grau, sem efeito sobre o centro de gravidade
  nem sobre a flecha da lança.

O Anderson decidiu (D1): trocar as duas regras por **física, o mais próximo do real possível**.

## Decisão

1. **Tombamento por momentos** (`backend/app/domain/services/stability.py`). Para cada lado do
   polígono das quatro sapatas, `ρ = O / S`: o momento de tombamento sobre o momento estabilizante
   do lado. Estabilizam o chassi com as patolas, a torre com o contrapeso (gira com ψ) e a lança (CG
   no meio entre o pino e a ponta, da geometria do ADR-013). Tomba a carga comparada fatorada
   (`Q / 0,85`) no gancho, deslocada para fora pela flecha da lança, mais o vento e a inclinação.
   Risco **alto** com `ρ ≥ 1` (`TIPPING_MARGIN_EXCEEDED`) ou sapatas sem apoio
   (`OUTRIGGERS_LIFT_OFF`); **atenção** de `ρ` ≥ 90 % (`STABILITY_NEAR_LIMIT`).
2. **Margem de norma.** Carga comparada ≤ 85 % da carga de tombamento sobre patolas: com a carga
   sozinha, `ρ = 1` é exatamente esse limite. É o critério das tabelas dos fabricantes (ASME B30.5);
   a ISO 4305 e a EN 13000 partem da carga de teste, com fator próprio. O fator fica em
   `StabilityParams.tipping_load_limit_ratio` (FICTÍCIO).
3. **Reação por sapata** pela estática do polígono (plataforma rígida de quatro apoios, com a solução
   de três apoios quando uma sapata descarrega). Substitui o 0,5; a pressão de cada sapata
   (`reação × g ÷ área`) é comparada com o solo sob ela.
4. **Vento da EN 13000.** A velocidade de entrada é a rajada de 3 s no ponto mais alto, sem conversão de
   altura. A velocidade máxima é a da tabela (`wind_table_speed_ms`) até `A_W / m_H = 1,2 m²/t`;
   acima disso `v_max = v_tab · √(1,2 ÷ (A_W / m_H))`, com `A_W` a área de vento da carga e `m_H` o
   peso comparado em toneladas. Acima de `v_max`: bloqueio (`WIND_ABOVE_LIMIT`); de 90 %: atenção
   (`WIND_NEAR_LIMIT`). O vento também gera momento (`F = ½ ρ_ar v² A`, carga e lança). O frontend
   envia `load_wind_area_m2` (maior face × 1,2) só com a carga pendurada.
5. **Inclinação residual como momento.** Cada massa na altura `h` se desloca `h · sen α` para fora da
   linha de tombamento. Sem direção da inclinação no contrato, vale o pior sentido para todos os
   lados. A inclinação máxima do modelo continua como limite duro (a tabela não vale acima dela).
6. **Mantidos:** utilização acima do limite (RN-011), patolas não totalmente estendidas e apoiadas com
   carga suspensa, operação fora da tabela e obstáculos no raio de giro. Os campos `slope_factor` e
   `wind_factor` do contrato ficam, sempre `1`; `slope_derating_percent_per_deg` do `SafetyProfile` fica
   como campo obsoleto (sem migração).
7. **Resultado exposto:** `stability` na avaliação REST e WebSocket (`tipping_ratio_percent`,
   `critical_edge`, `pad_reactions_kg`, `worst_pad_share`, `deflection_m`, `pad_half_span_m`,
   `wind_limit_ms`, `wind_force_n`, `tipped`), mostrado no painel como "Estabilidade". O frontend não
   calcula nada (RN-008).
8. **Parâmetros FICTÍCIOS.** Polígono, massas, alturas dos CG, flecha, fator 0,85, velocidade da tabela
   e área de vento da lança ficam em `StabilityParams`, com os padrões no `SafetyProfile`, sem coluna
   nova. A ficha por modelo é a pendência D5 da auditoria.

## Normas citadas

Os critérios vêm de ISO 4305 (estabilidade de guindastes móveis), EN 13000 (guindastes móveis:
estabilidade, carga de teste, vento) e ASME B30.5. **Não foram conferidos nas normas** o número de cada
cláusula, os fatores de carga de teste e a numeração brasileira equivalente da ISO 4305: nenhum desses
valores deve ser tratado como oficial. Os números do repositório são FICTÍCIOS (ADR-012).

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Manter as regras e só trocar os números | o 0,5 e a rampa de vento não dependem da geometria nem da área exposta; a decisão D1 pede física |
| Estabilidade só pela tabela de carga (a tabela já embute a margem) | a tabela não cobre inclinação, vento, solo nem a reação por sapata |
| Direção do vento e da inclinação como entradas | o contrato e a tela não têm; o pior sentido é conservador e fica registrado como limitação |
| Dinâmica (balanço da carga, frenagem, rajada variável) | fora do escopo: a avaliação é estática (ADR-013) |
| Gravar `StabilityParams` por modelo agora | exige migração e dados oficiais que não temos (D5) |

## Consequências

- O tombamento passa a depender do raio, do giro, da extensão das vigas, da carga, do vento e da
  inclinação; testes com contas feitas à mão em `backend/tests/domain/test_stability.py`.
- A capacidade efetiva deixa de cair com a inclinação e o vento; o risco e o bloqueio vêm da estática e
  do limite de rajada. O planejador não filtra mais sítios por solo: cada estado avaliado confere a
  pressão da sapata (`SOIL_BEARING_EXCEEDED`).
- Limitações: pior sentido para vento e inclinação; sapatas retangulares simétricas; flecha e massas
  fictícias; sem dinâmica; sem dado oficial por modelo (D5); cláusulas das normas a conferir.
