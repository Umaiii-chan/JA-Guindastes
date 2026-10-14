# ADR-035 — carga posicionável, ponto de entrega, engatar e soltar

| Campo                  | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Status**             | Aceito                                                       |
| **Data**               | 2026-10-14                                                   |
| **Autor**              | agente Claude Code, registrando pedido da pessoa responsável |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                       |
| **Tarefa relacionada** | TASK-073                                                     |
| **Complementa**        | ADR-023 (cenários), ADR-027 (gravação), ADR-028 (colisões), ADR-032 (editor 3D) |

## Contexto

A carga só existia pendurada no gancho, com as medidas e o peso do passo "Carga". A pessoa pediu que a
posição inicial da carga seja escolhida na cena, como se faz com os obstáculos, e que a simulação
passe a ser: ir até a carga, coletar e levar até um ponto de entrega.

## Decisão

1. **Contrato aditivo do cenário, sempre opcional**:
   - `cargo?: { x, z, rotationYDeg }`: onde a carga começa, no chão. Usa as medidas e o peso do passo
     Carga;
   - `delivery?: { x, z, rotationYDeg, radiusM }`: o ponto de entrega. O raio de tolerância vai de
     0,5 a 30 m (padrão 2 m).
     Em JSON (`snake_case`): `cargo` e `delivery`, com `rotation_y_deg` e `radius_m`. Só entram quando
     existem; cenários antigos continuam iguais. O backend dos cenários aceita e valida os dois
     campos.
2. **Sem `cargo`, nada muda**: a carga das medidas continua pendurada no gancho (modo livre). Com
   `cargo` e medidas válidas, ela nasce no chão, apoiada no ponto mais alto do terreno sob a base
   (não entra no chão em terreno irregular).
3. **Editor 3D**: ferramentas "Posicionar carga" e "Ponto de entrega" (clicar no chão para colocar) e,
   em "Selecionar", mover e girar a carga e o alvo como os obstáculos; no alvo, "Redimensionar" muda
   o raio. Excluir e desfazer valem como nos obstáculos. A carga aparece com a forma da caixa; sem
   medidas, um marcador provisório translúcido. O alvo é um anel no chão, com disco leve e cruz,
   acompanhando o relevo.
4. **Engatar** (botão): habilitado quando o fim do gancho (ou da cadeia de acessórios) está até
   0,5 m acima do topo da carga (tolerância de 0,1 m abaixo, que é o ruído da caixa do gancho) e a
   até 0,5 m do centro dela na horizontal. A carga fica onde está e passa a seguir o gancho: guarda-se
   o deslocamento e o giro em relação a ele e a altura das lingas, que é a distância que havia entre o
   gancho e o topo no momento (mínimo 5 cm). Assim ela não pula nem entra no chão ao ser levantada.
5. **Soltar** (botão): habilitado quando a base da carga está a até 0,2 m do chão. A carga fica onde
   está, sem deslizar. Dentro do raio do alvo (distância do centro da carga ao centro do alvo), marca
   "Entregue" com o tempo da operação, contado do primeiro engate até a soltura no alvo; fora dele, a
   carga fica onde caiu, com o aviso "fora do ponto de entrega", e pode ser engatada de novo. Sem ponto
   de entrega, só apoia a carga.
6. **Avaliação**: enquanto a carga está no chão (antes de engatar e depois de soltar), a avaliação
   recebe `load_weight_kg = 0`: só o gancho e os acessórios pesam. Engatada, o peso do passo Carga
   entra. Sem carga posicionada, o peso entra sempre, como antes.
7. **Colisões**: com a carga no chão, ela é um obstáculo (caixa) para o gancho, o guindaste, o cabo e
   a lança; o aviso diz "a carga no chão". Esse obstáculo não vai à avaliação como
   `obstacle_conflicts`. Engatada, a carga colide pendurada, inclusive fora do eixo e girada.
8. **Dicas, sem travar o modo livre**: uma faixa sob a barra da cena mostra "Posicione a carga e a
   entrega", "Vá até a carga e engate" e "Leve até a entrega e solte", o que falta para engatar ou
   soltar (distâncias) e a mensagem de sucesso ou de aviso. Nada bloqueia: sem carga posicionada, a
   faixa só explica como praticar.
9. **Gravação**: cada quadro ganha `cargo?` (fase `ground` ou `hooked`, posição e giro no chão, posição
   em relação ao gancho, resultado e tempo da entrega). O cenário gravado já leva `cargo` e `delivery`.
   A reprodução mostra a carga no chão ou no gancho conforme o quadro, e a linha do tempo ganha
   marcadores de "carga engatada" e "carga solta". Gravações antigas, sem `cargo`, abrem como antes.

## Consequências

- O estado da operação (onde a carga está, resultado, tempo) vive na cena (`CargoOperation`) e é
  informado à interface; as regras (distâncias, tolerâncias, entrega) são funções puras em
  `domain/cargo`. Capacidade e segurança continuam sendo do backend (RN-008): a cena só decide se dá
  para engatar e soltar.
- A posição do gancho usada para engatar segue o modelo de colisões (guindaste na vertical); a
  inclinação do chassi em terreno inclinado é só visual (ADR-032).
- Trocar a posição da carga ou as medidas devolve a carga ao chão, na posição escolhida. Ligar o
  editor também.
- Valores (0,5 m, 0,2 m, raio padrão) são FICTÍCIOS e configuráveis, até haver critério oficial
  (ADR-012).
- Um cenário com `cargo` salvo antes do backend novo ser implantado é recusado pelo backend antigo
  (`extra="forbid"`); sem usar as ferramentas, nada muda.
