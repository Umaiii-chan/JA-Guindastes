"""Rota REST da avaliação operacional (TASK-024; doc-fonte §§ 14 e 15.3; ADR-010).

`POST /api/v1/evaluations` recebe um estado operacional e a carga, roda o caso de uso
`EvaluateOperation` (TASK-015) e devolve a geometria, a capacidade (quando houver, com o ponto
tabelado usado e a marca da estratégia), a utilização, o id e a versão da tabela, ou os motivos de
"não avaliável". Nada é gravado.

A doc-fonte § 15.3 prevê `POST /api/v1/simulations/{simulation_id}/evaluate`, sobre uma simulação
persistida. Ainda não há simulações (nem persistência delas), então esta rota avalia um estado
avulso, sem id na rota; quando as simulações existirem, a rota da doc-fonte pode reusar o mesmo caso
de uso (ver `handoffs/TASK-024.md`).

Códigos HTTP:
- **200** para "avaliado" **e** para "não avaliável": a requisição estava bem formada e o
  resultado é o que foi pedido (mesmo critério do `POST /api/v1/load-charts/validate`, TASK-019).
  Estado fora das faixas da ficha técnica, configuração sem ficha técnica ou sem tabela ativa e
  consulta fora da tabela são `status: NOT_EVALUABLE` com motivos (RN-007; ADR-013 C-5).
- **422** para a requisição malformada (campo ausente ou desconhecido, tipo errado, `NaN`,
  infinito, comprimento ou carga negativos, `configuration_id` em branco).
- **500** se o provedor da tabela ativa quebrar o contrato da porta (tabela não `ACTIVE` ou de
  outra configuração): é erro de programação, não resultado de avaliação.

Sem níveis de alerta (PEND-004). Autorização (ADR-016; TASK-038): com banco, exige sessão de
qualquer perfil; a composição liga a dependência na inclusão do router.

O router recebe as dependências prontas porque a apresentação não pode importar a infraestrutura
(contrato de camadas em `backend/pyproject.toml`): quem escolhe provedores e estratégia é a raiz
de composição, `app.main`. Elas chegam de duas formas:

- `EvaluationDependencies`: provedores fixos, um único `EvaluateOperation` para todas as requisições
  (testes; composição sem banco);
- `EvaluateOperationDependency` (TASK-029): dependência FastAPI com `yield` que entrega o caso
  de uso **de uma requisição** e libera os recursos dela no fim, mesmo com erro (composição com
  banco: uma conexão do pool por requisição).
"""

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.application.ports.accessory_repository import AccessoryProvider
from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.configuration_load_rules_provider import (
    ConfigurationLoadRulesProvider,
)
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.ports.crane_limits_provider import CraneLimitsProvider
from app.application.ports.safety_profile_provider import SafetyProfileProvider
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState
from app.presentation.api.evaluation_schemas import (
    EvaluationRequest,
    EvaluationResponse,
    to_soil_kinds,
)

EVALUATIONS_PATH = "/api/v1/evaluations"


@dataclass(frozen=True, slots=True)
class EvaluationDependencies:
    """Provedores e estratégia de consulta que a avaliação usa, escolhidos pela composição.

    - `crane_geometry_provider`: ficha técnica geométrica da configuração (ADR-013 C-4);
    - `active_load_chart_provider`: tabela de carga `ACTIVE` da configuração (RN-001);
    - `load_chart_interpolator`: estratégia de consulta à tabela; na composição, a
      `ConservativeTabulatedLookup` (ADR-015).
    """

    crane_geometry_provider: CraneGeometryProvider
    active_load_chart_provider: ActiveLoadChartProvider
    load_chart_interpolator: LoadChartInterpolator
    configuration_load_rules_provider: ConfigurationLoadRulesProvider | None = None
    """Zonas de giro e peso do gancho (TASK-046); sem ele, sem zonas e sem gancho."""
    crane_limits_provider: CraneLimitsProvider | None = None
    """Limite de capacidade do modelo (TASK-051); sem ele, valem os limites padrão."""
    safety_profile_provider: SafetyProfileProvider | None = None
    """Limite, faixa de atenção e inclinação máxima (TASK-051); sem ele, padrões FICTÍCIOS."""
    accessory_provider: AccessoryProvider | None = None
    """Catálogo de acessórios de içamento (TASK-056); sem ele, qualquer `accessory_ids` é
    `ACCESSORY_NOT_FOUND`."""


