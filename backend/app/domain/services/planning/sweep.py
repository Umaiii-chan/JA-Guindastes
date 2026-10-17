"""Conferência contínua do caminho do plano (TASK-088; ADR-042).

A trajetória tem poucos quadros-chave (o giro tem 12 trechos) e a cena interpola entre eles. Aqui o
caminho inteiro é conferido, não só os quadros-chave:

- **Giro em grade densa.** As amostras ficam a no máximo `SWEEP_STEP_M` uma da outra no maior
  raio. Entre duas amostras nenhum ponto do caminho fica a mais de meio passo da mais próxima, então
  cada distância conferida ganha esse meio passo e um obstáculo fino entre amostras não escapa. A
  distância a uma forma muda no máximo um passo por amostra, então a busca pula as amostras que
  certamente estão longe e o custo cresce pouco com a densidade.
- **Carga, cabo e lança.** Em cada amostra entram a carga (o círculo que a envolve em qualquer
  giro), o cabo com o gancho e as lingas (linha vertical da ponta ao topo da carga) e a lança
  (segmento do pino à ponta, engrossado da meia-seção FICTÍCIA).
- **Fases verticais e pose de partida.** Aproximar (da pose de partida até acima da carga),
  engatar, levantar e baixar: a lança e o cabo nas poses de coleta e de entrega, e a pegada da carga
  na coleta e na entrega contra os obstáculos.
- **Coleta e entrega.** A carga na coleta não pode ficar sob nem dentro de um obstáculo (o gancho
  não chega a ela por cima). Na entrega, só o veículo-plataforma (carreta; a mesma regra do layout
  da IA, TASK-081) recebe a carga por cima, e ela é apoiada no topo dele; outro obstáculo sob a
  pegada recusa a entrega.

Obstáculos são prismas verticais (caixa girada ou cilindro) da altura do terreno no centro até o
topo, como no resto do planejamento. Medidas FICTÍCIAS (ADR-012).
"""

import math
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass

from app.domain.entities.scenario import (
    CranePlacementSpec,
    FeatureKind,
    ObstacleKind,
    ObstacleSpec,
    ScenarioSpec,
    TerrainFeatureSpec,
    TerrainSpec,
)
from app.domain.services.planning.crane_body import distance_to_crane_body_m
from app.domain.services.planning.library_boxes import (
    bed_contains,
    expand_obstacles,
    is_platform_truck,
    platform_truck_bed_ratio,
    platform_truck_cab_parts,
)
from app.domain.services.planning.models import CraneStateValues, PlanLoad, PlanPoint
from app.domain.services.planning.scene import (
    direction,
    distance_to_obstacle_m,
    obstacle_circumradius_m,
    obstacle_top_y,
)
from app.domain.services.planning.terrain import (
    cargo_base_y,
    feature_distance_m,
    feature_peak_near,
    terrain_height_at,
    terrain_peak_near,
    terrain_plane_peak_near,
)
from app.domain.value_objects.crane_geometry import CraneGeometry

SWEEP_STEP_M = 0.25
"""Maior distância (m) entre duas amostras do giro, medida no maior raio."""
MAX_SWEEP_SEGMENTS = 1440
"""Teto de desempenho da grade do giro. Acima dele o passo cresce, e a margem de meio passo cresce
junto: a conferência fica mais conservadora, nunca deixa de ver um obstáculo."""
BOOM_HALF_SECTION_M = 0.6
"""Meia-seção da lança (m), FICTÍCIA (ADR-012): raio do tubo que envolve a lança do pino à ponta.
Não vem do modelo 3D nem da ficha técnica; com a ficha oficial, passa a vir dela."""
HOOK_HALF_WIDTH_M = 0.3
"""Meia-largura (m), FICTÍCIA, do cabo com o gancho e as lingas, da ponta da lança ao topo da
carga."""
CROSSING_MARGIN_M = 0.15
"""Folga (m) a mais na escolha dos obstáculos que a carga cruza. A cena interpola θ entre os
quadros-chave, e o raio dela se afasta da reta amostrada aqui em até L·Δθ²/8 (alguns centímetros);
a conferência da opção (`first_path_collision`) refaz a conta no movimento interpolado."""
APPROACH_MAX_SAMPLES = 120
"""Teto de amostras da aproximação (da pose de partida até acima da carga)."""

