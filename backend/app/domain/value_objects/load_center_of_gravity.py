from dataclasses import dataclass

from app.domain.value_objects._numeric import require_finite


@dataclass(frozen=True)
class LoadCenterOfGravity:
    """Centro de gravidade da carga, no referencial da própria carga, em metros.

    A doc-fonte (§ 10.2) só diz que o centro de gravidade "permanece opcional até validação do
    escopo". O referencial abaixo é **provisório (TASK-028)**, registrado como pendência no handoff:

    - origem no centro geométrico da caixa definida pelas dimensões (`LoadDimensions`);
    - `along_length_m`, `along_width_m` e `along_height_m`: deslocamentos ao longo das arestas de
      comprimento, largura e altura. Podem ser negativos; o sentido positivo de cada eixo não está
      definido em relação ao guindaste nem à cena.

    Este value object só exige coordenadas finitas. Estar dentro da caixa depende das dimensões e
    é verificado pela `Load`. Nenhum cálculo usa o centro de gravidade hoje.
    """

    along_length_m: float
    along_width_m: float
    along_height_m: float

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "along_length_m",
            require_finite(self.along_length_m, "centro de gravidade (comprimento)"),
        )
        object.__setattr__(
            self,
            "along_width_m",
            require_finite(self.along_width_m, "centro de gravidade (largura)"),
        )
        object.__setattr__(
            self,
            "along_height_m",
            require_finite(self.along_height_m, "centro de gravidade (altura)"),
        )
