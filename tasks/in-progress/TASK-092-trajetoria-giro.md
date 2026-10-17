# TASK-092 — trajetória varrida e giro contínuo com volta

Achados F-08, F-11 e F-22 da auditoria de 2026-10-16 (seção 2), pedidos pela pessoa responsável
para a leva de correções. RN-012: o comando que causaria colisão para no último estado seguro.

- **F-08** — na execução da trajetória planejada, um quadro longo (aba em segundo plano, GPU lenta)
  deixava a carga atravessar um obstáculo fino: o `setState` guardado conferia só o estado final e o
  `dt` do quadro não tinha limite.
- **F-11** — perto de ±180°, a busca do último estado seguro interpolava ψ em graus crus e ia pelo
  caminho longo, aplicando um giro do outro lado do obstáculo.
- **F-22** — no guindaste de giro contínuo, o slider ia de −180° a 180° e travava nas pontas; de
  170° para −170° a guarda conferia 340° pela frente.

## Critérios de aceite

- [x] **CA-1** — O `setState` guardado (`SwitchableCrane`) varre o caminho do estado anterior ao pedido com os mesmos passos do comando de um eixo (`SWEEP_STEP`, no máximo 400 amostras) e para no último estado seguro, com todos os campos juntos. Estende a TASK-077 CA-1, que conferia só o estado final. Poste FICTÍCIO de 0,2 m em ψ = 12° e R = 10,29 m: o salto 4° → 20° para em 9,963°, igual ao `setTurretRotation`.
- [x] **CA-2** — A execução da trajetória anda no máximo 0,1 s de tempo real por quadro (`MAX_FRAME_DT_S`, como as patolas); um quadro de 5 s não aplica vários quadros-chave de uma vez.
- [x] **CA-3** — Giro contínuo: a busca do estado seguro interpola ψ pelo menor ângulo (`shortestAngleDeltaDeg`) e só depois traz à faixa. De 179,5° para −178° (= 182°), com poste em 184°, para em −178,8° (= 181,2°), antes do poste. A reprodução de gravação continua igual (TASK-077 CA-2 e CA-3).
- [x] **CA-4** — Giro contínuo (sem ψ_min/ψ_max na ficha, e o guindaste provisório): o comando aplica o menor delta e dá a volta (181° → −179°); as setas nas pontas do slider continuam girando. O slider segue de −180° a 180°, com o nome acessível "Giro da torre".
- [x] **CA-5** — Guindaste com limites de giro: continua o clamp, e o caminho da guarda fica dentro da faixa (não passa pelo batente).
- [ ] **CA-6** — Validação no navegador: trajetória com a aba em segundo plano e giro contínuo pelo slider. NÃO EXECUTADA nesta tarefa (ver o handoff).

## Testes a escrever depois

- E2E: girar pela seta além de 180° no simulador e conferir que o valor passa a −179°.
- E2E: executar uma trajetória com obstáculo fino no caminho do giro.
