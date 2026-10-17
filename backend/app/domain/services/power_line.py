"""Distância mínima de rede elétrica aérea (D4; TASK-107; ADR-051). Serviço puro, sem E/S.

A tabela é a de distância mínima de aproximação do ASME B30.5 (e do OSHA 29 CFR 1926.1408, tabela A,
na forma adotada pelo dono do produto; o ADR-051 registra que a conferência com o texto oficial
está pendente). A distância depende da tensão nominal, que o usuário escolhe no editor (entrada do
ambiente):

- até 50 kV: 10 pés (3,05 m);
- acima de 50 até 200 kV: 10 pés + 0,4 pol por kV acima de 50;
- acima de 200 até 350 kV: 15 pés (4,57 m);
- acima de 350 até 500 kV: 20 pés (6,10 m);
- acima de 500 até 750 kV: 25 pés (7,62 m);
- acima de 750 até 1000 kV: 35 pés (10,67 m).

Fora de 0–1000 kV não há valor na tabela: `required_clearance_m` recusa, em vez de adivinhar.
A NR-10 (instalações elétricas) e a NR-11 (movimentação de materiais) são o contexto normativo
brasileiro e não trazem uma tabela própria de distância de guindaste; o ADR-051 as cita, sem
substituir o valor.

A distância é a 3D, mínima, entre o cabo (reta horizontal a `height_m`) e cada parte do guindaste
que se mexe: a lança (pino→ponta), o cabo de aço (ponta→gancho) e a carga pendurada (cilindro com a
meia-diagonal da pegada). `line_clearance` repete a conta com o giro de 0° a 360° (a lança, o cabo
e a carga em QUALQUER posição do giro, com a lança e o cabo como estão).
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.domain.entities.scenario import (
    LABEL_MAX_LENGTH,
    POWER_LINE_MAX_KV,
    ObstacleKind,
    ObstacleSpec,
    PowerLineSpec,
)

FEET_M = 0.3048
INCH_M = 0.0254
BASE_CLEARANCE_M = 10 * FEET_M
"""10 pés: a distância até 50 kV e a base da faixa de 50 a 200 kV."""
PER_KV_ABOVE_50_M = 0.4 * INCH_M
LOW_BAND_KV = 50.0
MID_BAND_KV = 200.0
ATTENTION_FACTOR = 1.5
"""Abaixo de 1,5× a mínima o içamento é crítico (ADR-051) e o alerta pede atenção."""
SWEEP_STEP_DEG = 1.0

_STEPS: tuple[tuple[float, float], ...] = (
    (350.0, 15 * FEET_M),
    (500.0, 20 * FEET_M),
    (750.0, 25 * FEET_M),
    (POWER_LINE_MAX_KV, 35 * FEET_M),
)
"""(limite superior da faixa em kV, distância em m) acima de 200 kV."""


class InvalidVoltageError(ValueError):
    """Tensão fora da tabela (≤ 0, não finita ou acima de 1000 kV)."""


def required_clearance_m(voltage_kv: float) -> float:
    """Distância mínima (m) da rede de `voltage_kv` kV: a tabela do ASME B30.5."""
    if not math.isfinite(voltage_kv) or voltage_kv <= 0 or voltage_kv > POWER_LINE_MAX_KV:
        raise InvalidVoltageError(
            f"tensão de {voltage_kv!r} kV fora da tabela (0 a {POWER_LINE_MAX_KV:g} kV)"
        )
    if voltage_kv <= LOW_BAND_KV:
        return BASE_CLEARANCE_M
    if voltage_kv <= MID_BAND_KV:
        return BASE_CLEARANCE_M + (voltage_kv - LOW_BAND_KV) * PER_KV_ABOVE_50_M
    for upper, clearance in _STEPS:
        if voltage_kv <= upper:
            return clearance
    raise InvalidVoltageError(f"tensão de {voltage_kv!r} kV fora da tabela")  # pragma: no cover


type Point = tuple[float, float, float]


def _sub(a: Point, b: Point) -> Point:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a: Point, b: Point) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _clamp01(value: float) -> float:
    return min(max(value, 0.0), 1.0)


def segment_distance_m(p1: Point, q1: Point, p2: Point, q2: Point) -> float:
    """Menor distância 3D entre os segmentos p1→q1 e p2→q2 (Ericson, *Real-Time Collision
    Detection*, § 5.1.9)."""
    d1 = _sub(q1, p1)
    d2 = _sub(q2, p2)
    r = _sub(p1, p2)
    a = _dot(d1, d1)
    e = _dot(d2, d2)
    f = _dot(d2, r)
    eps = 1e-12
    if a <= eps and e <= eps:
        s = t = 0.0
    elif a <= eps:
        s = 0.0
        t = _clamp01(f / e)
    else:
        c = _dot(d1, r)
        if e <= eps:
            t = 0.0
            s = _clamp01(-c / a)
        else:
            b = _dot(d1, d2)
            denom = a * e - b * b
            s = _clamp01((b * f - c * e) / denom) if denom > eps else 0.0
            t = (b * s + f) / e
            if t < 0.0:
                t = 0.0
                s = _clamp01(-c / a)
            elif t > 1.0:
                t = 1.0
                s = _clamp01((b - c) / a)
    c1 = (p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s)
    c2 = (p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t)
    return math.dist(c1, c2)


class ClearanceStatus(StrEnum):
    OK = "OK"
    ATTENTION = "ATTENTION"
    VIOLATION = "VIOLATION"


@dataclass(frozen=True, slots=True)
class CraneParts:
    """O guindaste e a carga no mundo, no estado avaliado (m).

    `pivot`, `tip` e `hook` já com a posição e o giro do chassi. `load_radius_m` é a meia-diagonal
    da pegada da carga (0 sem carga); a carga pende do gancho: do `hook` para baixo `load_drop_m`
    até o topo, e tem `load_height_m` de altura (a base fica em `hook.y - load_drop_m -
    load_height_m`).
    """

    pivot: Point
    tip: Point
    hook: Point
    load_radius_m: float = 0.0
    load_drop_m: float = 0.0
    load_height_m: float = 0.0


@dataclass(frozen=True, slots=True)
class LineClearance:
    """Resultado de um trecho: a mínima exigida, a distância agora e a varrida pelo giro."""

    line_id: str
    label: str
    voltage_kv: float
    required_m: float
    distance_m: float
    swept_distance_m: float
    status: ClearanceStatus
    swept_status: ClearanceStatus
    nearest_part: str
    """`boom`, `cable` ou `load`: a parte do guindaste mais próxima do cabo agora."""


def classify(distance_m: float, required_m: float) -> ClearanceStatus:
    if distance_m < required_m:
        return ClearanceStatus.VIOLATION
    if distance_m < required_m * ATTENTION_FACTOR:
        return ClearanceStatus.ATTENTION
    return ClearanceStatus.OK


def _rotate_about(point: Point, center: tuple[float, float], angle_rad: float) -> Point:
    dx = point[0] - center[0]
    dz = point[2] - center[1]
    cos = math.cos(angle_rad)
    sin = math.sin(angle_rad)
    return (center[0] + dx * cos + dz * sin, point[1], center[1] - dx * sin + dz * cos)


def _part_distances(parts: CraneParts, a: Point, b: Point) -> dict[str, float]:
    distances = {
        "boom": segment_distance_m(parts.pivot, parts.tip, a, b),
        "cable": segment_distance_m(parts.tip, parts.hook, a, b),
    }
    if parts.load_radius_m > 0 and parts.load_height_m > 0:
        top = (parts.hook[0], parts.hook[1] - parts.load_drop_m, parts.hook[2])
        base = (top[0], top[1] - parts.load_height_m, top[2])
        distances["load"] = max(0.0, segment_distance_m(top, base, a, b) - parts.load_radius_m)
    return distances


def line_clearance(
    line: PowerLineSpec, parts: CraneParts, axis: tuple[float, float]
) -> LineClearance:
    """Distância do guindaste ao trecho `line`, agora e com o giro varrido de 0° a 360°.

    `axis` é o eixo de giro (x, z) do mundo, em torno do qual lança, cabo e carga giram.
    """
    required = required_clearance_m(line.voltage_kv)
    a: Point = (line.x1_m, line.height_m, line.z1_m)
    b: Point = (line.x2_m, line.height_m, line.z2_m)
    now = _part_distances(parts, a, b)
    nearest = min(now, key=lambda name: now[name])
    distance = now[nearest]
    swept = distance
    for i in range(1, round(360.0 / SWEEP_STEP_DEG)):
        angle = math.radians(i * SWEEP_STEP_DEG)
        rotated = CraneParts(
            pivot=_rotate_about(parts.pivot, axis, angle),
            tip=_rotate_about(parts.tip, axis, angle),
            hook=_rotate_about(parts.hook, axis, angle),
            load_radius_m=parts.load_radius_m,
            load_drop_m=parts.load_drop_m,
            load_height_m=parts.load_height_m,
        )
        swept = min(swept, *_part_distances(rotated, a, b).values())
    return LineClearance(
        line_id=line.id,
        label=line.label,
        voltage_kv=line.voltage_kv,
        required_m=required,
        distance_m=distance,
        swept_distance_m=swept,
        status=classify(distance, required),
        swept_status=classify(swept, required),
        nearest_part=nearest,
    )


def assess_power_lines(
    lines: Sequence[PowerLineSpec], parts: CraneParts, axis: tuple[float, float]
) -> tuple[LineClearance, ...]:
    """Um `LineClearance` por trecho, na ordem do cenário."""
    return tuple(line_clearance(line, parts, axis) for line in lines)


def power_line_zones(lines: Sequence[PowerLineSpec]) -> tuple[ObstacleSpec, ...]:
    """Cada trecho como um sólido elevado (zona) que o planejador trata como obstáculo (ADR-051).

    A zona é a caixa do trecho crescida da distância mínima `d` da tensão em todas as direções:
    `L + 2d` de comprimento, `2d` de largura e de altura, com a base a `altura − d` do chão. Como a
    varredura do planejador já engrossa lança, cabo e carga e confere o caminho inteiro (ADR-042),
    a regra de distância vale para a lança, o cabo e a carga em QUALQUER posição do plano. As
    pontas são em quina (um pouco mais conservadoras que a esfera exata). Os ids são `rede-N`.
    """
    zones: list[ObstacleSpec] = []
    for index, line in enumerate(lines):
        d = required_clearance_m(line.voltage_kv)
        dx = line.x2_m - line.x1_m
        dz = line.z2_m - line.z1_m
        length = math.hypot(dx, dz)
        base = max(0.0, line.height_m - d)
        zones.append(
            ObstacleSpec(
                id=f"rede-{index + 1}",
                label=f"Zona de distância mínima da rede ({line.label})"[:LABEL_MAX_LENGTH],
                kind=ObstacleKind.BOX,
                center_x=(line.x1_m + line.x2_m) / 2,
                center_z=(line.z1_m + line.z2_m) / 2,
                width_m=length + 2 * d,
                depth_m=2 * d,
                height_m=line.height_m + d - base,
                rotation_y_deg=math.degrees(math.atan2(-dz, dx)),
                elevation_m=base,
            )
        )
    return tuple(zones)
