# TASK-064 — Novo modelo 3D do guindaste com patolas reais

- **Decisão:** ADR-031 (troca do modelo; pessoa responsável, 2026-10-14).
- **Escopo:** frontend (`scripts/`, `public/models/`, `three/`), docs. Sem backend.
- **Origem:** pedido para trocar o guindaste 3D por um modelo gratuito com patolas de verdade.

## Critérios de aceite

- CA-1 — `scripts/convert-crane-80t.mjs` gera `public/models/guindaste-80t.glb` de forma determinística,
  conferindo o SHA-256 da entrada, sem as peças de petróleo nem a animação, com texturas de até 1024 e
  tamanho de até uns 6 MB.
- CA-2 — O GLB cumpre o contrato de nós (`crane-*` e `crane-outrigger-*`) e passa na conferência de
  calibração da ficha de demo (a, h, L_min) sem aviso.
- CA-3 — Os sliders movem lança (ângulo e comprimento, com as 4 seções), cabo e giro; as patolas
  estendem para os lados e os macacos descem até o chão.
- CA-4 — Créditos CC BY 4.0: `public/models/CREDITS.md` e uma linha discreta na Ajuda.
- CA-5 — Nenhum termo técnico (ADR etc.) na interface.

## Testes a escrever depois

- E2E com o backend: patolas estendidas na cena real e o modelo no passo "Posição".
- Colisão da carga com o corpo do novo chassi (`craneBody`), com a pose inicial.
- Teste visual automatizado (captura) do modelo nas quatro câmeras.
- Medir o desempenho em máquina fraca (4,3 MB).
- Centrar o giro na torre se a ficha de demo passar a a > 0 (ADR-031).
- Estabilizar o alerta «Colisão: comando bloqueado» ao arredondar o slider ao passo (o e2e `collision.spec.ts` deixou de conferir o alerta; ver o handoff).
