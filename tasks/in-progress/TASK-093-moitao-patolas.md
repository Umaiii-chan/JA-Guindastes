# TASK-093 — moitão no engate e patolas que seguem o terreno e a animação

Achados F-09, F-25, F-26 e F-27 da auditoria de 2026-10-16 (física, simulação e tela), sobre
`development` @ `784a9e1`.

## Critérios de aceite

- [x] **CA-1 (F-09)** — Com um moitão na cadeia (acessório `HOOK_BLOCK`, que esconde o moitão do modelo), o ponto de amarração (`currentAttachOffsetM`) e a caixa do gancho (`currentHookBox`) que o engate, as colisões e o planejamento usam são os do moitão: 0,01 m abaixo de G e a caixa medida do moitão (ou, antes de o modelo dele chegar, a faixa da altura do acessório). A carga não salta ao engatar e, com o modelo 80 t, a descida para no moitão e o engate na pose planejada funciona.
- [x] **CA-2 (F-25)** — As sapatas descem até o terreno sob cada uma (altura do terreno convertida para o referencial da base), no guindaste principal e nos adicionais, e acompanham quando o cenário ou o nivelamento muda. Só desenho: a avaliação não muda.
- [x] **CA-3 (F-27)** — "Patolas prontas", o texto dos macacos e o estado enviado à avaliação seguem o que a animação da cena já alcançou, não o comando. Com movimento reduzido ou sem cena, vale o comando na hora.
- [x] **CA-4 (F-26)** — A nota "o modelo 3D atual não traz as patolas" só aparece quando o modelo carregado não tem os nós `crane-outrigger-*`.
- [x] **CA-5** — Os cenários de prova da auditoria viram testes de regressão em `frontend/tests/`.

Evidência e limites em `handoffs/TASK-093.md` (§ 2, § 4 e § 7).

## Testes a escrever depois

- E2E com o moitão do catálogo e a carga no chão: engatar sem salto (precisa do backend semeado).
- Teste da fiação de `mountCraneScene` (sapatas do guindaste principal, inclinação seguindo a animação,
  `onOutriggersChange`) com um renderer falso, se o projeto passar a ter um.
