"""Tipos do planejamento da operação (TASK-075; ADR-038). Só dados, sem regra."""

from collections.abc import Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol

from app.domain.entities.scenario import CranePlacementSpec
from app.domain.services.environment_factors import SoilKind
from app.domain.services.safety_assessment import TippingRisk
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.safety_profile import SafetyProfile


class PlanPhase(StrEnum):
    """Fases da trajetória, na ordem em que acontecem."""

    APPROACH = "aproximar"
    HOOK = "engatar"
    LIFT = "levantar"
    SWING = "girar"
    LOWER = "baixar"
    RELEASE = "soltar"


@dataclass(frozen=True, slots=True)
class PlanLoad:
    """Carga a transportar. `cg_offset_m` é o centro de gravidade ao longo do comprimento, a partir
    do centro geométrico (só o tandem usa)."""

    weight_kg: float
    length_m: float
    width_m: float
    height_m: float
    cg_offset_m: float = 0.0


@dataclass(frozen=True, slots=True)
class PlanPoint:
    """Ponto de coleta ou de entrega no chão, com o giro da carga em torno de Y."""

    x: float
    z: float
    rotation_y_deg: float = 0.0


@dataclass(frozen=True, slots=True)
class CraneStateValues:
    """Estado do guindaste: L, θ, ψ e c (ADR-013 C-2), em metros e graus."""

    boom_length_m: float
    boom_angle_deg: float
    turret_rotation_deg: float
    cable_length_m: float


@dataclass(frozen=True, slots=True)
class TrajectoryPoint:
    """Quadro-chave da trajetória: o estado do guindaste `crane_index` no instante `t_s`."""

    t_s: float
    crane_index: int
    state: CraneStateValues
    phase: PlanPhase


@dataclass(frozen=True, slots=True)
class StateAssessment:
    """Resultado do cálculo determinístico para um estado (a avaliação do backend, RN-008)."""

    evaluable: bool
    utilization_percent: float = 0.0
    """Peso comparado ÷ capacidade efetiva × 100 (limite do modelo, inclinação e vento)."""
    risk: TippingRisk | None = None
    messages: tuple[str, ...] = ()
    reason: str | None = None
    """Motivo, quando não avaliável (código legível por máquina)."""


class StateEvaluator(Protocol):
    """Avalia um estado de um guindaste com uma carga; implementada pela aplicação sobre o
    `EvaluateOperation`, de modo que a capacidade só venha da tabela e dos limites (RN-004)."""

    def __call__(
        self,
        *,
        configuration_id: str,
        state: CraneStateValues,
        load_weight_kg: float,
        ground_slope_deg: float | None,
        soil_kinds: Sequence[SoilKind],
        wind_speed_ms: float | None,
        obstacle_conflicts: Sequence[str],
    ) -> StateAssessment: ...


@dataclass(frozen=True, slots=True)
class PlannerCrane:
    """O que o planejador precisa saber de uma configuração com tabela ativa."""

    configuration_id: str
    label: str
    geometry: CraneGeometry
    profile: SafetyProfile
    hook_block_weight_kg: float
    max_radius_m: float
    """Maior raio das tabelas ativas da configuração."""
    boom_lengths_m: tuple[float, ...]
    """Comprimentos de lança candidatos (os das tabelas, dentro da faixa da ficha técnica)."""
    manufacturer_id: str = ""
    crane_id: str = ""
    """De onde a configuração vem no catálogo (para a tela escolher a mesma)."""
    zone_boundaries_deg: tuple[float, ...] = ()
    """Fronteiras das zonas de giro (ψ, em graus, ADR-018); vazio sem zonas. No giro, o pior ponto
    de uma zona pode ficar na fronteira, entre dois quadros-chave (TASK-089)."""


@dataclass(frozen=True, slots=True)
class CranePlan:
    """Plano de um guindaste para uma carga: posição, lança e caminho."""

    configuration_id: str
    label: str
    placement: CranePlacementSpec
    boom_length_m: float
    pick_radius_m: float
    delivery_radius_m: float
    swing_deg: float
    """Giro total da coleta à entrega; positivo = anti-horário (esquerda)."""
    pick_state: CraneStateValues
    """Gancho embaixo, na carga, na coleta."""
    delivery_state: CraneStateValues
    """Gancho embaixo, na entrega."""
    path: tuple[CraneStateValues, ...]
    """Amostras do giro, com o gancho na altura de transporte."""
    transport_height_m: float
    """Altura (m, do chão) da base da carga durante o giro."""
    crossed_obstacle_ids: tuple[str, ...]
    max_utilization_percent: float
    tipping_risk: TippingRisk | None
    valid: bool
    share_kg: float
    boom_angle_pick_deg: float
    boom_angle_delivery_deg: float
    messages: tuple[str, ...] = field(default=())
    ground_slope_deg: float = 0.0
    crosses_body: bool = False
    """A carga passa sobre o corpo do próprio guindaste (por isso viaja mais alta)."""
    manufacturer_id: str = ""
    crane_id: str = ""
    hoist_pick: tuple[float, float] | None = None
    hoist_delivery: tuple[float, float] | None = None
    """Pontos de içamento (tandem): onde este guindaste prende a carga na coleta e na entrega."""
    sling_length_m: float = 0.0
    sling_angle_deg: float = 0.0
    sling_drop_m: float = 0.0
    """As lingas que o plano supôs (geometria única de `rigging.py`; F-19): comprimento, ângulo
    com a horizontal e altura do ponto de suspensão ao topo da carga. A cena toca o plano com
    elas."""
