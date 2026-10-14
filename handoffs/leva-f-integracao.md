# Handoff — integração da leva F (TASK-072..078)

| Campo | Valor |
|-------|-------|
| **Data** | 2026-10-14 |
| **Agente** | Claude Code (Opus 5.5), papel: integrador (merge, correções de integração, validação) |
| **Branch** | `leva-f/integracao-2` (substitui os PRs #25 a #29) |

## O que entrou

- `leva-f/integracao` (development + TASK-073, 072 e 076), TASK-074 (tandem), `leva-f/integracao-075`
  (TASK-075 já ligada ao "Explicar" da TASK-076), `leva-f/modelos-galpao-cargas`, TASK-077, TASK-078
  e o resgate de `a4fea2c` (varredura de colisão + HUD de altura fixa, TASK-063).

## Decisões de integração

- Carga e entrega canônicas são as da TASK-073 (`CargoPlacement`/`DeliveryPoint`,
  `CargoPlacementSpec`/`DeliveryPointSpec`); o `CargoPayload` da 074 e o `CargoSpec`/`DeliverySpec` da
  075 saíram.
- Com o tandem ligado, a carga de um guindaste só (TASK-073) fica suspensa e a do tandem aparece
  (`CargoOperation.setSuspended`).
- O tandem do planejamento usa o serviço `tandem_load_split` da TASK-074 (adaptador em
  `planning/tandem.py`).
- "Aplicar" de uma recomendação de tandem também põe o Guindaste 2 (configuração e posição).
- "Executar trajetória" engata no quadro "Engatar" e solta no "Soltar"; se falhar, para e mostra o
  motivo. No quadro "Engatar" o gancho desce até o topo da carga (antes ficava 1,5 m acima).
- `obstacle_conflicts` vai com os rótulos; o relatório de içamento usa o peso do passo Carga mesmo
  antes de engatar; a IA prefere objetos da biblioteca (`kind: model`), sem `enum` + `nullable` no
  esquema (o Gemini recusa com HTTP 400).
- e2e `cargoDelivery`: carga e entrega mais perto do guindaste na vista de cima (a barra do editor
  cresceu com o tandem).

## Pendências

- e2e completo não rodado depois da TASK-077/078 (rodou verde, 17 passed, antes delas).
- Na tela, com o backend real: coleta/entrega, objetos da biblioteca, "Planejar operação",
  "Aplicar" e o início da trajetória foram vistos; o "Entregue" ao fim da trajetória não foi
  confirmado (a página parou de desenhar com a janela em segundo plano).
- IA ponta a ponta não confirmada depois da correção do 400: os dois modelos estavam em 429 (cota).
- Tandem na trajetória: só engata se o içamento com dois guindastes estiver ativo antes; a carga do
  tandem ainda é uma caixa (sem os modelos de carga novos).
- Configurações "FICTÍCIO E2E" no banco local aparecem nas recomendações.
- Com "Planejar operação" aberto, a simulação guiada fica espremida na coluna.

## Testes a escrever depois

- Planejador: no quadro "Engatar", o fim do gancho fica entre 0 e 0,5 m acima do topo da carga.
- Tela: "Executar trajetória" chega a "Entregue" (e2e com backend falso).
- Tandem pela trajetória (engatar e soltar com dois guindastes).
- IA: `scenario-from-text` real com objetos da biblioteca.
