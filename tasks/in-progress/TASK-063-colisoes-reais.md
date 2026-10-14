# TASK-063 — Colisões: carga não entra no chão nem no caminhão

- **Regra:** RN-012 (colisão da carga bloqueia o comando; a capacidade segue do backend, RN-008).
- **Origem:** relato de uso: ainda dava para levar a carga para baixo da terra e para dentro do caminhão.
- **Escopo:** só frontend (`domain/collision`, `three/crane/SwitchableCrane.ts`, e2e).

## Causa

1. A guarda de `SwitchableCrane` só cortava o comando se o estado ANTERIOR estivesse livre. A pose
   inicial já raspa a cabine do chassi, então estava "já colidindo" e a guarda liberava todo comando.
2. O gancho sem carga não era testado contra o corpo do guindaste.

## Critérios de aceite

- CA-1 — Nenhum comando (giro, inclinação, comprimento da lança, cabo) leva a carga ou o gancho para
  baixo do terreno; o movimento para no último estado aceitável (busca binária).
- CA-2 — Idem para as caixas do chassi, da torre e da lança (carga) e do chassi e da torre (gancho).
- CA-3 — Se o estado de partida já colide, só passam comandos que não aumentam a penetração
  (ex.: subir o cabo).
- CA-4 — Nenhum teste existente quebra.

## Testes a escrever depois

- Penetração contra obstáculos (cilindro/caixa) com a pose de partida colidindo.
- Terreno com relevo (TASK-052) e `headingDeg` diferente de 0 no e2e.
- Remedição do corpo quando o GLB chega depois (hipótese e: `useModel` já chama `setRig`).
- Cadeia de acessórios (TASK-056): confirmar `accessoriesDropM` na caixa com carga real no e2e.
