# TASK-101 — soltar a carga sobre a carroceria do caminhão

Achado da revisão do PR #48: o planejador entrega a carga sobre a carroceria do caminhão plataforma
da biblioteca (topo a 53 % da altura do objeto), mas a cena só deixava soltar perto do terreno
(`RELEASE_MAX_HEIGHT_M`, `checkRelease`). Um plano "Atende" com entrega sobre a carreta não terminava
na tela. ADR-035 (carga, engatar e soltar), ADR-036 (biblioteca) e ADR-046 (esta decisão).

## Critérios de aceite

- [ ] **CA-1** — A soltura vale quando a base da carga está a até `RELEASE_MAX_HEIGHT_M` (0,2 m)
  acima da superfície de apoio sob ela: o maior entre o terreno e o topo da carroceria de um caminhão
  plataforma da biblioteca sob a pegada da carga.
- [ ] **CA-2** — Solta, a carga fica apoiada no topo da carroceria (não cai até o chão) e a cena e a
  colisão da carga no chão usam essa altura.
- [ ] **CA-3** — Carga ao lado do caminhão continua com a regra do chão; carga parcialmente fora da
  carroceria (pegada com sobreposição) se apoia nela.
- [ ] **CA-4** — Só o caminhão plataforma recebe carga; os demais objetos da biblioteca ficam como
  estavam (pendência registrada no handoff).
- [ ] **CA-5** — Testes unitários do domínio: sobre a carroceria, ao lado, parcialmente fora, com
  giro do caminhão, engate de novo sobre a carroceria.
