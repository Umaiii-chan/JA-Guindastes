# ADR-046 — soltar a carga sobre a carroceria do caminhão plataforma

| Campo                  | Valor                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Status**             | Proposto                                                 |
| **Data**               | 2026-10-17                                               |
| **Autor**              | agente Claude Code, implementador da TASK-101            |
| **Decisores**          | Anderson Sehnem                                          |
| **Tarefa relacionada** | TASK-101                                                 |
| **Complementa**        | ADR-035 (segue Aceito e sem mudança), ADR-036            |

## Contexto

O ADR-035 permite soltar a carga a até 0,2 m do chão. O planejador entrega a carga sobre a carroceria
do caminhão plataforma (ADR-036), que fica a 53 % da altura do objeto, e a cena não deixava soltar ali.

## Decisão

1. A soltura (e o engate de uma carga já apoiada) usa a **superfície de apoio** sob a pegada da carga:
   o maior entre o terreno (regra do ADR-035) e o topo da carroceria de um caminhão plataforma da
   biblioteca, **se o centro da pegada da carga cair dentro dela** (ponto 2). A tolerância continua
   0,2 m.
2. A carroceria é a caixa `loadBed` do objeto (`objectLibrary.ts`), só declarada no `caminhao-plataforma`.
   **Critério de apoio (TASK-103; igual no frontend e no backend):** a carga só se apoia na carroceria
   quando o **centro da pegada** (projeção do centro da carga no plano, com o giro da carga) cai
   dentro do retângulo girado da carroceria (a borda conta como dentro). Senão vale o terreno, e o
   caminhão é um obstáculo comum: a colisão detém a carga. A altura de apoio é o topo da carroceria
   (53 % da altura do objeto, primeira caixa do caminhão plataforma). Antes bastava a pegada cobrir a
   carroceria com área > 1e-6 m², e a carga inteira subia a 1,86 m mesmo apoiada 1 cm na borda
   (carga que flutua); o critério antigo foi substituído.
3. Solta, a carga fica apoiada no topo da carroceria; o desenho e a caixa de colisão da carga no chão
   usam essa altura (o prisma vai do topo da carroceria ao topo da carga, sem descer ao terreno).

## Consequências

- Outros objetos de topo plano (caçamba de picape, contêiner, caminhão baú) **não** recebem carga:
  pendência, a decidir pela pessoa responsável.
- Carga com o centro dentro da carroceria e a ponta para fora assenta no topo dela (sem tombar):
  simplificação de pré-visualização; capacidade e segurança seguem do backend (RN-008).
- Se a carga for solta sobre o caminhão e o caminhão for movido no editor, a carga não o acompanha.
