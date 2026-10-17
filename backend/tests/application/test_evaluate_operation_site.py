"""`EvaluateOperation` com o local da operação: rede elétrica e içamento crítico (D4; TASK-107).

Dados FICTÍCIOS. A lança do ponto da tabela (10 m, 0°) aponta para +Z do chassi: pino a 1,5 m do
eixo, ponta a 11,5 m, a 2,5 m de altura, e o gancho a 1,5 m (cabo de 1 m).
"""

import math
from dataclasses import replace

import pytest

from app.application.use_cases.evaluate_operation import (
    EvaluatedOperation,
    EvaluateOperation,
    SiteContext,
)
from app.domain.entities.scenario import PowerLineSpec
from app.domain.services.exact_point_lookup import ExactPointLookup
from app.domain.services.power_line import ClearanceStatus, required_clearance_m
from app.domain.value_objects.mass import Mass
from tests.application.test_evaluate_operation import (
    ON_CHART_POINT,
    FakeActiveLoadChartProvider,
    FakeCraneGeometryProvider,
)
from tests.fixtures.avaliacao_operacional_ficticia import (
    CONFIGURATION_AVALIACAO_FICTICIA_ID,
    build_load_chart_avaliacao_ficticio,
)
from tests.fixtures.crane_geometry_ficticia import build_crane_geometry_ficticia, state_ficticio

TIP_Z_M = 11.5


def use_case() -> EvaluateOperation:
    return EvaluateOperation(
        crane_geometry_provider=FakeCraneGeometryProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_crane_geometry_ficticia()}
        ),
        active_load_chart_provider=FakeActiveLoadChartProvider(
            {CONFIGURATION_AVALIACAO_FICTICIA_ID: build_load_chart_avaliacao_ficticio()}
        ),
        load_chart_interpolator=ExactPointLookup(),
    )


def evaluate(
    site: SiteContext | None, load_kg: float = 1000.0, **kwargs: object
) -> EvaluatedOperation:
    result = use_case().execute(
        configuration_id=CONFIGURATION_AVALIACAO_FICTICIA_ID,
        state=state_ficticio(**ON_CHART_POINT),
        load_weight=Mass(load_kg),
        site=site,
        **kwargs,  # type: ignore[arg-type]
    )
    assert isinstance(result, EvaluatedOperation)
    return result


def line(*, height_m: float, z: float = TIP_Z_M, kv: float = 13.8) -> PowerLineSpec:
    return PowerLineSpec("R1", "Rede de teste", -30.0, z, 30.0, z, height_m, kv)


def codes(result: EvaluatedOperation) -> list[str]:
    return [alert.code for alert in result.alerts]


def test_sem_site_o_resultado_e_o_de_antes() -> None:
    result = evaluate(None)

    assert result.power_line_clearances == ()
    assert result.critical_lift is None
    assert not {"CRITICAL_LIFT", "POWER_LINE_CLEARANCE_VIOLATION"} & set(codes(result))


def test_site_sem_rede_e_carga_leve_nao_cria_alerta() -> None:
    result = evaluate(SiteContext())

    assert result.power_line_clearances == ()
    assert result.critical_lift is not None and not result.critical_lift.is_critical
    assert codes(result) == codes(evaluate(None))


def test_rede_a_1_m_da_ponta_da_lanca_e_violacao_critica() -> None:
    result = evaluate(SiteContext(power_lines=(line(height_m=3.5),)))

    (clearance,) = result.power_line_clearances
    assert clearance.distance_m == pytest.approx(1.0, abs=0.05)
    assert clearance.status is ClearanceStatus.VIOLATION
    alert = next(a for a in result.alerts if a.code == "POWER_LINE_CLEARANCE_VIOLATION")
    assert alert.severity.value == "CRITICAL"
    assert "Rede de teste" in alert.message and "3.05 m a 13.8 kV" in alert.message


def test_a_posicao_e_o_giro_do_chassi_levam_a_lanca_para_o_mundo() -> None:
    """Guindaste em (100, 50) com o chassi girado 90°: a lança, que aponta para +Z do chassi,
    aponta para +X no mundo (rotY(90°): z → x). A rede em x = 111,5 fica a 1 m da ponta."""
    rede = PowerLineSpec("R1", "Rede", 111.5, 20.0, 111.5, 80.0, 3.5, 13.8)
    site = SiteContext(power_lines=(rede,), crane_x_m=100.0, crane_z_m=50.0, crane_heading_deg=90.0)

    (clearance,) = evaluate(site).power_line_clearances

    assert clearance.distance_m == pytest.approx(1.0, abs=0.05)


def test_o_alerta_de_violacao_nao_muda_o_risco_de_tombamento() -> None:
    limpo = evaluate(SiteContext())
    com_rede = evaluate(SiteContext(power_lines=(line(height_m=3.5),)))

    assert com_rede.tipping_risk == limpo.tipping_risk
    assert "POWER_LINE_CLEARANCE_VIOLATION" in codes(com_rede)


def test_rede_alta_e_longe_fica_ok_mas_o_giro_pode_acusar() -> None:
    # Rede a 20 m de altura, longe da lança: OK agora e girando.
    longe = evaluate(SiteContext(power_lines=(line(height_m=20.0),)))
    (c,) = longe.power_line_clearances
    assert c.status is ClearanceStatus.OK and c.swept_status is ClearanceStatus.OK

    # Rede passando a 1 m da ponta, em outro lado do giro (−Z): agora OK, girando viola.
    atras = evaluate(SiteContext(power_lines=(line(height_m=3.5, z=-TIP_Z_M),)))
    (c,) = atras.power_line_clearances
    assert c.status is ClearanceStatus.OK
    assert c.swept_status is ClearanceStatus.VIOLATION
    assert "POWER_LINE_SWEPT_VIOLATION" in codes(atras)


