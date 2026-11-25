# ADR-053 — repetir a simulação: a carga volta à coleta e o planejamento volta ao início

| Campo                  | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| **Status**             | Proposto                                                   |
| **Data**               | 2026-11-25                                                 |
| **Autor**              | agente Claude Code, implementador da TASK-119              |
| **Decisores**          | Anderson Sehnem (pendente de confirmação)                  |
| **Tarefa relacionada** | TASK-119                                                   |
| **Complementa**        | ADR-035 (coleta e entrega), ADR-037 (tandem), ADR-038 (planejamento da operação) |

## Contexto

Depois de uma entrega (trajetória executada, ou passo a passo concluído), a carga fica no ponto de
entrega e o painel de planejamento mostra a execução como concluída. Para simular de novo a pessoa
precisava recarregar a página e refazer o cenário. O ADR-038 (Aceito) não prevê voltar ao início.

## Decisão

1. **Atalho "Repetir simulação"** no painel "Planejar operação" (botão, e a tecla **R** fora de campos
   de texto, listas e controles deslizantes e sem janela modal aberta; mesma regra das teclas 1 a 4 da
   câmera). Disponível com uma opção de plano escolhida, fora da reprodução de gravação.
2. **A carga volta à coleta.** Guindaste só: a cena zera o estado da carga (no chão ou na carroceria de
   origem, resultado e tempo da operação zerados; `CargoOperation.reset`). Tandem: soltar grava a
   posição de entrega como posição da carga no cenário; a tela guarda a posição de coleta ao engatar e a
   devolve ao repetir, **somente se** a carga ainda estiver onde foi solta (uma edição manual depois da
   entrega não é desfeita).
3. **O guindaste volta ao estado inicial da trajetória** (o primeiro quadro, o mesmo de "Aplicar"), só
   se a recomendação está aplicada; a posição do guindaste e as patolas não mudam. O progresso e a fase
   da execução zeram, o aviso de engate/soltura some e o **passo a passo volta ao primeiro passo** (se
   estava ativo, continua ativo).
4. Nada disso toca capacidade, risco ou avaliação (RN-008): só estado de cena.

## Consequências

- Não há regra de negócio nova (nenhuma RN afetada); é só repetição do mesmo cenário.
- Parar uma trajetória no meio e usar "Repetir simulação" também funciona (volta ao início).
- Limite: a volta do guindaste passa pela guarda de colisão como qualquer movimento; se um obstáculo
  bloquear o caminho de volta ao primeiro quadro, o guindaste fica onde parou e "Aplicar" resolve.
