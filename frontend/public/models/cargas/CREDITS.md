# Créditos dos modelos de carga

Os GLBs desta pasta são os tipos de carga do passo "Carga" do simulador (leva F): a cena escala o
modelo para as medidas digitadas e o desenha no lugar da caixa. Todos vêm do Sketchfab, sob
[Creative Commons Atribuição 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), e são
gerados por `frontend/scripts/build-sketchfab-models.mjs` a partir dos originais, que ficam fora do Git
(`assets/source/sketchfab/cargas/`).

| Arquivo                       | Tipo de carga            | Título                                     | Autor                                                     | Link                                                             |
| ----------------------------- | ------------------------ | ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `caixa-madeira.glb`           | Caixa de madeira         | Wooden Crate                               | Memorie (https://sketchfab.com/Memorie)                   | https://sketchfab.com/3d-models/2a3ac54357bb4b92bfbc119111c09fd1 |
| `conteiner.glb`               | Contêiner                | Shipping Container                         | BeaVex (https://sketchfab.com/BeaVex)                     | https://sketchfab.com/3d-models/429e58a328374df4921b8a12bc142b28 |
| `feixe-tubos.glb`             | Feixe de tubos           | Old Pipes Bundle – Modular Industrial Pack | Alex_Krush (https://sketchfab.com/Alex_Krush)             | https://sketchfab.com/3d-models/fbe3129ea77243ca92c8219f269ac5cf |
| `gerador-diesel.glb`          | Gerador                  | Diesel generator                           | epilogueronin (https://sketchfab.com/epilogueronin)       | https://sketchfab.com/3d-models/7a0b72c7d01944a8aafab59d44eb120e |
| `transformador.glb`           | Transformador            | Electrical Transformer                     | abass20 (https://sketchfab.com/abass20)                   | https://sketchfab.com/3d-models/615fe4b367314a72b7dffb8ec791f575 |
| `viga-concreto-canal.glb`     | Viga de concreto (calha) | Concrete Channel Beam Set                  | kcproductions211 (https://sketchfab.com/kcproductions211) | https://sketchfab.com/3d-models/3109773bb88a4c8796ca6845c26c7997 |
| `viga-concreto-tubgirder.glb` | Viga de concreto         | Concrete_beam_tubgirder                    | kcproductions211 (https://sketchfab.com/kcproductions211) | https://sketchfab.com/3d-models/4e7d470a86854299bcb86c5c19b33111 |

**Modificado:** nos dois arquivos de viga, só uma das vigas do conjunto foi mantida; todos: escala em
metros (comprimento em Z, largura em X, altura em Y, base em y = 0, centro da planta na origem),
texturas até 1024 px em WebP, vértices soldados e quantizados (`KHR_mesh_quantization`). O feixe de
tubos e o gerador foram girados 90° em torno de Y para o lado maior ficar em Z.

Os modelos são ilustrativos e não representam cargas reais: o peso e as medidas valem os digitados.
