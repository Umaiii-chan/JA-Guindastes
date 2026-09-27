from dataclasses import dataclass, field
from enum import StrEnum

from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.exceptions.domain_errors import (
    ConflictingLoadChartPointsError,
    InvalidLoadChartError,
)
from app.domain.value_objects.length import Length
from app.domain.value_objects.rotation_zone import require_rotation_zone_code


class LoadChartStatus(StrEnum):
    """Estados da tabela de carga (doc-fonte § 13.2).

    A doc-fonte sugere o fluxo `DRAFT → VALIDATED → ACTIVE → SUPERSEDED`, ou `INVALID`. As
    transições não são implementadas aqui: quais são permitidas, e o "modo técnico de validação"
    que deixaria uma tabela não `ACTIVE` participar de simulações, não estão definidos.
    """

    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    INVALID = "INVALID"


type _PointKey = tuple[Length, Length]


@dataclass(frozen=True)
class LoadChart:
    """Cabeçalho, versão e pontos de uma tabela de carga normalizada (doc-fonte § 10.2).

    Pertence a uma configuração do guindaste, não ao modelo genérico (RN-001), por isso exige
    `configuration_id`. A `version` é a registrada em cada cálculo (RN-005).

    Invariante: não há dois pontos com o mesmo `boom_length` e `working_radius` e capacidades
    diferentes (doc-fonte § 13.1). Pontos repetidos com a mesma capacidade são aceitos e mantidos
    como vieram.

    A tabela não escolhe se pode ser usada numa simulação: selecionar a tabela `ACTIVE` da
    configuração é papel do `ActiveLoadChartProvider` (doc-fonte § 14.1, `LoadChartResolver`).

    `rotation_zone_code` (ADR-018 § 1; TASK-046): a zona de giro da configuração em que a tabela
    vale, ou `None` numa configuração sem zonas (a tabela vale para todo o giro). Quando informado,
    é um código de zona válido (1 a 32 caracteres `[A-Z0-9_]`, `InvalidRotationZonesError`); se a
    zona existe na configuração é conferido na importação, não aqui.
    """

    id: str
    version: str
    configuration_id: str
    status: LoadChartStatus
    points: tuple[LoadChartPoint, ...]
    rotation_zone_code: str | None = None
    _points_by_key: dict[_PointKey, LoadChartPoint] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        for name, value in (
            ("id", self.id),
            ("version", self.version),
            ("configuration_id", self.configuration_id),
        ):
            if not isinstance(value, str) or not value.strip():
                raise InvalidLoadChartError(f"{name} da tabela de carga deve ser informado")
        if not isinstance(self.status, LoadChartStatus):
            raise InvalidLoadChartError(f"status inválido: {self.status!r}")
        if self.rotation_zone_code is not None:
            require_rotation_zone_code(self.rotation_zone_code)

        points = tuple(self.points)
        points_by_key: dict[_PointKey, LoadChartPoint] = {}
        for point in points:
            if not isinstance(point, LoadChartPoint):
                raise InvalidLoadChartError(f"ponto inválido: {point!r}")
            key = (point.boom_length, point.working_radius)
            existing = points_by_key.setdefault(key, point)
            if existing.max_capacity != point.max_capacity:
                raise ConflictingLoadChartPointsError(
                    boom_length_m=point.boom_length.meters,
                    working_radius_m=point.working_radius.meters,
                )

        object.__setattr__(self, "points", points)
        object.__setattr__(self, "_points_by_key", points_by_key)

    def point_at(self, boom_length: Length, working_radius: Length) -> LoadChartPoint | None:
        """Devolve o ponto com exatamente este comprimento de lança e raio, ou `None`.

        Igualdade exata de `float`, sem tolerância nem arredondamento (PEND-002).
        """
        return self._points_by_key.get((boom_length, working_radius))
