# ADR-032 — editor 3D livre do ambiente

| Campo                  | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Status**             | Aceito                                                       |
| **Data**               | 2026-10-14                                                   |
| **Autor**              | agente Claude Code, registrando pedido da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                       |
| **Tarefa relacionada** | TASK-066 (o backend da avaliação é a TASK-067)               |
| **Complementa**        | ADR-023 (cenários) e ADR-028 (colisões)                      |

## Contexto

O ambiente era montado por campos numéricos (tamanhos e posições). Com uma elevação no terreno, o
guindaste não acompanhava. Os três painéis da coluna (simulação guiada, acessórios, ambiente) não
recolhiam, e com a simulação guiada aberta ficava ruim usar os outros.

## Decisão

1. **Editor na própria cena 3D** (botão "Editar ambiente"): selecionar e mover obstáculos e o
   guindaste (`TransformControls`: mover no plano XZ, girar em Y, redimensionar), adicionar caixa ou
   cilindro clicando no chão, esculpir (elevar, rebaixar), aplainar e pintar solo com um pincel, e
   ajustar o vento. O clique vira (x, z) por raycast no terreno. A câmera só orbita fora do arrasto
   (botão direito ou Alt + arrastar gira durante o pincel). Desfazer com Ctrl+Z (50 gestos).
2. **Terreno sem formato novo**: cada pincelada soma em feições `mound`/`pit` do `TerrainSpec`
   (pinceladas próximas somam na mesma feição). Contrato aditivo: tipo `flatten` (leva o terreno
   já somado ao nível absoluto `heightM`, por inteiro até 60 % do raio e em cossenoide até o raio),
   aplicado na ordem da lista em `terrainHeightAt`. Só `flatten` aceita `heightM` negativo.
3. **Contrato aditivo do cenário**: `soilZones?` (`rock | compacted | clay | loose_fill`, círculos;
   a zona mais recente vence), `wind?` (`speedMs`, `directionDeg` para onde sopra, de +X, anti-horário
   visto de cima) e `soilAt(spec, x, z)` (padrão `compacted`). O backend dos cenários valida os campos
   (`soil_zones`, `wind`, kind `flatten`); cenários antigos continuam iguais.
4. **O guindaste acompanha o terreno**: assenta na altura sob o eixo de giro e inclina pelo plano
   das quatro sapatas (fictícias, 6 m × 5 m, ADR-012). Com as patolas apoiadas, os macacos compensam
   até `levelingDeg`; o resto aparece no modelo. Carga, gancho e anéis seguem a âncora.
5. **Avaliação**: além de `groundSlopeDeg`, o estado enviado ganha `soilKinds` (fl, fr, rl, rr),
   `windSpeedMs` e `obstacleConflicts`, em JSON `soil_kinds`, `wind_speed_ms`, `obstacle_conflicts`.
   Só vão quando existem (solo pintado, vento > 0, conflito). `obstacleConflicts` reúne os obstáculos
   cujo contorno entra no disco de raio igual ao raio de trabalho (lido de forma conservadora) e os
   apontados pela colisão da TASK-053.
6. **Painéis recolhíveis**: as três seções ficam recolhíveis de forma independente, com estado em
   `localStorage` (protegido por try/catch) e rolagem própria.

## Consequências

- O backend da avaliação recusa campo desconhecido (`extra="forbid"`): enquanto a TASK-067 não for
  integrada, solo pintado, vento e conflitos fazem a avaliação responder 422. Sem usar essas
  ferramentas, nada muda.
- As colisões (TASK-053) ainda tratam o guindaste na vertical, na altura do centro; a inclinação
  é só visual.
- Pinceladas em arrasto geram várias feições; o limite de 50 do backend vale (as pinceladas
  seguintes no mesmo ponto somam em vez de criar).
- Os macacos tiram a inclinação de forma imediata (sem animar).
