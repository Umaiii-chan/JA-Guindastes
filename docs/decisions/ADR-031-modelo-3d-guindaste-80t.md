# ADR-031 — troca do modelo 3D do guindaste (80 t, CC BY 4.0)

| Campo                  | Valor                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Status**             | Aceito                                                           |
| **Data**               | 2026-10-14                                                       |
| **Autor**              | agente Claude Code, registrando decisão da pessoa responsável    |
| **Decisores**          | Anderson Sehnem, em chat em 2026-10-14                           |
| **Tarefa relacionada** | TASK-064                                                         |
| **Substitui**          | o modelo do ADR de TASK-043 (FBX do CGTrader) como modelo em uso |

## Contexto

O guindaste 3D da TASK-043 não tinha patolas de verdade (o conversor fundiu o chassi, ADR-024). A
pessoa pediu um modelo gratuito com patolas reais.

## Decisão

- Usar "80-Ton Hydraulic Crane | Oilfield Completions", de awilliams1337 (Sketchfab, **CC BY 4.0**).
  O original fica fora do Git (`assets/source/`); o repositório guarda só o derivado
  `frontend/public/models/guindaste-80t.glb` (4,3 MB) e o script `frontend/scripts/convert-crane-80t.mjs`,
  que confere o SHA-256 da entrada e gera o mesmo arquivo sempre.
- A licença exige crédito: `frontend/public/models/CREDITS.md` e uma linha na Ajuda do simulador.
- O conversor poda as peças de campo de petróleo e a animação, reescreve o modelo nos eixos e na
  escala do simulador (ADR-013 C-1) e o reorganiza nos nós do contrato (`crane-*`), inclusive
  `crane-outrigger-{fl,fr,rl,rr}-{beam,jack,pad}`. Texturas em 1024, `dedup`, `prune` e quantização
  (`KHR_mesh_quantization`, lida pelo GLTFLoader sem decodificador). Sem Draco nem meshopt.
- **Calibração** pela ficha FICTÍCIA de demo (a = −1,56 m; h = 3,3 m; L_min = 12 m): escala única pela
  altura do pino (1,138); o pino do arquivo fica 0,4 m **à frente** da torre, e a ficha pede a < 0.
  Para bater sem mexer na ficha (backend, tabelas e testes), o eixo de giro foi posto 2,0 m à frente
  da torre original. Efeito: ao girar, a superestrutura descreve um arco de 2 m de raio em torno do eixo.
  Se a ficha de demo passar a a = +0,46 m, o conversor pode voltar a centrar o giro na torre.
- Lança com as 4 seções: a extensão (seção 4 e cabeça) é o nó que o controller desliza; as seções 2 e 3
  são repartidas em 1/3 e 2/3 do curso por `updateTelescope` (loader), a cada comando.
- Patolas: o modelo fica na pose recolhida e com os macacos suspensos; o `OutriggerController` recebe o
  curso real das vigas (`TRUCK_CRANE_OUTRIGGER_TRAVEL_M`, 1,71 m) e leva as sapatas até o chão.
- Olho do operador: `extras.olhoDoOperador` na torre (`findOperatorEye`).
- Headache Ball e gancho auxiliar saem do rig principal (podem voltar como acessórios).

## Consequências

- O guindaste tem patolas reais; o modelo continua **ilustrativo** e não define medida de cálculo (RN-003).
- Nesse modelo a lança aponta para o lado oposto da cabine do caminhão (guindaste de operação sobre a
  traseira); a convenção +Z = frente do ADR-013 vale para a lança, não para a cabine.
- A cabeça da lança é escura (textura do original); a polia fica cerca de 1 m abaixo do eixo da lança, e
  o cabo parte do ponto T (no eixo), por dentro da cabeça.
- O GLB tem texturas: os testes no Node leem o arquivo sem elas (`tests/helpers/craneGlb.ts`).
- Os arquivos da TASK-043 (`guindaste-caminhao.glb`, `convert-crane-model.mjs`) ficam no repositório, sem uso.
