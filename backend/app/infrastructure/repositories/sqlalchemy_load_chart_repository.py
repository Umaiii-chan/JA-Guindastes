"""Tabelas de carga no PostgreSQL via SQLAlchemy (TASK-022).

Implementa `LoadChartRepository`, `ActiveLoadChartProvider` e `LoadChartListing` (TASK-044). Cada
método abre a própria sessão e a própria transação (a aplicação ainda não tem porta de unidade de
trabalho).
"""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.load_chart_listing import LoadChartSummary
from app.application.ports.load_chart_repository import (
    ActiveLoadChartConflictError,
    DuplicateLoadChartVersionError,
    LoadChartAlreadyExistsError,
    LoadChartConfigurationNotFoundError,
    LoadChartNotDraftError,
    LoadChartNotFoundError,
    LoadChartSource,
    StoredLoadChart,
)
from app.domain.entities.load_chart import LoadChart, LoadChartStatus
from app.domain.entities.load_chart_point import LoadChartPoint
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.infrastructure.database.models.load_chart import (
    CONFIGURATION_VERSION_CONSTRAINT,
    ONE_ACTIVE_PER_CONFIGURATION_INDEX,
    LoadChartModel,
    LoadChartPointModel,
)
from app.infrastructure.repositories._integrity import violated_constraint

_LOAD_CHARTS_PK = "pk_load_charts"
_LOAD_CHART_CONFIGURATION_FK = "fk_load_charts_configuration_id_crane_configurations"


def load_chart_to_model(chart: LoadChart, source: LoadChartSource) -> LoadChartModel:
    return LoadChartModel(
        id=chart.id,
        configuration_id=chart.configuration_id,
        version=chart.version,
        status=chart.status.value,
        source_file_name=source.file_name,
        source_file_type=source.file_type,
        source_sha256=source.sha256,
        source_uri=source.uri,
        points=[
            LoadChartPointModel(
                position=position,
                boom_length_m=point.boom_length.meters,
                working_radius_m=point.working_radius.meters,
                max_capacity_kg=point.max_capacity.kilograms,
            )
            for position, point in enumerate(chart.points)
        ],
    )


def load_chart_from_model(model: LoadChartModel) -> LoadChart:
    """Monta a `LoadChart`; os invariantes do domínio são revalidados na construção."""
    return LoadChart(
        id=model.id,
        version=model.version,
        configuration_id=model.configuration_id,
        status=LoadChartStatus(model.status),
        points=tuple(
            LoadChartPoint(
                boom_length=Length(point.boom_length_m),
                working_radius=Length(point.working_radius_m),
                max_capacity=Mass(point.max_capacity_kg),
            )
            for point in sorted(model.points, key=lambda point: point.position)
        ),
    )


def source_from_model(model: LoadChartModel) -> LoadChartSource:
    return LoadChartSource(
        file_name=model.source_file_name,
        file_type=model.source_file_type,
        sha256=model.source_sha256,
        uri=model.source_uri,
    )


class SqlAlchemyLoadChartRepository:
    """Implementa `LoadChartRepository`, `ActiveLoadChartProvider` e `LoadChartListing`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def save_draft(self, chart: LoadChart, source: LoadChartSource) -> None:
        if chart.status is not LoadChartStatus.DRAFT:
            raise LoadChartNotDraftError(chart.status)
        try:
            with self._session_factory.begin() as session:
                session.add(load_chart_to_model(chart, source))
        except IntegrityError as error:
            constraint = violated_constraint(error)
            if constraint == _LOAD_CHARTS_PK:
                raise LoadChartAlreadyExistsError(chart.id) from error
            if constraint == CONFIGURATION_VERSION_CONSTRAINT:
                raise DuplicateLoadChartVersionError(
                    chart.configuration_id, chart.version
                ) from error
            if constraint == _LOAD_CHART_CONFIGURATION_FK:
                raise LoadChartConfigurationNotFoundError(chart.configuration_id) from error
            raise

    def change_status(self, load_chart_id: str, new_status: LoadChartStatus) -> None:
        status = LoadChartStatus(new_status)
        configuration_id: str | None = None
        try:
            with self._session_factory.begin() as session:
                model = session.get(LoadChartModel, load_chart_id)
                if model is None:
                    raise LoadChartNotFoundError(load_chart_id)
                configuration_id = model.configuration_id
                model.status = status.value
        except IntegrityError as error:
            constraint = violated_constraint(error)
            if constraint == ONE_ACTIVE_PER_CONFIGURATION_INDEX and configuration_id is not None:
                raise ActiveLoadChartConflictError(configuration_id) from error
            raise

    def get_by_id(self, load_chart_id: str) -> StoredLoadChart | None:
        with self._session_factory() as session:
            model = session.get(LoadChartModel, load_chart_id)
            if model is None:
                return None
            return StoredLoadChart(
                chart=load_chart_from_model(model), source=source_from_model(model)
            )

    def get_active_load_chart(self, configuration_id: str) -> LoadChart | None:
        """`ActiveLoadChartProvider`: a tabela `ACTIVE` da configuração, ou `None`."""
        with self._session_factory() as session:
            model = session.scalars(
                select(LoadChartModel).where(
                    LoadChartModel.configuration_id == configuration_id,
                    LoadChartModel.status == LoadChartStatus.ACTIVE.value,
                )
            ).one_or_none()
            return None if model is None else load_chart_from_model(model)

    def list_by_configuration(self, configuration_id: str) -> list[LoadChartSummary]:
        """`LoadChartListing` (TASK-044): as tabelas da configuração, sem carregar os pontos.

        Seleciona só as colunas do cabeçalho e conta os pontos no banco (`LEFT JOIN` + `COUNT`),
        em vez de montar cada `LoadChart` com todos os pontos. A ordem é só para ser estável; a
        ordem da resposta é do caso de uso.
        """
        point_count = func.count(LoadChartPointModel.position).label("point_count")
        statement = (
            select(
                LoadChartModel.id,
                LoadChartModel.version,
                LoadChartModel.configuration_id,
                LoadChartModel.status,
                LoadChartModel.source_file_name,
                LoadChartModel.source_file_type,
                LoadChartModel.source_sha256,
                LoadChartModel.source_uri,
                point_count,
            )
            .outerjoin(LoadChartPointModel, LoadChartPointModel.load_chart_id == LoadChartModel.id)
            .where(LoadChartModel.configuration_id == configuration_id)
            .group_by(LoadChartModel.id)
            .order_by(LoadChartModel.version, LoadChartModel.id)
        )
        with self._session_factory() as session:
            return [
                LoadChartSummary(
                    load_chart_id=row.id,
                    version=row.version,
                    configuration_id=row.configuration_id,
                    status=LoadChartStatus(row.status),
                    point_count=int(row.point_count),
                    source=LoadChartSource(
                        file_name=row.source_file_name,
                        file_type=row.source_file_type,
                        sha256=row.source_sha256,
                        uri=row.source_uri,
                    ),
                )
                for row in session.execute(statement)
            ]