def test_entre_a_minima_e_1_5x_e_alerta_de_atencao_e_icamento_critico() -> None:
    d = required_clearance_m(13.8)
    result = evaluate(SiteContext(power_lines=(line(height_m=2.5 + 1.2 * d),)))

    (c,) = result.power_line_clearances
    assert c.status is ClearanceStatus.ATTENTION
    assert "POWER_LINE_CLEARANCE_NEAR" in codes(result)
    assert result.critical_lift is not None
    assert [t.code for t in result.critical_lift.triggers] == ["POWER_LINE_CLOSE"]


def test_a_tensao_escolhida_muda_a_distancia_exigida() -> None:
    baixa = evaluate(SiteContext(power_lines=(line(height_m=8.0, kv=13.8),)))
    alta = evaluate(SiteContext(power_lines=(line(height_m=8.0, kv=500.0),)))

    assert baixa.power_line_clearances[0].required_m == pytest.approx(3.048)
    assert alta.power_line_clearances[0].required_m == pytest.approx(20 * 0.3048)
    assert alta.power_line_clearances[0].distance_m == baixa.power_line_clearances[0].distance_m


def side_line(height_m: float) -> PowerLineSpec:
    """Rede paralela à lança (eixo Z), 5 m ao lado: só a carga pendurada chega perto dela.

    Neste ponto da tabela o gancho fica a 1,5 m e a carga pende abaixo do chão (y < 0); o
    `SiteContext` não valida a altura da rede, só o `PowerLineSpec` do cenário valida.
    """
    return PowerLineSpec("R1", "Rede ao lado", 5.0, 0.0, 5.0, 20.0, height_m, 13.8)


def test_carga_pendurada_entra_na_distancia_com_a_altura_das_lingas_da_geometria_unica() -> None:
    """Carga 3 × 2 × 2 m: gancho 1,05 + lingas a 60° (3,1225 m): topo a y = −2,67, base a −4,67.

    A rede ao lado, a y = −4: dentro da altura da carga, então a distância é a horizontal
    (5 m) menos o raio da pegada (1,80 m) = 3,20 m.
    """
    site = SiteContext(
        power_lines=(side_line(-4.0),), load_length_m=3.0, load_width_m=2.0, load_height_m=2.0
    )

    (c,) = evaluate(site).power_line_clearances

    assert c.nearest_part == "load"
    assert c.distance_m == pytest.approx(5.0 - math.hypot(3.0, 2.0) / 2, abs=1e-6)


def test_lingas_do_site_seguem_o_angulo_informado() -> None:
    """Com lingas a 45° (1,80 m) a carga fica 1,32 m mais alta: sai da altura da rede."""
    base = SiteContext(
        power_lines=(side_line(-4.0),), load_length_m=3.0, load_width_m=2.0, load_height_m=2.0
    )
    padrao = evaluate(base).power_line_clearances[0]
    a45 = evaluate(replace(base, sling_angle_deg=45.0)).power_line_clearances[0]

    assert padrao.distance_m == pytest.approx(5.0 - math.hypot(3.0, 2.0) / 2, abs=1e-6)
    assert a45.distance_m > padrao.distance_m


def test_gatilhos_do_icamento_critico_pelo_contexto() -> None:
    result = evaluate(SiteContext(tandem=True, load_over_occupied=True))

    assert result.critical_lift is not None
    assert [t.code for t in result.critical_lift.triggers] == ["TANDEM", "LOAD_OVER_OCCUPIED"]
    alert = next(a for a in result.alerts if a.code == "CRITICAL_LIFT")
    assert alert.severity.value == "ATTENTION"
    assert "Plano de içamento exigido" in alert.message and "tandem" in alert.message


def test_carga_a_75_por_cento_da_capacidade_efetiva_e_critica() -> None:
    # Ponto da tabela: 4000 kg; 3000 kg de carga = 75 % (sem gancho cadastrado).
    result = evaluate(SiteContext(), load_kg=3000.0)

    assert result.critical_lift is not None
    assert [t.code for t in result.critical_lift.triggers] == ["CAPACITY_75"]


def test_vento_acima_de_70_por_cento_do_limite_e_critico() -> None:
    result = evaluate(SiteContext(), wind_speed_ms=10.0)

    assert result.critical_lift is not None
    assert "WIND_NEAR_LIMIT" in [t.code for t in result.critical_lift.triggers]


def test_inclinacao_perto_do_maximo_e_critica() -> None:
    result = evaluate(SiteContext(), ground_slope_deg=2.5)  # máximo padrão: 3°

    assert result.critical_lift is not None
    assert "GROUND_CONDITIONS" in [t.code for t in result.critical_lift.triggers]


def test_alertas_ficam_ordenados_por_severidade() -> None:
    result = evaluate(SiteContext(power_lines=(line(height_m=3.5),), tandem=True))

    order = {"CRITICAL": 0, "ATTENTION": 1, "INFO": 2}
    ranks = [order[a.severity.value] for a in result.alerts]
    assert ranks == sorted(ranks)