COLLISION_LOAD = "colisao_carga"
COLLISION_CABLE = "colisao_cabo"
COLLISION_BOOM = "colisao_lanca"
COLLISION_APPROACH = "colisao_aproximacao"

_EPS = 1e-9


# ---- giro em grade densa -------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class SwingArc:
    """Caminho horizontal do gancho no giro: azimute e raio variam em linha reta com `t`, de
    (`start_azimuth_deg`, `start_radius_m`) a (`start_azimuth_deg + sign·arc_deg`, `end_radius_m`),
    amostrado em `segments` trechos (múltiplo dos trechos da trajetória)."""

    center_x: float
    center_z: float
    start_azimuth_deg: float
    sign: int
    arc_deg: float
    start_radius_m: float
    end_radius_m: float
    segments: int

    def point(self, k: int) -> tuple[float, float]:
        t = k / self.segments
        radius = self.start_radius_m + (self.end_radius_m - self.start_radius_m) * t
        dx, dz = direction(self.start_azimuth_deg + self.sign * self.arc_deg * t)
        return self.center_x + radius * dx, self.center_z + radius * dz

    @property
    def max_radius_m(self) -> float:
        return max(self.start_radius_m, self.end_radius_m)

    @property
    def step_m(self) -> float:
        """Maior comprimento do caminho entre duas amostras seguidas (m)."""
        along = math.radians(self.arc_deg) * self.max_radius_m
        return math.hypot(along, self.end_radius_m - self.start_radius_m) / self.segments


