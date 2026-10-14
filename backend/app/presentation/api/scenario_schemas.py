"""Schemas Pydantic dos cenários (TASK-052; ADR-023).

JSON em `snake_case`, equivalente ao `ScenarioSpec` do frontend. Entradas estritas (`strict`,
`extra="forbid"`, sem `NaN`/infinito); as regras de faixa ficam no domínio
(`app.domain.entities.scenario`), aqui só a forma.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.scenario import (
    CargoSpec,
    CranePlacementSpec,
    DeliverySpec,
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    Scenario,
    ScenarioSpec,
    SoilKind,
    SoilZoneSpec,
    TerrainFeatureSpec,
    TerrainSpec,
    WindSpec,
)

_STRICT_INPUT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")


class TerrainFeaturePayload(BaseModel):
    model_config = _STRICT_INPUT

    id: str
    kind: Literal["mound", "pit", "plateau", "ramp", "flatten"] = Field(
        description="Elevação, depressão, platô, rampa ou nivelamento."
    )
    center_x: float
    center_z: float
    radius_m: float = Field(description="Raio (rampa: meio comprimento), em metros; > 0.")
    height_m: float = Field(
        description="Altura, em metros; >= 0 (a depressão desce pelo tipo). No nivelamento, o "
        "nível absoluto, que pode ser negativo."
    )
    direction_deg: float | None = Field(default=None, description="Só rampa: direção da subida.")
    width_m: float | None = Field(default=None, description="Só rampa: largura, em metros.")

    def to_domain(self) -> TerrainFeatureSpec:
        return TerrainFeatureSpec(
            id=self.id,
            kind=FeatureKind(self.kind),
            center_x=self.center_x,
            center_z=self.center_z,
            radius_m=self.radius_m,
            height_m=self.height_m,
            direction_deg=self.direction_deg,
            width_m=self.width_m,
        )

    @classmethod
    def from_domain(cls, feature: TerrainFeatureSpec) -> TerrainFeaturePayload:
        return cls(
            id=feature.id,
            kind=feature.kind.value,
            center_x=feature.center_x,
            center_z=feature.center_z,
            radius_m=feature.radius_m,
            height_m=feature.height_m,
            direction_deg=feature.direction_deg,
            width_m=feature.width_m,
        )


class TerrainPayload(BaseModel):
    model_config = _STRICT_INPUT

    slope_x_percent: float = Field(description="Subida em m a cada 100 m ao longo de X.")
    slope_z_percent: float = Field(description="Subida em m a cada 100 m ao longo de Z.")
    features: list[TerrainFeaturePayload]


class ObstaclePayload(BaseModel):
    model_config = _STRICT_INPUT

    id: str
    label: str
    kind: Literal["box", "cylinder"]
    center_x: float
    center_z: float
    width_m: float = Field(description="Largura; no cilindro, o diâmetro.")
    depth_m: float
    height_m: float
    rotation_y_deg: float

    def to_domain(self) -> ObstacleSpec:
        return ObstacleSpec(
            id=self.id,
            label=self.label,
            kind=ObstacleKind(self.kind),
            center_x=self.center_x,
            center_z=self.center_z,
            width_m=self.width_m,
            depth_m=self.depth_m,
            height_m=self.height_m,
            rotation_y_deg=self.rotation_y_deg,
        )

    @classmethod
    def from_domain(cls, obstacle: ObstacleSpec) -> ObstaclePayload:
        return cls(
            id=obstacle.id,
            label=obstacle.label,
            kind=obstacle.kind.value,
            center_x=obstacle.center_x,
            center_z=obstacle.center_z,
            width_m=obstacle.width_m,
            depth_m=obstacle.depth_m,
            height_m=obstacle.height_m,
            rotation_y_deg=obstacle.rotation_y_deg,
        )


class CranePlacementPayload(BaseModel):
    model_config = _STRICT_INPUT

    x: float
    z: float
    heading_deg: float


class SoilZonePayload(BaseModel):
    model_config = _STRICT_INPUT

    id: str
    kind: Literal["rock", "compacted", "clay", "loose_fill"] = Field(
        description="Rochoso, compactado, argiloso ou aterro solto."
    )
    center_x: float
    center_z: float
    radius_m: float = Field(description="Raio da zona, em metros; > 0.")

    def to_domain(self) -> SoilZoneSpec:
        return SoilZoneSpec(
            id=self.id,
            kind=SoilKind(self.kind),
            center_x=self.center_x,
            center_z=self.center_z,
            radius_m=self.radius_m,
        )

    @classmethod
    def from_domain(cls, zone: SoilZoneSpec) -> SoilZonePayload:
        return cls(
            id=zone.id,
            kind=zone.kind.value,
            center_x=zone.center_x,
            center_z=zone.center_z,
            radius_m=zone.radius_m,
        )


class WindPayload(BaseModel):
    model_config = _STRICT_INPUT

    speed_ms: float = Field(description="Velocidade do vento, em m/s; de 0 a 100.")
    direction_deg: float = Field(description="Direção para onde sopra, em graus a partir de +X.")


class CargoPayload(BaseModel):
    model_config = _STRICT_INPUT

    x: float
    z: float
    rotation_y_deg: float


class DeliveryPayload(BaseModel):
    model_config = _STRICT_INPUT

    x: float
    z: float
    rotation_y_deg: float
    radius_m: float = Field(description="Raio da área de entrega, em metros; > 0.")


class ScenarioSpecPayload(BaseModel):
    """`ScenarioSpec` do frontend, em `snake_case`."""

    model_config = _STRICT_INPUT

    terrain: TerrainPayload
    obstacles: list[ObstaclePayload]
    crane: CranePlacementPayload
    soil_zones: list[SoilZonePayload] | None = Field(
        default=None, description="Zonas de solo pintadas; opcional (TASK-066)."
    )
    wind: WindPayload | None = Field(default=None, description="Vento; opcional (TASK-066).")
    cargo: CargoPayload | None = Field(
        default=None, description="Posição inicial da carga; opcional (leva F)."
    )
    delivery: DeliveryPayload | None = Field(
        default=None, description="Área de entrega da carga; opcional (leva F)."
    )

    def to_domain(self) -> ScenarioSpec:
        """Monta e valida o `ScenarioSpec` (`InvalidScenarioError` se violar uma regra)."""
        return ScenarioSpec(
            terrain=TerrainSpec(
                slope_x_percent=self.terrain.slope_x_percent,
                slope_z_percent=self.terrain.slope_z_percent,
                features=tuple(feature.to_domain() for feature in self.terrain.features),
            ),
            obstacles=tuple(obstacle.to_domain() for obstacle in self.obstacles),
            crane=CranePlacementSpec(
                x=self.crane.x, z=self.crane.z, heading_deg=self.crane.heading_deg
            ),
            soil_zones=tuple(zone.to_domain() for zone in self.soil_zones or []),
            wind=(
                None
                if self.wind is None
                else WindSpec(speed_ms=self.wind.speed_ms, direction_deg=self.wind.direction_deg)
            ),
            cargo=(
                None
                if self.cargo is None
                else CargoSpec(
                    x=self.cargo.x, z=self.cargo.z, rotation_y_deg=self.cargo.rotation_y_deg
                )
            ),
            delivery=(
                None
                if self.delivery is None
                else DeliverySpec(
                    x=self.delivery.x,
                    z=self.delivery.z,
                    rotation_y_deg=self.delivery.rotation_y_deg,
                    radius_m=self.delivery.radius_m,
                )
            ),
        )

    @classmethod
    def from_domain(cls, spec: ScenarioSpec) -> ScenarioSpecPayload:
        return cls(
            terrain=TerrainPayload(
                slope_x_percent=spec.terrain.slope_x_percent,
                slope_z_percent=spec.terrain.slope_z_percent,
                features=[TerrainFeaturePayload.from_domain(f) for f in spec.terrain.features],
            ),
            obstacles=[ObstaclePayload.from_domain(o) for o in spec.obstacles],
            crane=CranePlacementPayload(
                x=spec.crane.x, z=spec.crane.z, heading_deg=spec.crane.heading_deg
            ),
            soil_zones=[SoilZonePayload.from_domain(z) for z in spec.soil_zones] or None,
            wind=(
                None
                if spec.wind is None
                else WindPayload(speed_ms=spec.wind.speed_ms, direction_deg=spec.wind.direction_deg)
            ),
            cargo=(
                None
                if spec.cargo is None
                else CargoPayload(
                    x=spec.cargo.x, z=spec.cargo.z, rotation_y_deg=spec.cargo.rotation_y_deg
                )
            ),
            delivery=(
                None
                if spec.delivery is None
                else DeliveryPayload(
                    x=spec.delivery.x,
                    z=spec.delivery.z,
                    rotation_y_deg=spec.delivery.rotation_y_deg,
                    radius_m=spec.delivery.radius_m,
                )
            ),
        )


class ScenarioCreateRequest(BaseModel):
    model_config = _STRICT_INPUT

    name: str = Field(description="Nome do cenário (1 a 120 caracteres).")
    spec: ScenarioSpecPayload


class ScenarioUpdateRequest(BaseModel):
    """Só os campos enviados mudam."""

    model_config = _STRICT_INPUT

    name: str | None = None
    spec: ScenarioSpecPayload | None = None


class ScenarioSummaryResponse(BaseModel):
    id: str
    name: str
    author_user_id: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_scenario(cls, scenario: Scenario) -> ScenarioSummaryResponse:
        return cls(
            id=scenario.id,
            name=scenario.name,
            author_user_id=scenario.author_user_id,
            created_at=scenario.created_at,
            updated_at=scenario.updated_at,
        )


class ScenarioResponse(ScenarioSummaryResponse):
    spec: ScenarioSpecPayload

    @classmethod
    def from_scenario(cls, scenario: Scenario) -> ScenarioResponse:
        return cls(
            id=scenario.id,
            name=scenario.name,
            author_user_id=scenario.author_user_id,
            created_at=scenario.created_at,
            updated_at=scenario.updated_at,
            spec=ScenarioSpecPayload.from_domain(scenario.spec),
        )


class ScenarioListResponse(BaseModel):
    items: list[ScenarioSummaryResponse]
