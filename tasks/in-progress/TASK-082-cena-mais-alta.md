# TASK-082 — Cena 3D mais alta e painel de resultado compacto

Estado: em andamento (aguardando revisão).

## Contexto

Na página do Simulador sobrava espaço em branco abaixo do painel de avaliação (alturas fixas das
TASK-063/078) e a cena 3D ficava pequena.

## Critérios de aceite

- [x] O painel de resultado (`.result`) tem altura fixa e compacta (222 px; 196 px em telas baixas),
      sem espaço reservado vazio; alertas de segurança e detalhes rolam por dentro.
- [x] O aviso de colisão fica sobreposto à parte de baixo da cena (fora do fluxo): aparecer ou sumir
      não muda a altura da cena nem da ficha.
- [x] A cena 3D ocupa toda a altura restante da prancha (linha `minmax(0, 1fr)`).
- [x] A 1440×900 a cena sobe de 42 % para 51 % da altura da janela; a 1920×1080, de 52 % para 59 %.
- [x] Sem rolagem horizontal em 1280×720, 1440×900 e 1920×1080.
- [x] O botão "Gerar relatório de içamento" saiu da ficha de avaliação e foi para a coluna da
      geometria (ocupava uma linha inteira de 28 px).
- [ ] Meta de 55 % a 1440×900 não atingida (ver pendências).

## Testes a escrever depois

- Teste de layout no Playwright: a 1440×900, `canvas` com pelo menos 50 % da altura da janela e
  sem rolagem horizontal em 1280×720, 1440×900 e 1920×1080.
- Teste de estabilidade (TASK-078) no Playwright: carga acima do limite aparecendo e sumindo, com a
  altura do canvas idêntica; idem com uma colisão real (medida só com DOM simulado).
- Conferir a ficha com resultado real e alertas longos (a medida foi feita no estado "aguardando").
