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

## Barracão aberto

`barracao-aberto.glb` é gerado por código no mesmo script (paredes, porta, piso e telhado de duas
águas translúcido); não vem de nenhum kit. Os galpões da Kenney são maciços, com o portão só
pintado, e não servem para a carga entrar.

## Guindaste estacionado

O objeto "Guindaste estacionado" usa o próprio `../guindaste-80t.glb` (créditos em
`../CREDITS.md`, CC BY 4.0), na pose de repouso.

Os modelos são ilustrativos e não representam objetos reais.
