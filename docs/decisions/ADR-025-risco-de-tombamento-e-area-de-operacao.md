# ADR-025 — risco de tombamento por regras e área de operação

| Campo                  | Valor                                                       |
| ---------------------- | ----------------------------------------------------------- |
| **Status**             | Aceito                                                      |
| **Data**               | 2026-10-14                                                  |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14 (plano da leva E)    |
| **Tarefa relacionada** | TASK-055                                                    |

## Contexto

A leva E pede risco de tombamento (RN-013) e uma área de operação verde, amarela e vermelha
(RN-011). Não há dado oficial de estabilidade: valores FICTÍCIOS (ADR-012).

## Decisão

1. **Risco por regras, sem física.** Serviço puro `assess_safety` (domínio): HIGH com utilização
   acima do limite, patolas não estendidas e apoiadas com carga, inclinação acima do máximo do
   modelo ou fora da tabela com carga; ATTENTION na faixa de atenção; senão LOW. Entrada ausente
   gera alerta INFO "não informado" e não entra no risco. Mensagens em pt-BR.
2. **Porta `SafetyProfileProvider`** para limite, faixa e inclinação máxima. Sem provedor valem os
   padrões fictícios (100 %, 90 %, 1,0°); a TASK-051 liga a porta ao catálogo.
3. **Área de operação** no backend: `POST /api/v1/configurations/{id}/operating-area` devolve uma
   grade polar (ψ × R) com `GREEN`, `YELLOW` ou `RED`, usando a consulta conservadora (ADR-029), as
   zonas, o gancho e o limite. Vermelho = acima do limite ou fora da tabela. Autorização igual à da
   avaliação. A grade vai de `radius_step` a `a + L`; teto de 50 000 células.
4. O frontend só desenha (`OperatingAreaOverlay`); o nível vem do backend (RN-008).

## Consequências

Os campos `tipping_risk` e `alerts` entram em toda resposta de avaliação (sempre há os INFO quando
patolas e inclinação não vêm). Giro fora dos limites da ficha não é tratado à parte na grade.
