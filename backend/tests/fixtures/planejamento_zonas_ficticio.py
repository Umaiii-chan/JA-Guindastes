# FICTÍCIO — catálogo com zonas de giro inventado só para testar o planejamento (ADR-012).
#
# Nenhum número daqui vem de fabricante, de tabela real ou da doc-fonte.
"""Configuração FICTÍCIA com uma frente fraca (40 % da capacidade, de ψ = 300° a 60°) e o resto
com a tabela cheia do guindaste médio (`planejamento_ficticio.PONTOS_PEQUENO`). TASK-089."""

import time
from collections.abc import Callable

from app.application.ports.crane_catalog_repository import Crane, CraneConfiguration, Manufacturer
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.application.use_cases.recommend_lift_plan import (
    RecommendLiftPlan,
    _Entry,
    _make_evaluator,
    _planner_crane,
    _profile_of,
    _SnapshotProviders,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.services.linear_interpolation_lookup import LinearInterpolationLookup
from app.domain.services.planning.models import PlannerCrane, StateEvaluator
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones
from tests.fixtures.crane_catalog_ficticio import InMemoryCraneCatalog
from tests.fixtures.load_chart_ficticio import point_ficticio
from tests.fixtures.planejamento_ficticio import PONTOS_PEQUENO, geometria_planejamento

CONFIGURACAO_ZONAS_ID = "CFG-FICTICIA-ZONAS"
FRENTE_FATOR = 0.4
ZONAS = RotationZones(
    (
        RotationZone("FRENTE", "Frente FICTÍCIA", 300.0, 60.0),
        RotationZone("RESTO", "Lados e traseira FICTÍCIOS", 60.0, 300.0),
    )
)


class TabelasPorZona:
    """`ActiveLoadChartProvider` em memória: uma tabela ativa por zona."""

    def __init__(self) -> None:
        def chart(code: str, factor: float) -> LoadChart:
            return LoadChart(
                id=f"LC-{code}",
                version="FICTICIO-v1",
                configuration_id=CONFIGURACAO_ZONAS_ID,
                status=LoadChartStatus.ACTIVE,
                points=tuple(point_ficticio(b, r, c * factor) for b, r, c in PONTOS_PEQUENO),
                rotation_zone_code=code,
            )

        self._charts = {"FRENTE": chart("FRENTE", FRENTE_FATOR), "RESTO": chart("RESTO", 1.0)}

    def get_active_load_chart(
        self, configuration_id: str, rotation_zone_code: str | None = None
    ) -> LoadChart | None:
        if configuration_id != CONFIGURACAO_ZONAS_ID or rotation_zone_code is None:
            return None
        return self._charts.get(rotation_zone_code)


def catalogo_zonas() -> InMemoryCraneCatalog:
    catalog = InMemoryCraneCatalog()
    catalog.add_manufacturer(Manufacturer("FAB-FICTICIO", "Fabricante FICTÍCIO"))
    catalog.add_crane(Crane("CRANE-FICTICIO-ZONAS", "FAB-FICTICIO", "Zonas FICTÍCIO"))
    catalog.add_configuration(
        CraneConfiguration(
            CONFIGURACAO_ZONAS_ID,
            "CRANE-FICTICIO-ZONAS",
            "Zonas FICTÍCIA",
            geometry=geometria_planejamento(),
            rotation_zones=ZONAS,
            hook_block_weight=Mass(200.0),
        )
    )
    return catalog


def caso_de_uso_zonas(
    *, time_budget_s: float = 30.0, clock: Callable[[], float] = time.monotonic
) -> RecommendLiftPlan:
    return RecommendLiftPlan(
        catalog=catalogo_zonas(),
        active_load_chart_provider=TabelasPorZona(),
        load_chart_interpolator=LinearInterpolationLookup(),
        time_budget_s=time_budget_s,
        clock=clock,
    )


def _entrada() -> _Entry:
    catalog = catalogo_zonas()
    charts = TabelasPorZona()
    crane = catalog.list_cranes()[0]
    configuration = catalog.list_configurations(crane.id)[0]
    entry = _Entry(
        configuration,
        crane,
        "Zonas FICTÍCIO",
        _profile_of(crane.limits),
        {
            code: chart
            for code in ZONAS.codes
            if (chart := charts.get_active_load_chart(CONFIGURACAO_ZONAS_ID, code)) is not None
        },
    )
    return entry


def guindaste_zonas() -> PlannerCrane:
    """O guindaste com zonas como o planejador de domínio o recebe."""
    return _planner_crane(_entrada())


def avaliador_zonas() -> StateEvaluator:
    """O mesmo cálculo que o caso de uso usa, para reavaliar a trajetória quadro a quadro."""
    snapshot = _SnapshotProviders([_entrada()])
    use_case = EvaluateOperation(
        crane_geometry_provider=snapshot,
        active_load_chart_provider=snapshot,
        load_chart_interpolator=LinearInterpolationLookup(),
        configuration_load_rules_provider=snapshot,
        crane_limits_provider=snapshot,
        safety_profile_provider=snapshot,
    )
    return _make_evaluator(use_case, ())