type EvaluateOperationDependency = Callable[[], Iterator[EvaluateOperation]]
"""Dependência FastAPI (gerador com um só `yield`) que entrega o caso de uso da requisição.

O código depois do `yield` roda no fim da requisição, também quando a rota levanta exceção: é onde a
composição devolve ao pool a conexão usada (TASK-029). Por ser síncrona, o FastAPI a executa numa
thread à parte, sem travar o laço de eventos.
"""


def shared_evaluate_operation(use_case: EvaluateOperation) -> EvaluateOperationDependency:
    """Dependência que entrega sempre o mesmo `use_case` (sem recurso por requisição)."""

    def provide_evaluate_operation() -> Iterator[EvaluateOperation]:
        yield use_case

    return provide_evaluate_operation


def as_evaluate_operation_dependency(
    dependencies: EvaluationDependencies | EvaluateOperationDependency,
) -> EvaluateOperationDependency:
    if isinstance(dependencies, EvaluationDependencies):
        return shared_evaluate_operation(
            EvaluateOperation(
                crane_geometry_provider=dependencies.crane_geometry_provider,
                active_load_chart_provider=dependencies.active_load_chart_provider,
                load_chart_interpolator=dependencies.load_chart_interpolator,
                configuration_load_rules_provider=dependencies.configuration_load_rules_provider,
                crane_limits_provider=dependencies.crane_limits_provider,
                safety_profile_provider=dependencies.safety_profile_provider,
                accessory_provider=dependencies.accessory_provider,
            )
        )
    return dependencies


def create_evaluations_router(
    dependencies: EvaluationDependencies | EvaluateOperationDependency,
) -> APIRouter:
    """Monta o router da avaliação com provedores fixos ou com uma dependência por requisição."""
    use_case_dependency = as_evaluate_operation_dependency(dependencies)
    router = APIRouter(prefix=EVALUATIONS_PATH, tags=["evaluations"])

    @router.post(
        "",
        status_code=status.HTTP_200_OK,
        summary="Avaliar um estado operacional contra a tabela de carga ativa (sem gravar)",
        response_description=(
            "Avaliação concluída: `EVALUATED` com capacidade e utilização, ou `NOT_EVALUABLE` "
            "com os motivos."
        ),
        description=(
            "Calcula a geometria no backend (ADR-013; RN-008), consulta a tabela de carga ativa "
            "da configuração (RN-001, RN-004) e calcula a utilização `carga / capacidade × 100`. "
            "A capacidade vem da consulta conservadora **provisória** (ADR-015; "
            "`strategy: CONSERVATIVE_PROVISIONAL`): entre dois raios tabelados, vale a menor "
            "capacidade dos vizinhos; o valor não é definitivo (PEND-001, PEND-003). "
            "Estado fora das faixas, configuração sem ficha técnica ou sem tabela ativa e "
            "consulta fora da tabela respondem **200** com `status: NOT_EVALUABLE` e os motivos "
            "(RN-007). Sem níveis de alerta (PEND-004). Nada é gravado. "
            "Com banco, exige sessão de qualquer perfil (ADR-016)."
        ),
        responses={
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                "description": "Erro interno: o provedor da tabela ativa devolveu uma tabela que "
                "não é `ACTIVE` ou é de outra configuração (quebra do contrato da porta).",
            },
        },
    )
    def evaluate_operation(
        request: EvaluationRequest,
        use_case: Annotated[EvaluateOperation, Depends(use_case_dependency)],
    ) -> EvaluationResponse:
        # Rota síncrona: os provedores de banco (TASK-022) são síncronos, e o FastAPI roda a rota
        # numa thread à parte, sem travar o laço de eventos.
        state = OperationalState(
            boom_length=Length(request.boom_length_m),
            boom_angle=Angle(request.boom_angle_deg),
            turret_rotation=Angle(request.turret_rotation_deg),
            cable_length=Length(request.cable_length_m),
        )
        evaluation = use_case.execute(
            configuration_id=request.configuration_id,
            state=state,
            load_weight=Mass(request.load_weight_kg),
            outriggers=None if request.outriggers is None else request.outriggers.to_setting(),
            ground_slope_deg=request.ground_slope_deg,
            accessory_ids=request.accessory_ids,
            soil_kinds=to_soil_kinds(request.soil_kinds),
            wind_speed_ms=request.wind_speed_ms,
            obstacle_conflicts=request.obstacle_conflicts,
        )
        return EvaluationResponse.from_evaluation(request.configuration_id, evaluation)

    return router
