# FICTÍCIO — catálogo e tabela inventados só para testar o planejamento da operação (ADR-012).
#
# Nenhum número daqui vem de fabricante, de tabela real ou da doc-fonte.
"""Catálogo em memória com uma configuração FICTÍCIA e sua tabela ativa (TASK-075)."""

import time
from collections.abc import Callable

from app.application.ports.crane_catalog_repository import Crane, CraneConfiguration, Manufacturer
from app.application.use_cases.recommend_lift_plan import TIME_BUDGET_S, RecommendLiftPlan
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.entities.scenario import ObstacleKind, ObstacleSpec
from app.domain.services.linear_interpolation_lookup import LinearInterpolationLookup
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_ficticio import point_ficticio

CONFIGURACAO_PLANEJAMENTO_ID = "CFG-FICTICIA-PLANEJAMENTO"
CONFIGURACAO_GRANDE_ID = "CFG-FICTICIA-PLANEJAMENTO-GRANDE"

# (comprimento da lança, raio, capacidade em kg) — FICTÍCIO.
PONTOS_PEQUENO: tuple[tuple[float, float, float], ...] = (
    (12.0, 2.0, 11000.0),
    (12.0, 4.0, 9000.0),
    (12.0, 6.0, 7000.0),
    (12.0, 8.0, 5500.0),
    (12.0, 10.0, 4200.0),
    (12.0, 11.0, 3800.0),
    (17.0, 4.0, 8200.0),
    (17.0, 6.0, 6600.0),
    (17.0, 8.0, 5200.0),
    (17.0, 10.0, 4000.0),
    (17.0, 12.0, 3200.0),
    (17.0, 14.0, 2600.0),
    (17.0, 16.0, 2100.0),
    (22.0, 4.0, 7000.0),
    (22.0, 6.0, 5800.0),
    (22.0, 8.0, 4700.0),
    (22.0, 10.0, 3800.0),
    (22.0, 12.0, 3000.0),
    (22.0, 14.0, 2400.0),
    (22.0, 16.0, 1900.0),
    (22.0, 18.0, 1500.0),
    (22.0, 20.0, 1200.0),
    (22.0, 21.0, 1050.0),
)
"""Guindaste médio: raio até 21 m, 11 t a 2 m."""

PONTOS_GRANDE: tuple[tuple[float, float, float], ...] = tuple(
    (length, radius, capacity * 3) for length, radius, capacity in PONTOS_PEQUENO
)
"""Guindaste grande: o triplo da capacidade, mesma geometria."""


def geometria_planejamento() -> CraneGeometry:
    return CraneGeometry(
        boom_pivot_offset_m=0.46,
        boom_pivot_height=Length(3.3),
        boom_length_min=Length(12.0),
        boom_length_max=Length(22.0),
        boom_angle_min=Angle(0.0),
        boom_angle_max=Angle(80.0),
        cable_length_min=Length(1.0),
        cable_length_max=Length(15.0),
    )


class TabelasAtivas:
    """`ActiveLoadChartProvider` em memória: uma tabela ativa por configuração."""

    def __init__(self, pontos_por_configuracao: dict[str, tuple[tuple[float, float, float], ...]]):
        self._charts = {
            configuration_id: LoadChart(
                id=f"LC-{configuration_id}",
                version="FICTICIO-v1",
                configuration_id=configuration_id,
                status=LoadChartStatus.ACTIVE,
                points=tuple(point_ficticio(*values) for values in pontos),
            )
            for configuration_id, pontos in pontos_por_configuracao.items()
        }

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        if rotation_zone_code is not None:
            return None
        return self._charts.get(configuration_id)


def catalogo_planejamento(
    *, com_grande: bool = False
) -> tuple[InMemoryCraneCatalog, TabelasAtivas]:
    """Um guindaste médio e, opcionalmente, um grande (3× a capacidade)."""
    catalog = InMemoryCraneCatalog()
    catalog.add_manufacturer(Manufacturer("FAB-FICTICIO", "Fabricante FICTÍCIO"))
    pontos = {CONFIGURACAO_PLANEJAMENTO_ID: PONTOS_PEQUENO}
    modelos = [("CRANE-FICTICIO-MEDIO", "Médio FICTÍCIO", CONFIGURACAO_PLANEJAMENTO_ID)]
    if com_grande:
        pontos[CONFIGURACAO_GRANDE_ID] = PONTOS_GRANDE
        modelos.append(("CRANE-FICTICIO-GRANDE", "Grande FICTÍCIO", CONFIGURACAO_GRANDE_ID))
    for crane_id, model, configuration_id in modelos:
        catalog.add_crane(Crane(crane_id, "FAB-FICTICIO", model))
        catalog.add_configuration(
            CraneConfiguration(
                configuration_id,
                crane_id,
                "Padrão FICTÍCIA",
                geometry=geometria_planejamento(),
                hook_block_weight=Mass(200.0),
            )
        )
    return catalog, TabelasAtivas(pontos)


class SemTabelas:
    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        return None


def caso_de_uso_planejamento(
    *,
    com_grande: bool = False,
    sem_tabelas: bool = False,
    time_budget_s: float = TIME_BUDGET_S,
    clock: Callable[[], float] = time.monotonic,
) -> RecommendLiftPlan:
    catalog, tabelas = catalogo_planejamento(com_grande=com_grande)
    return RecommendLiftPlan(
        catalog=catalog,
        active_load_chart_provider=SemTabelas() if sem_tabelas else tabelas,
        load_chart_interpolator=LinearInterpolationLookup(),
        time_budget_s=time_budget_s,
        clock=clock,
    )


def container_ficticio(
    *, x: float = 0.0, z: float = 0.0, height_m: float = 3.0, identifier: str = "OBS-1"
) -> ObstacleSpec:
    """Obstáculo (caixa) FICTÍCIO de 6 × 3 m no meio do caminho."""
    return ObstacleSpec(
        identifier, "Container FICTÍCIO", ObstacleKind.BOX, x, z, 6.0, 3.0, height_m, 0.0
    )
