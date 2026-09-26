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

Sem níveis de alerta (PEND-004) e sem autenticação (P-009; known-gaps L-003).

O router recebe as dependências prontas (`EvaluationDependencies`) porque a apresentação não pode
importar a infraestrutura (contrato de camadas em `backend/pyproject.toml`): quem escolhe os
provedores e a estratégia é a raiz de composição, `app.main`.
"""

from dataclasses import dataclass

from fastapi import APIRouter, status

from app.application.ports.active_load_chart_provider import ActiveLoadChartProvider
from app.application.ports.crane_geometry_provider import CraneGeometryProvider
from app.application.use_cases.evaluate_operation import EvaluateOperation
from app.domain.services.load_chart_interpolator import LoadChartInterpolator
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.operational_state import OperationalState
from app.presentation.api.evaluation_schemas import EvaluationRequest, EvaluationResponse

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


def create_evaluations_router(dependencies: EvaluationDependencies) -> APIRouter:
    """Monta o router da avaliação com os provedores e a estratégia escolhidos pela composição."""
    use_case = EvaluateOperation(
        crane_geometry_provider=dependencies.crane_geometry_provider,
        active_load_chart_provider=dependencies.active_load_chart_provider,
        load_chart_interpolator=dependencies.load_chart_interpolator,
    )
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
            "Sem autenticação (P-009 pendente)."
        ),
        responses={
            status.HTTP_500_INTERNAL_SERVER_ERROR: {
                "description": "Erro interno: o provedor da tabela ativa devolveu uma tabela que "
                "não é `ACTIVE` ou é de outra configuração (quebra do contrato da porta).",
            },
        },
    )
    def evaluate_operation(request: EvaluationRequest) -> EvaluationResponse:
        # Rota síncrona: os provedores reais (banco, TASK-022) serão síncronos, e o FastAPI roda a
        # rota numa thread à parte, sem travar o laço de eventos.
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
        )
        return EvaluationResponse.from_evaluation(request.configuration_id, evaluation)

    return router
