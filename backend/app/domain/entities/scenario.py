"""Cenário: terreno editável, obstáculos e posição do guindaste (TASK-052; ADR-023).

Espelha o `ScenarioSpec` do frontend (`frontend/src/domain/environment/environment.ts`), com os
campos em `snake_case`. Eixos da cena (ADR-013): Y para cima; X e Z no chão. Unidades internas
(RN-006): metros e graus; inclinação do plano em % (subida em m a cada 100 m).

Regras (valores FICTÍCIOS e configuráveis até haver dado oficial):
- números finitos; inclinação do plano de -100 a 100 %;
- feição: `radius_m` > 0, `height_m` >= 0 (no `flatten`, `height_m` é o nível absoluto e pode ser
  negativo); `direction_deg` e `width_m` só na rampa (`width_m` > 0);
- obstáculo: dimensões > 0 (o cilindro usa `width_m` como diâmetro);
- zonas de solo (TASK-066): `radius_m` > 0, no máximo 200, ids únicos; vento: velocidade de 0 a 100
  m/s e direção finita (ambos opcionais no cenário);
- carga e ponto de entrega (TASK-073; ADR-035), ambos opcionais: posição e giro finitos; o ponto de
  entrega tem `radius_m` entre 0,5 e 30 m;
- no máximo 50 feições e 100 obstáculos; ids únicos dentro de cada lista;
- nome do cenário: 1 a 120 caracteres, sem espaços nas pontas.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from app.domain.exceptions.scenario_errors import InvalidScenarioError

SCENARIO_NAME_MAX_LENGTH = 120
SLOPE_PERCENT_LIMIT = 100.0
MAX_TERRAIN_FEATURES = 50
MAX_OBSTACLES = 100
MAX_SOIL_ZONES = 200
MAX_WIND_SPEED_MS = 100.0
DELIVERY_RADIUS_MIN_M = 0.5
DELIVERY_RADIUS_MAX_M = 30.0
ID_MAX_LENGTH = 64
LABEL_MAX_LENGTH = 120


class FeatureKind(StrEnum):
    MOUND = "mound"
    PIT = "pit"
    PLATEAU = "plateau"
    RAMP = "ramp"
    FLATTEN = "flatten"


class SoilKind(StrEnum):
    ROCK = "rock"
    COMPACTED = "compacted"
    CLAY = "clay"
    LOOSE_FILL = "loose_fill"


class ObstacleKind(StrEnum):
    BOX = "box"
    CYLINDER = "cylinder"


def _finite(path: str, value: float) -> None:
    if isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value):
        raise InvalidScenarioError(path, "o valor deve ser um número finito")


def _positive(path: str, value: float) -> None:
    _finite(path, value)
    if value <= 0:
        raise InvalidScenarioError(path, "o valor deve ser maior que zero")


def _text(path: str, value: str, max_length: int) -> None:
    if not isinstance(value, str) or not value.strip() or len(value) > max_length:
        raise InvalidScenarioError(path, f"o texto deve ter de 1 a {max_length} caracteres")


def _unique_ids(path: str, ids: list[str]) -> None:
    if len(set(ids)) != len(ids):
        raise InvalidScenarioError(path, "os ids devem ser únicos")


def normalize_scenario_name(raw: str) -> str:
    """Nome sem espaços nas pontas; vazio ou maior que o limite → `InvalidScenarioError`."""
    if not isinstance(raw, str) or not raw.strip() or len(raw.strip()) > SCENARIO_NAME_MAX_LENGTH:
        raise InvalidScenarioError(
            "name", f"o nome deve ter de 1 a {SCENARIO_NAME_MAX_LENGTH} caracteres"
        )
    return raw.strip()


@dataclass(frozen=True, slots=True)
class TerrainFeatureSpec:
    id: str
    kind: FeatureKind
    center_x: float
    center_z: float
    radius_m: float
    height_m: float
    direction_deg: float | None = None
    width_m: float | None = None

    def validate(self, path: str) -> None:
        _text(f"{path}.id", self.id, ID_MAX_LENGTH)
        if not isinstance(self.kind, FeatureKind):
            raise InvalidScenarioError(f"{path}.kind", "tipo de feição desconhecido")
        _finite(f"{path}.center_x", self.center_x)
        _finite(f"{path}.center_z", self.center_z)
        _positive(f"{path}.radius_m", self.radius_m)
        _finite(f"{path}.height_m", self.height_m)
        if self.height_m < 0 and self.kind is not FeatureKind.FLATTEN:
            raise InvalidScenarioError(f"{path}.height_m", "a altura não pode ser negativa")
        if self.direction_deg is not None:
            _finite(f"{path}.direction_deg", self.direction_deg)
        if self.width_m is not None:
            _positive(f"{path}.width_m", self.width_m)


@dataclass(frozen=True, slots=True)
class TerrainSpec:
    slope_x_percent: float = 0.0
    slope_z_percent: float = 0.0
    features: tuple[TerrainFeatureSpec, ...] = ()

    def validate(self, path: str) -> None:
        for name, value in (
            ("slope_x_percent", self.slope_x_percent),
            ("slope_z_percent", self.slope_z_percent),
        ):
            _finite(f"{path}.{name}", value)
            if abs(value) > SLOPE_PERCENT_LIMIT:
                raise InvalidScenarioError(
                    f"{path}.{name}",
                    f"a inclinação deve ficar entre -{SLOPE_PERCENT_LIMIT:g} e "
                    f"{SLOPE_PERCENT_LIMIT:g} %",
                )
        if len(self.features) > MAX_TERRAIN_FEATURES:
            raise InvalidScenarioError(
                f"{path}.features", f"no máximo {MAX_TERRAIN_FEATURES} feições"
            )
        _unique_ids(f"{path}.features", [feature.id for feature in self.features])
        for index, feature in enumerate(self.features):
            feature.validate(f"{path}.features[{index}]")


@dataclass(frozen=True, slots=True)
class ObstacleSpec:
    id: str
    label: str
    kind: ObstacleKind
    center_x: float
    center_z: float
    width_m: float
    depth_m: float
    height_m: float
    rotation_y_deg: float

    def validate(self, path: str) -> None:
        _text(f"{path}.id", self.id, ID_MAX_LENGTH)
        _text(f"{path}.label", self.label, LABEL_MAX_LENGTH)
        if not isinstance(self.kind, ObstacleKind):
            raise InvalidScenarioError(f"{path}.kind", "tipo de obstáculo desconhecido")
        _finite(f"{path}.center_x", self.center_x)
        _finite(f"{path}.center_z", self.center_z)
        _positive(f"{path}.width_m", self.width_m)
        _positive(f"{path}.depth_m", self.depth_m)
        _positive(f"{path}.height_m", self.height_m)
        _finite(f"{path}.rotation_y_deg", self.rotation_y_deg)


@dataclass(frozen=True, slots=True)
class SoilZoneSpec:
    """Círculo de solo pintado; a zona mais recente da lista vale onde houver sobreposição."""

    id: str
    kind: SoilKind
    center_x: float
    center_z: float
    radius_m: float

    def validate(self, path: str) -> None:
        _text(f"{path}.id", self.id, ID_MAX_LENGTH)
        if not isinstance(self.kind, SoilKind):
            raise InvalidScenarioError(f"{path}.kind", "tipo de solo desconhecido")
        _finite(f"{path}.center_x", self.center_x)
        _finite(f"{path}.center_z", self.center_z)
        _positive(f"{path}.radius_m", self.radius_m)


@dataclass(frozen=True, slots=True)
class WindSpec:
    """Vento: velocidade em m/s e direção para onde sopra (graus a partir de +X)."""

    speed_ms: float
    direction_deg: float

    def validate(self, path: str) -> None:
        _finite(f"{path}.speed_ms", self.speed_ms)
        if self.speed_ms < 0 or self.speed_ms > MAX_WIND_SPEED_MS:
            raise InvalidScenarioError(
                f"{path}.speed_ms", f"a velocidade deve ficar entre 0 e {MAX_WIND_SPEED_MS:g} m/s"
            )
        _finite(f"{path}.direction_deg", self.direction_deg)


@dataclass(frozen=True, slots=True)
class CranePlacementSpec:
    x: float = 0.0
    z: float = 0.0
    heading_deg: float = 0.0

    def validate(self, path: str) -> None:
        _finite(f"{path}.x", self.x)
        _finite(f"{path}.z", self.z)
        _finite(f"{path}.heading_deg", self.heading_deg)


@dataclass(frozen=True, slots=True)
class CargoPlacementSpec:
    """Posição inicial da carga no chão: centro em (x, z) e giro em torno de Y."""

    x: float
    z: float
    rotation_y_deg: float

    def validate(self, path: str) -> None:
        _finite(f"{path}.x", self.x)
        _finite(f"{path}.z", self.z)
        _finite(f"{path}.rotation_y_deg", self.rotation_y_deg)


@dataclass(frozen=True, slots=True)
class DeliveryPointSpec:
    """Ponto de entrega: alvo no chão com raio de tolerância."""

    x: float
    z: float
    rotation_y_deg: float
    radius_m: float

    def validate(self, path: str) -> None:
        _finite(f"{path}.x", self.x)
        _finite(f"{path}.z", self.z)
        _finite(f"{path}.rotation_y_deg", self.rotation_y_deg)
        _finite(f"{path}.radius_m", self.radius_m)
        if not DELIVERY_RADIUS_MIN_M <= self.radius_m <= DELIVERY_RADIUS_MAX_M:
            raise InvalidScenarioError(
                f"{path}.radius_m",
                f"o raio deve ficar entre {DELIVERY_RADIUS_MIN_M:g} e {DELIVERY_RADIUS_MAX_M:g} m",
            )


@dataclass(frozen=True, slots=True)
class ScenarioSpec:
    terrain: TerrainSpec = field(default_factory=TerrainSpec)
    obstacles: tuple[ObstacleSpec, ...] = ()
    crane: CranePlacementSpec = field(default_factory=CranePlacementSpec)
    soil_zones: tuple[SoilZoneSpec, ...] = ()
    wind: WindSpec | None = None
    cargo: CargoPlacementSpec | None = None
    delivery: DeliveryPointSpec | None = None

    def __post_init__(self) -> None:
        self.terrain.validate("spec.terrain")
        if len(self.obstacles) > MAX_OBSTACLES:
            raise InvalidScenarioError("spec.obstacles", f"no máximo {MAX_OBSTACLES} obstáculos")
        _unique_ids("spec.obstacles", [obstacle.id for obstacle in self.obstacles])
        for index, obstacle in enumerate(self.obstacles):
            obstacle.validate(f"spec.obstacles[{index}]")
        self.crane.validate("spec.crane")
        if len(self.soil_zones) > MAX_SOIL_ZONES:
            raise InvalidScenarioError(
                "spec.soil_zones", f"no máximo {MAX_SOIL_ZONES} zonas de solo"
            )
        _unique_ids("spec.soil_zones", [zone.id for zone in self.soil_zones])
        for index, zone in enumerate(self.soil_zones):
            zone.validate(f"spec.soil_zones[{index}]")
        if self.wind is not None:
            self.wind.validate("spec.wind")
        if self.cargo is not None:
            self.cargo.validate("spec.cargo")
        if self.delivery is not None:
            self.delivery.validate("spec.delivery")


@dataclass(frozen=True, slots=True)
class Scenario:
    """Cenário salvo. O autor é o dono: só ele ou um admin edita e apaga (ADR-016, ADR-023)."""

    id: str
    name: str
    author_user_id: str
    created_at: datetime
    updated_at: datetime
    spec: ScenarioSpec

    def __post_init__(self) -> None:
        if not isinstance(self.id, str) or not self.id.strip():
            raise ValueError("o id do cenário deve ser informado")
        if normalize_scenario_name(self.name) != self.name:
            raise InvalidScenarioError("name", "o nome não pode ter espaços nas pontas")
        if not isinstance(self.author_user_id, str) or not self.author_user_id.strip():
            raise ValueError("o autor do cenário deve ser informado")
        if self.created_at.tzinfo is None or self.updated_at.tzinfo is None:
            raise ValueError("as datas do cenário devem ter fuso horário")
        if self.updated_at < self.created_at:
            raise ValueError("a atualização não pode ser anterior à criação")


def scenario_spec_to_dict(spec: ScenarioSpec) -> dict[str, object]:
    """`spec` como JSON (`snake_case`), na forma gravada no banco e devolvida pela API."""
    data: dict[str, object] = {
        "terrain": {
            "slope_x_percent": spec.terrain.slope_x_percent,
            "slope_z_percent": spec.terrain.slope_z_percent,
            "features": [
                {
                    "id": f.id,
                    "kind": f.kind.value,
                    "center_x": f.center_x,
                    "center_z": f.center_z,
                    "radius_m": f.radius_m,
                    "height_m": f.height_m,
                    **({} if f.direction_deg is None else {"direction_deg": f.direction_deg}),
                    **({} if f.width_m is None else {"width_m": f.width_m}),
                }
                for f in spec.terrain.features
            ],
        },
        "obstacles": [
            {
                "id": o.id,
                "label": o.label,
                "kind": o.kind.value,
                "center_x": o.center_x,
                "center_z": o.center_z,
                "width_m": o.width_m,
                "depth_m": o.depth_m,
                "height_m": o.height_m,
                "rotation_y_deg": o.rotation_y_deg,
            }
            for o in spec.obstacles
        ],
        "crane": {"x": spec.crane.x, "z": spec.crane.z, "heading_deg": spec.crane.heading_deg},
    }
    # Campos opcionais da TASK-066: só entram no JSON quando existem (cenários antigos não mudam).
    if spec.soil_zones:
        data["soil_zones"] = [
            {
                "id": z.id,
                "kind": z.kind.value,
                "center_x": z.center_x,
                "center_z": z.center_z,
                "radius_m": z.radius_m,
            }
            for z in spec.soil_zones
        ]
    if spec.wind is not None:
        data["wind"] = {"speed_ms": spec.wind.speed_ms, "direction_deg": spec.wind.direction_deg}
    # Campos opcionais da TASK-073: só entram no JSON quando existem.
    if spec.cargo is not None:
        data["cargo"] = {
            "x": spec.cargo.x,
            "z": spec.cargo.z,
            "rotation_y_deg": spec.cargo.rotation_y_deg,
        }
    if spec.delivery is not None:
        data["delivery"] = {
            "x": spec.delivery.x,
            "z": spec.delivery.z,
            "rotation_y_deg": spec.delivery.rotation_y_deg,
            "radius_m": spec.delivery.radius_m,
        }
    return data


def scenario_spec_from_dict(data: Mapping[str, Any]) -> ScenarioSpec:
    """Lê o JSON gravado (já validado na entrada); chaves ausentes levantam `KeyError`."""
    terrain = data["terrain"]
    crane = data["crane"]

    def optional(raw: Mapping[str, Any], key: str) -> float | None:
        return None if raw.get(key) is None else float(raw[key])

    return ScenarioSpec(
        terrain=TerrainSpec(
            slope_x_percent=float(terrain["slope_x_percent"]),
            slope_z_percent=float(terrain["slope_z_percent"]),
            features=tuple(
                TerrainFeatureSpec(
                    id=str(f["id"]),
                    kind=FeatureKind(f["kind"]),
                    center_x=float(f["center_x"]),
                    center_z=float(f["center_z"]),
                    radius_m=float(f["radius_m"]),
                    height_m=float(f["height_m"]),
                    direction_deg=optional(f, "direction_deg"),
                    width_m=optional(f, "width_m"),
                )
                for f in terrain["features"]
            ),
        ),
        obstacles=tuple(
            ObstacleSpec(
                id=str(o["id"]),
                label=str(o["label"]),
                kind=ObstacleKind(o["kind"]),
                center_x=float(o["center_x"]),
                center_z=float(o["center_z"]),
                width_m=float(o["width_m"]),
                depth_m=float(o["depth_m"]),
                height_m=float(o["height_m"]),
                rotation_y_deg=float(o["rotation_y_deg"]),
            )
            for o in data["obstacles"]
        ),
        crane=CranePlacementSpec(
            x=float(crane["x"]), z=float(crane["z"]), heading_deg=float(crane["heading_deg"])
        ),
        soil_zones=tuple(
            SoilZoneSpec(
                id=str(z["id"]),
                kind=SoilKind(z["kind"]),
                center_x=float(z["center_x"]),
                center_z=float(z["center_z"]),
                radius_m=float(z["radius_m"]),
            )
            for z in data.get("soil_zones") or []
        ),
        wind=(
            None
            if data.get("wind") is None
            else WindSpec(
                speed_ms=float(data["wind"]["speed_ms"]),
                direction_deg=float(data["wind"]["direction_deg"]),
            )
        ),
        cargo=(
            None
            if data.get("cargo") is None
            else CargoPlacementSpec(
                x=float(data["cargo"]["x"]),
                z=float(data["cargo"]["z"]),
                rotation_y_deg=float(data["cargo"]["rotation_y_deg"]),
            )
        ),
        delivery=(
            None
            if data.get("delivery") is None
            else DeliveryPointSpec(
                x=float(data["delivery"]["x"]),
                z=float(data["delivery"]["z"]),
                rotation_y_deg=float(data["delivery"]["rotation_y_deg"]),
                radius_m=float(data["delivery"]["radius_m"]),
            )
        ),
    )
