# ADR-049 — apoio da carga só na carroceria do caminhão plataforma

| Campo                  | Valor                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Status**             | Proposto                                                                      |
| **Data**               | 2026-10-17                                                                    |
| **Autor**              | agente Claude Code, implementador da TASK-102                                 |
| **Decisores**          | Anderson Sehnem (pendente de confirmação)                                     |
| **Tarefa relacionada** | TASK-102                                                                      |
| **Substitui**          | só a Decisão 5 do ADR-042, quanto a quem recebe a carga por cima              |
| **Complementa**        | ADR-046 (critério de apoio na cena), ADR-036 (biblioteca de objetos)          |
| **Substituído em parte por** | ADR-052 (TASK-108): a Decisão 1 (só o caminhão plataforma recebe a carga) passa a valer para todo objeto da biblioteca que declara superfície de apoio (carreta prancha e contêineres incluídos); as Decisões 2 a 5 seguem |

## Contexto

A Decisão 5 do ADR-042 deixava a carga pousar em cima de "carreta ou caminhão plataforma"
(`is_platform_vehicle`: o modelo da biblioteca ou qualquer obstáculo com "carreta" ou "plataforma" no
nome), no topo da caixa inteira. A revisão do PR #48 e a do PR #58 mostraram três divergências com a
cena (ADR-046, `loadBeds.ts`): a carga era apoiada no topo da caixa e não da carroceria (53 % da
altura); a caixa "carreta" não tem carroceria na cena (`loadBedsOf` só vê objetos da biblioteca); e
a carga comprida com a ponta sobre a cabine passava no plano e batia na cena.

## Decisão

1. **Só o caminhão plataforma da biblioteca** (`caminhao-plataforma`) recebe a carga por cima. Uma
   caixa chamada "carreta" ou "plataforma" é obstáculo comum, na coleta, na entrega, no caminho e no
   layout seguro da IA.
2. **Critério de apoio** (o mesmo da cena, ADR-046): a carga se apoia na carroceria quando o **centro
   da pegada** cai dentro do retângulo da carroceria, girado e escalado com o objeto (a 1ª caixa de
   `vehicle()`, `loadBed` de `objectLibrary.ts`). Senão vale o terreno, e o caminhão é obstáculo comum.
3. **Altura de apoio:** o topo da carroceria, 0,53 da altura do objeto (1,86 m de 3,51 m).
4. **Coleta e entrega** usam o mesmo apoio. O cabo e o gancho não são conferidos contra o caminhão que
   apoia a carga (na aproximação, na coleta e na entrega); a lança continua conferida.
5. **A cabine bloqueia.** Apoiada na carroceria, a pegada da carga não pode invadir os trechos do
   caminhão mais altos que a carroceria (as caixas por trecho do modelo, como a cena).

## Alternativas consideradas

| Alternativa | Por que não |
|-------------|-------------|
| Manter "carreta ou plataforma" por nome | a cena não tem carroceria para caixas: o plano não executaria |
| Apoiar com qualquer sobreposição da pegada (ADR-046, decisão 2) | a carga de pegada grande se apoiaria com o centro no ar; o centro é o critério acordado para os dois lados |

## Consequências

- Cenários da IA com uma caixa "carreta" no ponto de entrega deixam de ter entrega sobre ela: o
  layout seguro a afasta como a qualquer obstáculo. O prompt da IA já manda usar o objeto da biblioteca.
- O caminhão inteiro continua prisma cheio na conferência do cabo e da lança (a cabine é mais alta).
- Outros objetos de topo plano seguem sem receber carga (pendência do ADR-046).

## Impacto na documentação

- [x] `docs/known-gaps.md` (L-016) atualizado
- [x] índice em `docs/decisions/README.md` atualizado

## Evidências

- `backend/tests/domain/services/planning/test_library_boxes.py`: valores dourados do frontend;
  `test_sweep.py` e `test_recommend_lift_plan_caminho.py`: apoio, centro fora, cabine e caixa "carreta";
  `test_scenario_layout.py`: caixa "carreta" fora do ponto de entrega.
