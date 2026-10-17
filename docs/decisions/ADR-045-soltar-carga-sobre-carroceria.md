# ADR-045 — soltar a carga sobre a carroceria do caminhão plataforma

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
   biblioteca. A tolerância continua 0,2 m.
2. A carroceria é a caixa `loadBed` do objeto (`objectLibrary.ts`), só declarada no `caminhao-plataforma`.
   Conta se a pegada da carga tem **sobreposição com área** com a planta da carroceria (mesmo em
   parte); apenas encostar na borda não conta.
3. Solta, a carga fica apoiada no topo da carroceria; a caixa de colisão da carga no chão e o desenho
   usam essa altura.

## Consequências

- Outros objetos de topo plano (caçamba de picape, contêiner, caminhão baú) **não** recebem carga:
  pendência, a decidir pela pessoa responsável.
- Carga que só se apoia em parte na carroceria assenta no topo dela (sem tombar): simplificação de
  pré-visualização; capacidade e segurança seguem do backend (RN-008).
- Se a carga for solta sobre o caminhão e o caminhão for movido no editor, a carga não o acompanha.
