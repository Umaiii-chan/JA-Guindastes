from dataclasses import dataclass

from app.domain.exceptions.load_errors import InvalidLoadError
from app.domain.value_objects.load_center_of_gravity import LoadCenterOfGravity
from app.domain.value_objects.load_dimensions import LoadDimensions
from app.domain.value_objects.mass import Mass


@dataclass(frozen=True)
class Load:
    """Carga da simulação, com peso e dimensões (doc-fonte § 10.2; RF-011).

    - `description`: texto livre que identifica a carga para o usuário. Obrigatório e não vazio
      (**provisório, TASK-028**: a doc-fonte não fala de descrição).
    - `weight`: o peso **informado pelo usuário**, em kg (RN-006). Nada é somado a ele: se a carga
      comparada com a capacidade inclui acessórios, moitões, cabos e pesos auxiliares ("carga
      bruta") depende da PEND-006, ainda pendente (known-gaps P-005). **Provisório (TASK-028):**
      precisa ser maior que zero; a doc não diz se uma carga de 0 kg é válida.
    - `dimensions`: comprimento, largura e altura, todos maiores que zero (`LoadDimensions`).
    - `center_of_gravity`: opcional até validação do escopo (doc-fonte § 10.2). Quando informado,
      precisa ficar dentro da caixa das dimensões, faces incluídas (`LoadCenterOfGravity`).
    - `id`: identificador opcional (a carga pode não estar persistida). Quando informado, não pode
      ser vazio.

    A igualdade é por valor, sobre todos os campos, como nas demais dataclasses do domínio. Se uma
    carga persistida deve ser comparada só pelo `id` fica para a tarefa de persistência.

    Qual peso vai para a comparação com a capacidade é decidido por
    `app.domain.services.compared_load_weight.weight_compared_with_capacity`.
    """

    description: str
    weight: Mass
    dimensions: LoadDimensions
    center_of_gravity: LoadCenterOfGravity | None = None
    id: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.description, str) or not self.description.strip():
            raise InvalidLoadError("a descrição da carga deve ser informada")
        if self.id is not None and (not isinstance(self.id, str) or not self.id.strip()):
            raise InvalidLoadError("o id da carga, quando informado, não pode ser vazio")
        if not isinstance(self.weight, Mass):
            raise InvalidLoadError(f"weight da carga deve ser Mass, recebido {self.weight!r}")
        if self.weight.kilograms == 0:
            raise InvalidLoadError(
                "o peso da carga deve ser maior que zero (regra provisória, TASK-028)"
            )
        if not isinstance(self.dimensions, LoadDimensions):
            raise InvalidLoadError(
                f"dimensions da carga deve ser LoadDimensions, recebido {self.dimensions!r}"
            )
        if self.center_of_gravity is not None:
            self._require_center_of_gravity_inside_dimensions(self.center_of_gravity)

    def _require_center_of_gravity_inside_dimensions(self, cg: object) -> None:
        if not isinstance(cg, LoadCenterOfGravity):
            raise InvalidLoadError(
                f"center_of_gravity da carga deve ser LoadCenterOfGravity ou None, recebido {cg!r}"
            )
        for axis, offset_m, edge in (
            ("comprimento", cg.along_length_m, self.dimensions.length),
            ("largura", cg.along_width_m, self.dimensions.width),
            ("altura", cg.along_height_m, self.dimensions.height),
        ):
            half_edge_m = edge.meters / 2
            if abs(offset_m) > half_edge_m:
                raise InvalidLoadError(
                    f"centro de gravidade fora da carga ao longo da {axis}: {offset_m} m a partir "
                    f"do centro, com meia aresta de {half_edge_m} m"
                )
