# ADR-033 — fatores do ambiente na utilização e no risco de tombamento

| Campo                  | Valor                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Status**             | Aceito                                                        |
| **Data**               | 2026-10-14                                                    |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                        |
| **Tarefa relacionada** | TASK-067                                                      |
| **Regra**              | RN-015                                                        |

## Contexto

A pessoa pediu que todas as configurações de ambiente influenciem a utilização e o risco de
tombamento. Até aqui só a inclinação do terreno entrava (risco), e nada reduzia a capacidade.

## Decisão

- A capacidade efetiva (RN-011) vira tabela × limite × fator de inclinação × fator de vento, em
  `backend/app/domain/services/environment_factors.py` (serviço puro). `capacity_limit` devolve
  `slope_factor` e `wind_factor`.
- Inclinação: fator `1 − (% por grau × graus)/100`, com piso de 0,05. Acima da máxima do modelo, o
  nível é `OVER` e o risco, alto.
- Vento: 1 até 9,8 m/s, queda linear até 0,5 em 13,8 m/s; acima disso, `OVER` e risco alto.
- Solo: pressão na pior sapata = (massa do guindaste + peso comparado) x 9,80665 x 0,5 / área; contra
  rocha 1000, compactado 300, argila 150 e aterro solto 75 kPa (constantes nomeadas).
- Obstáculos: lista de ids vinda do cliente; não vazia dá atenção.
- O guindaste ganha `slope_derating_percent_per_deg` (10), `crane_mass_kg` (36000) e
  `outrigger_pad_area_m2` (0,5), em migration nova.
- A área de operação aplica os mesmos fatores de inclinação e vento.
- Os campos novos da requisição (`soil_kinds`, `wind_speed_ms`, `obstacle_conflicts`) são opcionais.

## Consequências

- Todos os valores numéricos são FICTÍCIOS até haver dado oficial (ADR-012).
- A lista de obstáculos no raio de giro é calculada pelo cliente (a cena 3D); o backend só a recebe.
- Não há cálculo físico de estabilidade: continuam regras simples.
