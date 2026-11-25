# ADR-053 — recomendar dois guindastes quando um só não atende, e planejar e simular com os dois

| Campo                  | Valor                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| **Status**             | Aceito (gatilho confirmado em 2026-11-25)                          |
| **Data**               | 2026-11-25                                                         |
| **Autor**              | agente Claude Code, implementador da TASK-120                      |
| **Decisores**          | Anderson Sehnem (confirmou o gatilho em chat, 2026-11-25)                          |
| **Tarefa relacionada** | TASK-120                                                           |
| **Regras**             | RN-008, RN-011, RN-016 (nenhuma regra de cálculo nova)             |
| **Complementa**        | ADR-037 (tandem), ADR-038 (planejamento), ADR-041 (pontos de içamento) |

## Contexto

O simulador já tinha o içamento com dois guindastes (RN-016: 75 % da capacidade de cada um, carga
dividida pela alavanca em relação ao centro de gravidade) e o planejador já tentava o tandem quando
nenhum guindaste sozinho atendia (ADR-038, TASK-089). Faltava, para a pessoa que opera a tela:

1. ser **avisada** de que um guindaste só não dá, na avaliação (cartão de resultado), e levada ao
   planejamento;
2. **planejar e simular com os dois** sem passos manuais: "Aplicar" de um tandem posicionava os dois
   guindastes, mas a trajetória só engatava os dois se a pessoa ligasse o içamento com dois
   guindastes antes, e o passo a passo só falava do Guindaste 1.

## Decisão

1. **Nenhuma regra de cálculo é criada nem alterada.** A divisão da carga, os 75 %, os pontos de içamento
   e a avaliação de cada guindaste continuam sendo os da RN-016 e dos ADR-037/038/041. A capacidade e o
   risco continuam vindo só do backend (RN-008).
2. **Gatilho do aviso (decisão de produto nova, a confirmar).** O cartão de resultado de um guindaste
   recomenda dois guindastes quando o resultado é:
   - **avaliado com o uso do limite acima de 100 %** (RN-011; sem limite, a utilização da tabela); ou
   - **não avaliável porque o ponto passa da tabela**: `POINT_NOT_IN_CHART`, `BOOM_LENGTH_ABOVE_CHART_MAX`
     ou `RADIUS_ABOVE_CHART_MAX` (carga acima da tabela ou raio fora do alcance).

   Não recomenda quando dois guindastes não resolvem: sem ficha técnica, sem tabela ativa, acessório
   inexistente, geometria impossível, estado fora das faixas da ficha (ângulo, lança, cabo) ou raio
   abaixo do mínimo da tabela. A recomendação é um aviso com botão "Planejar com 2 guindastes"; **não
   bloqueia nada** e não muda o resultado da avaliação.
3. **Quem decide se dois atendem é o planejador**, como já era (ADR-038): se nenhuma configuração sozinha
   é válida, ele planeja o tandem (posições dos dois, divisão da carga, trajetória e avaliação de cada
   um); se nem o tandem atende, devolve as melhores opções marcadas "Não atende". A tela só mostra o
   aviso de "2 guindastes" na lista de recomendações quando há tandem e nenhum guindaste sozinho válido.
4. **"Aplicar" um tandem liga o içamento com dois guindastes** (posiciona o Guindaste 2, como antes, e ativa
   o modo); "Aplicar" um guindaste só desliga. Assim "Executar trajetória" engata a carga nos dois e o
   Guindaste 2 acompanha o 1 (`MultiCrane`), sem o passo manual.
5. **A recomendação mostra a divisão por guindaste** (modelo, parte da carga, raios e % do limite), e o
   passo a passo de "Posicionar" lista as duas posições.

## Consequências

- Sem mudança no backend nem na API: o contrato `POST /planning/recommend` já devolve `kind: tandem`,
  duas posições, duas trajetórias e os detalhes por guindaste.
- A trajetória continua movendo só o Guindaste 1 (o 2 segue o 1 pela cena do tandem, ADR-037); o passo a
  passo de cada fase continua sendo o do Guindaste 1.
- O gatilho por código de motivo fica numa lista em `singleCraneShortfall.ts`; se a pessoa responsável
  quiser outros motivos, é uma linha.
- **A confirmar com a pessoa responsável:** (a) se o gatilho acima é o desejado (principalmente os 100 %
  do limite e a exclusão de ângulo/lança fora da ficha); (b) se o texto "Recomendamos operar com 2
  guindastes" serve; (c) se a RN-021 (ou um item na RN-016) deve registrar o gatilho em
  `docs/business-rules.md` (arquivo protegido; não editado por agente).
