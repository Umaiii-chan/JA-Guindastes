# Créditos da biblioteca de objetos (editor 3D do ambiente)

Os GLBs desta pasta alimentam a paleta "Biblioteca" do editor do ambiente (TASK-072; ADR-036). São
gerados por `frontend/scripts/build-object-library.mjs` a partir dos kits abaixo, que ficam fora do
Git (`assets/source/kenney/`).

## Modelos da Kenney (domínio público, CC0 1.0)

- **Autor:** Kenney, https://kenney.nl
- **Licença:** [Creative Commons Zero (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/),
  uso livre, inclusive comercial, sem exigência de crédito (aqui registrado por cortesia).
- **Kits usados:**
  - Nature Kit: `arvore-carvalho`, `pinheiro`, `arvore-copa-redonda`, `palmeira`, `moita-grande`,
    `moita`;
  - Suburban Kit: `casa-terrea`, `casa-sobrado`;
  - Industrial Kit: `galpao-fechado`, `conteiner`;
  - Car Kit: `caminhao`, `caminhao-plataforma`, `caminhao-bau`, `sedan`, `suv`, `van`.
- **Modificado:** escala única até o tamanho real em metros, base em y = 0, centro da planta na
  origem, vértices soldados e quantizados (`KHR_mesh_quantization`). A geometria e a textura de
  paleta são as originais.

## Carreta prancha (do próprio projeto)

`carreta-prancha.glb` não vem de um kit: é desenhado por código (caixas e cilindros, sem textura) por
`frontend/scripts/build-carreta-prancha.mjs` e é trabalho do próprio projeto, sem licença de terceiros.
Semirreboque plano de 3 eixos, convés de 2,6 m x 13 m a 1,5 m do chão. As medidas são típicas e
**FICTÍCIAS** (não são de um fabricante). Recebe a carga por cima (TASK-108; ADR-052).

## Contêineres de 20 e 40 pés (TASK-108; ADR-052)

`conteiner-20`, `conteiner-40` e `conteiner-40hc` usam o mesmo arquivo do contêiner da Kenney
(`conteiner.glb`, CC0), esticado por eixo até a medida ISO 668 (20 pés: 6,058 x 2,438 x 2,591 m; 40 pés:
12,192 x 2,438 x 2,591 m; *high cube*: 2,896 m de altura). O teto é plano; o visual das ondulações e das
portas é aproximado.

## Galpão com frente aberta (Sketchfab, CC BY 4.0)

`barracao-aberto.glb` ("Galpão com frente aberta" na biblioteca) vem do modelo abaixo. Os galpões
da Kenney são maciços, com o portão só pintado, e não servem para a carga entrar.

- **Título:** Hangar
- **Autor:** nermin, https://sketchfab.com/nermin
- **Link:** https://sketchfab.com/3d-models/64f7d287f5274029bc29755a9839ebbf
- **Licença:** [Creative Commons Atribuição 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Modificado:** o pano da frente (com o portão fechado e as janelas pintados), o toldo, as
  lâmpadas, a caixa de luz e o barril foram removidos, para a frente ficar aberta; escala em
  metros, base em y = 0, centro da planta na origem; texturas até 1024 px em WebP, vértices
  soldados e quantizados. O arquivo é gerado por `frontend/scripts/build-sketchfab-models.mjs` a
  partir do original, que fica fora do Git (`assets/source/sketchfab/galpoes/`).

Outros seis galpões do Sketchfab foram avaliados e não foram usados (fechados, sem abertura
aproveitável ou fora da escala), por isso não estão aqui nem neste pacote.

## Guindaste estacionado

O objeto "Guindaste estacionado" usa o próprio `../guindaste-80t.glb` (créditos em
`../CREDITS.md`, CC BY 4.0), na pose de repouso.

Os modelos são ilustrativos e não representam objetos reais.