def swing_arc(
    *,
    center_x: float,
    center_z: float,
    start_azimuth_deg: float,
    sign: int,
    arc_deg: float,
    start_radius_m: float,
    end_radius_m: float,
    path_segments: int,
) -> SwingArc:
    """O giro com a grade mais fina que respeita `SWEEP_STEP_M` e o teto de desempenho."""
    length = math.hypot(
        math.radians(arc_deg) * max(start_radius_m, end_radius_m), end_radius_m - start_radius_m
    )
    per_segment = max(1, math.ceil(length / SWEEP_STEP_M / path_segments))
    per_segment = min(per_segment, max(1, MAX_SWEEP_SEGMENTS // path_segments))
    return SwingArc(
        center_x,
        center_z,
        start_azimuth_deg,
        sign,
        arc_deg,
        start_radius_m,
        end_radius_m,
        path_segments * per_segment,
    )


def samples_within(
    arc: SwingArc, distance: Callable[[float, float], float], threshold: float
) -> Iterator[int]:
    """Índices das amostras a até `threshold` de uma forma, dada a distância (no plano) a ela.

    A distância a uma forma muda no máximo o quanto o ponto andou, e entre amostras o ponto anda no
    máximo `step_m`: longe da forma, dá para pular as amostras que certamente ficam fora."""
    step = arc.step_m
    k = 0
    while k <= arc.segments:
        x, z = arc.point(k)
        gap = distance(x, z) - threshold
        if gap <= 0:
            yield k
            k += 1
        elif step <= _EPS:
            return
        else:
            k += max(1, int(gap / step))


def crossing_threshold_m(arc: SwingArc, radius_load_m: float) -> float:
    """Distância até a qual um obstáculo conta como cruzado pela carga neste giro."""
    return radius_load_m + arc.step_m / 2 + CROSSING_MARGIN_M


def load_crossings(
    arc: SwingArc, obstacles: Sequence[ObstacleSpec], radius_load_m: float
) -> tuple[ObstacleSpec, ...]:
    """Obstáculos que a carga encosta em algum ponto do giro (no plano), na ordem da lista."""
    threshold = crossing_threshold_m(arc, radius_load_m)
    crossed: list[ObstacleSpec] = []
    for obstacle in obstacles:

        def distance(x: float, z: float, item: ObstacleSpec = obstacle) -> float:
            return distance_to_obstacle_m(item, x, z)

        if next(samples_within(arc, distance, threshold), None) is not None:
            crossed.append(obstacle)
    return tuple(crossed)


def body_crossed(arc: SwingArc, placement: CranePlacementSpec, radius_load_m: float) -> bool:
    """A carga passa sobre o corpo do próprio guindaste em algum ponto do giro?"""

    def distance(x: float, z: float) -> float:
        return distance_to_crane_body_m(placement, x, z)

    threshold = crossing_threshold_m(arc, radius_load_m)
    return next(samples_within(arc, distance, threshold), None) is not None


def terrain_peak_along(arc: SwingArc, terrain: TerrainSpec, radius_load_m: float) -> float:
    """Limite superior (m) da altura do terreno sob a carga em todo o giro (ver
    `terrain_peak_near`), amostra a amostra."""
    radius = radius_load_m + arc.step_m / 2
    sloped = terrain.slope_x_percent != 0 or terrain.slope_z_percent != 0
    if not sloped and not terrain.features:
        return 0.0
    plane: list[float] | None = None
    peak = 0.0
    if sloped:
        plane = [
            terrain_plane_peak_near(terrain, *arc.point(k), radius) for k in range(arc.segments + 1)
        ]
        peak = max(plane)
    added: dict[int, float] = {}
    levels: dict[int, float] = {}
    for feature in terrain.features:
        if feature.kind is FeatureKind.PIT:
            continue

        def distance(x: float, z: float, item: TerrainFeatureSpec = feature) -> float:
            return feature_distance_m(item, x, z)

        for k in samples_within(arc, distance, radius):
            if feature.kind is FeatureKind.FLATTEN:
                levels[k] = max(levels.get(k, -math.inf), feature.height_m)
            else:
                added[k] = added.get(k, 0.0) + feature_peak_near(feature, *arc.point(k), radius)
    for k in added.keys() | levels.keys():
        base = 0.0 if plane is None else plane[k]
        peak = max(peak, max(base, levels.get(k, -math.inf)) + added.get(k, 0.0))
    return peak


# ---- pegada da carga na coleta e na entrega ------------------------------------------------------


def _axes(rotation_y_deg: float) -> tuple[tuple[float, float], tuple[float, float]]:
    """Eixos X e Z locais no mundo, para um giro em torno de Y (convenção do editor 3D)."""
    angle = math.radians(rotation_y_deg)
    cos = math.cos(angle)
    sin = math.sin(angle)
    return (cos, -sin), (sin, cos)


def footprint_overlaps_obstacle(
    obstacle: ObstacleSpec,
    center_x: float,
    center_z: float,
    half_x_m: float,
    half_z_m: float,
    rotation_y_deg: float,
) -> bool:
    """O retângulo (meias medidas em X e Z locais, girado) invade o obstáculo no plano? Encostar
    na borda não conta."""
    ax, az = _axes(rotation_y_deg)
    dx = obstacle.center_x - center_x
    dz = obstacle.center_z - center_z
    if obstacle.kind is ObstacleKind.CYLINDER:
        local_x = dx * ax[0] + dz * ax[1]
        local_z = dx * az[0] + dz * az[1]
        outside = math.hypot(max(0.0, abs(local_x) - half_x_m), max(0.0, abs(local_z) - half_z_m))
        return outside < obstacle.width_m / 2 - _EPS
    bx, bz = _axes(obstacle.rotation_y_deg)
    half_w = obstacle.width_m / 2
    half_d = obstacle.depth_m / 2
    for nx, nz in (ax, az, bx, bz):
        reach_a = half_x_m * abs(nx * ax[0] + nz * ax[1]) + half_z_m * abs(nx * az[0] + nz * az[1])
        reach_b = half_w * abs(nx * bx[0] + nz * bx[1]) + half_d * abs(nx * bz[0] + nz * bz[1])
        if abs(nx * dx + nz * dz) >= reach_a + reach_b - _EPS:
            return False
    return True


def _under_footprint(
    scenario: ScenarioSpec, load: PlanLoad, x: float, z: float, rotation_y_deg: float
) -> list[ObstacleSpec]:
    return [
        obstacle
        for obstacle in expand_obstacles(scenario)
        if footprint_overlaps_obstacle(
            obstacle, x, z, load.width_m / 2, load.length_m / 2, rotation_y_deg
        )
    ]


def _in_height_range(terrain: TerrainSpec, obstacle: ObstacleSpec, low: float, high: float) -> bool:
    """O obstáculo ocupa alguma altura de [low, high]? Só as partes de objetos ocos (com
    `elevation_m`) têm vão por baixo; o obstáculo inteiro vale do terreno ao topo."""
    if obstacle.elevation_m is None:
        return True
    top = obstacle_top_y(terrain, obstacle)
    return top > low + 1e-6 and top - obstacle.height_m < high - 1e-6


@dataclass(frozen=True, slots=True)
class DeliverySurface:
    """Onde a carga pousa na entrega."""

    rest_y: float
    """Altura (m) da base da carga apoiada: o terreno sob a pegada ou o topo da carreta."""
    supports: tuple[ObstacleSpec, ...]
    """Veículos-plataforma sob a pegada, que recebem a carga por cima."""
    blockers: tuple[ObstacleSpec, ...]
    """Outros obstáculos sob a pegada, acima de onde ela pousaria: a entrega não é possível."""


def _supports_load(obstacle: ObstacleSpec, x: float, z: float) -> bool:
    """O obstáculo recebe por cima a carga centrada em (x, z)? Só o caminhão plataforma da
    biblioteca (a cena só tem carroceria nele, `loadBedsOf`), e só se o centro da pegada cai dentro
    da carroceria (o mesmo critério da cena, `loadBeds.ts`); senão a carga fica no terreno e o
    caminhão, como qualquer outro obstáculo, é colisão. Uma caixa "carreta" não recebe a carga."""
    return is_platform_truck(obstacle) and bed_contains(obstacle, x, z)


def support_top_y(terrain: TerrainSpec, obstacle: ObstacleSpec) -> float:
    """Altura (m) em que a carga repousa sobre o caminhão plataforma: o topo da carroceria
    (`loadBed` do frontend: 0,53 da altura), não o da caixa inteira (cabine)."""
    top = obstacle_top_y(terrain, obstacle)
    return top - obstacle.height_m * (1.0 - platform_truck_bed_ratio())


def _surface(
    scenario: ScenarioSpec,
    load: PlanLoad,
    x: float,
    z: float,
    rotation_y_deg: float,
    *,
    low_obstacles_block: bool,
) -> DeliverySurface:
    under = _under_footprint(scenario, load, x, z, rotation_y_deg)
    rest = cargo_base_y(scenario.terrain, load.length_m, load.width_m, x, z, rotation_y_deg)
    supports = tuple(obstacle for obstacle in under if _supports_load(obstacle, x, z))
    if supports:
        rest = max(rest, max(support_top_y(scenario.terrain, item) for item in supports))
    blockers = [
        obstacle
        for obstacle in under
        if obstacle not in supports
        and (low_obstacles_block or obstacle_top_y(scenario.terrain, obstacle) > rest + 1e-6)
        and _in_height_range(scenario.terrain, obstacle, rest, rest + load.height_m)
    ]
    # Apoiada na carroceria, a carga não pode invadir os trechos mais altos do caminhão (a cabine).
    for truck in supports:
        blockers.extend(
            part
            for part in platform_truck_cab_parts(truck, scenario.terrain)
            if footprint_overlaps_obstacle(
                part, x, z, load.width_m / 2, load.length_m / 2, rotation_y_deg
            )
            and obstacle_top_y(scenario.terrain, part) > rest + 1e-6
        )
    return DeliverySurface(rest, supports, tuple(blockers))


def delivery_surface(
    scenario: ScenarioSpec, load: PlanLoad, x: float, z: float, rotation_y_deg: float
) -> DeliverySurface:
    """Superfície da entrega com a carga centrada em (x, z) e girada de `rotation_y_deg`: onde ela
    repousa (o terreno ou a carroceria do caminhão plataforma) e o que a impede."""
    return _surface(scenario, load, x, z, rotation_y_deg, low_obstacles_block=False)


def pick_surface(scenario: ScenarioSpec, load: PlanLoad, cargo: PlanPoint) -> DeliverySurface:
    """Superfície da coleta: a cena assenta a carga no terreno ou sobre a carroceria (mesmo apoio
    da entrega), então qualquer outro obstáculo na pegada a cobre (`blockers`): o gancho não a
    alcança por cima."""
    return _surface(
        scenario, load, cargo.x, cargo.z, cargo.rotation_y_deg, low_obstacles_block=True
    )


def pick_cover(
    scenario: ScenarioSpec, load: PlanLoad, cargo: PlanPoint
) -> tuple[ObstacleSpec, ...]:
    """Obstáculos sobre a carga na coleta (ou que a contêm)."""
    return pick_surface(scenario, load, cargo).blockers


def delivery_cover(
    scenario: ScenarioSpec, load: PlanLoad, center: PlanPoint
) -> tuple[ObstacleSpec, ...]:
    """Obstáculos que impedem a entrega em qualquer giro da carga: o centro da entrega fica dentro
    deles, eles não são a carreta e passam de qualquer altura em que a carga poderia pousar ali."""
    radius = math.hypot(load.length_m, load.width_m) / 2
    rest_limit = terrain_peak_near(scenario.terrain, center.x, center.z, radius)
    obstacles = expand_obstacles(scenario)
    ground = terrain_height_at(scenario.terrain, center.x, center.z)
    for obstacle in obstacles:
        if (
            _supports_load(obstacle, center.x, center.z)
            and distance_to_obstacle_m(obstacle, center.x, center.z) <= radius
        ):
            rest_limit = max(rest_limit, support_top_y(scenario.terrain, obstacle))
    return tuple(
        obstacle
        for obstacle in obstacles
        if not _supports_load(obstacle, center.x, center.z)
        and (
            obstacle.elevation_m is None
            or obstacle_top_y(scenario.terrain, obstacle) - obstacle.height_m <= ground + 1e-6
        )
        and distance_to_obstacle_m(obstacle, center.x, center.z) == 0.0
        and obstacle_top_y(scenario.terrain, obstacle) > rest_limit + 1e-6
    )


# ---- lança, cabo e carga contra os obstáculos ----------------------------------------------------


@dataclass(frozen=True, slots=True)
class Solid:
    """Obstáculo como prisma vertical: da altura do terreno no centro até o topo."""

    spec: ObstacleSpec
    base_y: float
    top_y: float
    radius_m: float
    """Raio do círculo, centrado no obstáculo, que o envolve no plano."""


def solids_of(scenario: ScenarioSpec) -> tuple[Solid, ...]:
    solids: list[Solid] = []
    for obstacle in expand_obstacles(scenario):
        top = obstacle_top_y(scenario.terrain, obstacle)
        solids.append(
            Solid(obstacle, top - obstacle.height_m, top, obstacle_circumradius_m(obstacle))
        )
    return tuple(solids)


def _clip(
    start: float, end: float, low: float, high: float, t_low: float, t_high: float
) -> tuple[float, float]:
    """Trecho de [t_low, t_high] em que `start + t·(end − start)` fica em [low, high]."""
    delta = end - start
    if abs(delta) < _EPS:
        return (t_low, t_high) if low <= start <= high else (1.0, 0.0)
    t0 = (low - start) / delta
    t1 = (high - start) / delta
    if t0 > t1:
        t0, t1 = t1, t0
    return max(t_low, t0), min(t_high, t1)


Point3 = tuple[float, float, float]


def segment_hits_solid(solid: Solid, p0: Point3, p1: Point3, radius_m: float) -> bool:
    """O segmento p0→p1 (x, y, z), engrossado de `radius_m`, encosta no obstáculo? O obstáculo é
    crescido de `radius_m` em todas as direções (cantos em quina: um pouco conservador)."""
    t_low, t_high = _clip(p0[1], p1[1], solid.base_y - radius_m, solid.top_y + radius_m, 0.0, 1.0)
    if t_low > t_high:
        return False
    obstacle = solid.spec
    ax = p0[0] - obstacle.center_x
    az = p0[2] - obstacle.center_z
    bx = p1[0] - obstacle.center_x
    bz = p1[2] - obstacle.center_z
    if obstacle.kind is ObstacleKind.CYLINDER:
        reach = obstacle.width_m / 2 + radius_m
        ex = bx - ax
        ez = bz - az
        a = ex * ex + ez * ez
        c = ax * ax + az * az - reach * reach
        if a < _EPS:
            return c <= 0
        b = ax * ex + az * ez
        discriminant = b * b - a * c
        if discriminant < 0:
            return False
        root = math.sqrt(discriminant)
        return max(t_low, (-b - root) / a) <= min(t_high, (-b + root) / a)
    angle = math.radians(obstacle.rotation_y_deg)
    cos = math.cos(angle)
    sin = math.sin(angle)
    half_w = obstacle.width_m / 2 + radius_m
    half_d = obstacle.depth_m / 2 + radius_m
    t_low, t_high = _clip(ax * cos - az * sin, bx * cos - bz * sin, -half_w, half_w, t_low, t_high)
    if t_low > t_high:
        return False
    t_low, t_high = _clip(ax * sin + az * cos, bx * sin + bz * cos, -half_d, half_d, t_low, t_high)
    return t_low <= t_high


def _point_segment_distance(
    x: float, z: float, ax: float, az: float, bx: float, bz: float
) -> float:
    ex = bx - ax
    ez = bz - az
    length2 = ex * ex + ez * ez
    t = 0.0 if length2 < _EPS else max(0.0, min(1.0, ((x - ax) * ex + (z - az) * ez) / length2))
    return math.hypot(x - ax - t * ex, z - az - t * ez)


@dataclass(frozen=True, slots=True)
class Rig:
    """Onde o guindaste está e o que pende do gancho, para conferir as poses."""

    geometry: CraneGeometry
    placement: CranePlacementSpec
    ground_y: float
    """Plano de apoio do guindaste (m): o pino fica `boom_pivot_height` acima dele."""
    load_radius_m: float
    load_height_m: float
    rigging_m: float
    """Do gancho ao topo da carga pendurada (amarração, acessórios e lingas)."""
    hook_drop_m: float
    """Do gancho ao fim da cadeia, sem carga (amarração e acessórios)."""


def _pose(
    rig: Rig, length_m: float, angle_deg: float, psi_deg: float
) -> tuple[float, float, float, float, float, float]:
    """Pino (x, y, z) e ponta (x, y, z) da lança no mundo (ADR-013: R = a + L·cos θ)."""
    geometry = rig.geometry
    ux, uz = direction(rig.placement.heading_deg + psi_deg)
    theta = math.radians(angle_deg)
    pivot = geometry.boom_pivot_offset_m
    reach = pivot + length_m * math.cos(theta)
    pivot_y = rig.ground_y + geometry.boom_pivot_height.meters
    x0 = rig.placement.x
    z0 = rig.placement.z
    return (
        x0 + pivot * ux,
        pivot_y,
        z0 + pivot * uz,
        x0 + reach * ux,
        pivot_y + length_m * math.sin(theta),
        z0 + reach * uz,
    )


def _boom_or_line_hit(
    solid: Solid,
    pose: tuple[float, float, float, float, float, float],
    line_bottom_y: float,
    margin_m: float,
    check_cable: bool = True,
) -> str | None:
    px, py, pz, tx, ty, tz = pose
    if check_cable and segment_hits_solid(
        solid, (tx, ty, tz), (tx, line_bottom_y, tz), HOOK_HALF_WIDTH_M + margin_m
    ):
        return COLLISION_CABLE
    if segment_hits_solid(solid, (px, py, pz), (tx, ty, tz), BOOM_HALF_SECTION_M + margin_m):
        return COLLISION_BOOM
    return None


def _lerp(a: CraneStateValues, b: CraneStateValues, f: float) -> tuple[float, float, float, float]:
    return (
        a.boom_length_m + (b.boom_length_m - a.boom_length_m) * f,
        a.boom_angle_deg + (b.boom_angle_deg - a.boom_angle_deg) * f,
        a.turret_rotation_deg + (b.turret_rotation_deg - a.turret_rotation_deg) * f,
        a.cable_length_m + (b.cable_length_m - a.cable_length_m) * f,
    )


def _swing_collision(
    rig: Rig, solids: Sequence[Solid], arc: SwingArc, path: Sequence[CraneStateValues]
) -> str | None:
    """Confere o giro como a cena o executa: interpolando L, θ, ψ e c entre os quadros-chave."""
    keys = len(path) - 1
    if keys < 1:
        return None
    n = arc.segments
    per_key = max(1, n // keys)
    n = per_key * keys
    longest = max(state.boom_length_m for state in path)
    dtheta = max(
        abs(math.radians(path[j + 1].boom_angle_deg - path[j].boom_angle_deg)) for j in range(keys)
    )
    # Quanto qualquer ponto da lança, do cabo ou da carga anda entre duas amostras (para cima).
    move = math.radians(arc.arc_deg) * arc.max_radius_m / n + 2 * longest * dtheta / per_key
    half = move / 2
    reach_load = rig.load_radius_m + half
    reach = max(reach_load, BOOM_HALF_SECTION_M + half, HOOK_HALF_WIDTH_M + half)

    def sample(k: int) -> tuple[float, float, float, float]:
        j = min(k // per_key, keys - 1)
        return _lerp(path[j], path[j + 1], (k - j * per_key) / per_key)

    for solid in solids:
        cx = solid.spec.center_x
        cz = solid.spec.center_z
        k = 0
        while k <= n:
            length, angle, psi, cable = sample(k)
            pose = _pose(rig, length, angle, psi)
            px, _, pz, tx, ty, tz = pose
            gap = _point_segment_distance(cx, cz, px, pz, tx, tz) - solid.radius_m - reach
            if gap > 0:
                k += max(1, int(gap / move)) if move > _EPS else n + 1
                continue
            load_top = ty - cable - rig.rigging_m
            load_bottom = load_top - rig.load_height_m
            if (
                distance_to_obstacle_m(solid.spec, tx, tz) <= reach_load
                and load_bottom < solid.top_y + half
                and load_top > solid.base_y - half
            ):
                return COLLISION_LOAD
            hit = _boom_or_line_hit(solid, pose, load_top, half)
            if hit is not None:
                return hit
            k += 1
    return None


def _approach_collision(
    rig: Rig,
    solids: Sequence[Solid],
    start: CraneStateValues,
    end: CraneStateValues,
    cable_exempt_ids: frozenset[str] = frozenset(),
) -> str | None:
    """Da pose de partida até o gancho acima da carga: ψ fica parado, a lança desce e estende."""
    longest = max(start.boom_length_m, end.boom_length_m)
    move_total = (
        abs(end.boom_length_m - start.boom_length_m)
        + longest * abs(math.radians(end.boom_angle_deg - start.boom_angle_deg))
        + abs(end.cable_length_m - start.cable_length_m)
    )
    samples = min(APPROACH_MAX_SAMPLES, max(1, math.ceil(move_total / SWEEP_STEP_M)))
    half = move_total / samples / 2
    reach = max(BOOM_HALF_SECTION_M, HOOK_HALF_WIDTH_M) + half
    lowest = min(start.boom_angle_deg, end.boom_angle_deg)
    farthest = rig.geometry.boom_pivot_offset_m + longest * math.cos(math.radians(lowest))
    ux, uz = direction(rig.placement.heading_deg + start.turret_rotation_deg)
    x0 = rig.placement.x
    z0 = rig.placement.z
    near = [
        solid
        for solid in solids
        if _point_segment_distance(
            solid.spec.center_x, solid.spec.center_z, x0, z0, x0 + farthest * ux, z0 + farthest * uz
        )
        - solid.radius_m
        <= reach
    ]
    if not near:
        return None
    for i in range(samples + 1):
        length, angle, psi, cable = _lerp(start, end, i / samples)
        pose = _pose(rig, length, angle, psi)
        hook_bottom = pose[4] - cable - rig.hook_drop_m
        for solid in near:
            hit = _boom_or_line_hit(
                solid, pose, hook_bottom, half, check_cable=solid.spec.id not in cable_exempt_ids
            )
            if hit is not None:
                return hit
    return None


def _static_collision(
    rig: Rig,
    solids: Sequence[Solid],
    state: CraneStateValues,
    line_bottom_y: float,
    cable_exempt_ids: frozenset[str] = frozenset(),
) -> str | None:
    """Uma pose parada: a lança e a linha do cabo da ponta até `line_bottom_y`. O cabo não é
    conferido contra os obstáculos de `cable_exempt_ids` (o apoio da entrega: a carga repousa
    nele, e a meia-largura do gancho não pode recusar o próprio apoio)."""
    pose = _pose(rig, state.boom_length_m, state.boom_angle_deg, state.turret_rotation_deg)
    for solid in solids:
        hit = _boom_or_line_hit(
            solid, pose, line_bottom_y, 0.0, check_cable=solid.spec.id not in cable_exempt_ids
        )
        if hit is not None:
            return hit
    return None


def first_path_collision(
    rig: Rig,
    solids: Sequence[Solid],
    *,
    arc: SwingArc,
    path: Sequence[CraneStateValues],
    approach: tuple[CraneStateValues, CraneStateValues],
    pick_state: CraneStateValues,
    pick_load_top_y: float,
    delivery_state: CraneStateValues,
    delivery_load_top_y: float,
    delivery_supports: Sequence[ObstacleSpec] = (),
    pick_supports: Sequence[ObstacleSpec] = (),
) -> str | None:
    """Primeiro motivo de colisão (`COLLISION_*`) no caminho inteiro da opção, ou `None`.

    Aproximar e engatar: a lança e o cabo descem até acima da carga e depois até ela (pose de
    coleta, com a linha até o topo da carga no chão). Levantar e baixar: só o cabo muda, e a linha
    da ponta até a carga apoiada cobre todo o trecho. Girar: amostras densas do movimento
    interpolado. A pegada da carga na coleta e na entrega é conferida à parte (`pick_cover`,
    `delivery_surface`). O cabo não é conferido contra o caminhão que apoia a carga (na coleta ou na
    entrega); a aproximação tem motivo próprio (`COLLISION_APPROACH`).
    """
    if not solids:
        return None
    pick_exempt = frozenset(support.id for support in pick_supports)
    if _approach_collision(rig, solids, *approach, pick_exempt) is not None:
        return COLLISION_APPROACH
    return (
        _static_collision(rig, solids, pick_state, pick_load_top_y, pick_exempt)
        or _swing_collision(rig, solids, arc, path)
        or _static_collision(
            rig,
            solids,
            delivery_state,
            delivery_load_top_y,
            frozenset(support.id for support in delivery_supports),
        )
    )


__all__ = [
    "BOOM_HALF_SECTION_M",
    "COLLISION_APPROACH",
    "COLLISION_BOOM",
    "COLLISION_CABLE",
    "COLLISION_LOAD",
    "DeliverySurface",
    "HOOK_HALF_WIDTH_M",
    "Rig",
    "SWEEP_STEP_M",
    "Solid",
    "SwingArc",
    "body_crossed",
    "delivery_cover",
    "delivery_surface",
    "first_path_collision",
    "footprint_overlaps_obstacle",
    "load_crossings",
    "pick_cover",
    "pick_surface",
    "samples_within",
    "segment_hits_solid",
    "support_top_y",
    "solids_of",
    "swing_arc",
    "terrain_peak_along",
]
