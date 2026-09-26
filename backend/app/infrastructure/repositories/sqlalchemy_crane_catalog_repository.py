"""Catálogo de guindastes no PostgreSQL via SQLAlchemy (TASK-022).

Implementa `CraneCatalogRepository` e `CraneGeometryProvider`. Cada método abre a própria sessão e
a própria transação (a aplicação ainda não tem porta de unidade de trabalho).
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    CatalogReferenceNotFoundError,
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.infrastructure.database.base import Base
from app.infrastructure.database.models.catalog import (
    CraneConfigurationModel,
    CraneModel,
    ManufacturerModel,
)
from app.infrastructure.repositories._integrity import violated_constraint

_CRANE_MANUFACTURER_FK = "fk_cranes_manufacturer_id_manufacturers"
_CONFIGURATION_CRANE_FK = "fk_crane_configurations_crane_id_cranes"


def manufacturer_to_model(manufacturer: Manufacturer) -> ManufacturerModel:
    return ManufacturerModel(id=manufacturer.id, name=manufacturer.name)


def manufacturer_from_model(model: ManufacturerModel) -> Manufacturer:
    return Manufacturer(id=model.id, name=model.name)


def crane_to_model(crane: Crane) -> CraneModel:
    return CraneModel(
        id=crane.id, manufacturer_id=crane.manufacturer_id, model_name=crane.model_name
    )


def crane_from_model(model: CraneModel) -> Crane:
    return Crane(id=model.id, manufacturer_id=model.manufacturer_id, model_name=model.model_name)


def configuration_to_model(configuration: CraneConfiguration) -> CraneConfigurationModel:
    model = CraneConfigurationModel(
        id=configuration.id, crane_id=configuration.crane_id, name=configuration.name
    )
    geometry = configuration.geometry
    if geometry is not None:
        model.boom_pivot_offset_m = geometry.boom_pivot_offset_m
        model.boom_pivot_height_m = geometry.boom_pivot_height.meters
        model.boom_length_min_m = geometry.boom_length_min.meters
        model.boom_length_max_m = geometry.boom_length_max.meters
        model.boom_angle_min_deg = geometry.boom_angle_min.degrees
        model.boom_angle_max_deg = geometry.boom_angle_max.degrees
        model.cable_length_min_m = geometry.cable_length_min.meters
        model.cable_length_max_m = _meters_or_none(geometry.cable_length_max)
        model.turret_rotation_min_deg = _degrees_or_none(geometry.turret_rotation_min)
        model.turret_rotation_max_deg = _degrees_or_none(geometry.turret_rotation_max)
    return model


def configuration_from_model(model: CraneConfigurationModel) -> CraneConfiguration:
    return CraneConfiguration(
        id=model.id,
        crane_id=model.crane_id,
        name=model.name,
        geometry=geometry_from_model(model),
    )


def geometry_from_model(model: CraneConfigurationModel) -> CraneGeometry | None:
    """Monta a `CraneGeometry` das colunas da ficha, ou `None` se a ficha não foi cadastrada.

    A `CraneGeometry` revalida as faixas: um valor incoerente gravado direto no banco levanta
    `InvalidCraneGeometryError` em vez de virar uma ficha inválida em silêncio.
    """
    if (
        model.boom_pivot_offset_m is None
        or model.boom_pivot_height_m is None
        or model.boom_length_min_m is None
        or model.boom_length_max_m is None
        or model.boom_angle_min_deg is None
        or model.boom_angle_max_deg is None
        or model.cable_length_min_m is None
    ):
        return None
    return CraneGeometry(
        boom_pivot_offset_m=model.boom_pivot_offset_m,
        boom_pivot_height=Length(model.boom_pivot_height_m),
        boom_length_min=Length(model.boom_length_min_m),
        boom_length_max=Length(model.boom_length_max_m),
        boom_angle_min=Angle(model.boom_angle_min_deg),
        boom_angle_max=Angle(model.boom_angle_max_deg),
        cable_length_min=Length(model.cable_length_min_m),
        cable_length_max=_length_or_none(model.cable_length_max_m),
        turret_rotation_min=_angle_or_none(model.turret_rotation_min_deg),
        turret_rotation_max=_angle_or_none(model.turret_rotation_max_deg),
    )


def _meters_or_none(value: Length | None) -> float | None:
    return None if value is None else value.meters


def _degrees_or_none(value: Angle | None) -> float | None:
    return None if value is None else value.degrees


def _length_or_none(value: float | None) -> Length | None:
    return None if value is None else Length(value)


def _angle_or_none(value: float | None) -> Angle | None:
    return None if value is None else Angle(value)


class SqlAlchemyCraneCatalogRepository:
    """Implementa `CraneCatalogRepository` e `CraneGeometryProvider`."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def add_manufacturer(self, manufacturer: Manufacturer) -> None:
        self._add(manufacturer_to_model(manufacturer), "fabricante", manufacturer.id)

    def get_manufacturer(self, manufacturer_id: str) -> Manufacturer | None:
        with self._session_factory() as session:
            model = session.get(ManufacturerModel, manufacturer_id)
            return None if model is None else manufacturer_from_model(model)

    def add_crane(self, crane: Crane) -> None:
        self._add(
            crane_to_model(crane),
            "guindaste",
            crane.id,
            references={_CRANE_MANUFACTURER_FK: ("fabricante", crane.manufacturer_id)},
        )

    def get_crane(self, crane_id: str) -> Crane | None:
        with self._session_factory() as session:
            model = session.get(CraneModel, crane_id)
            return None if model is None else crane_from_model(model)

    def add_configuration(self, configuration: CraneConfiguration) -> None:
        self._add(
            configuration_to_model(configuration),
            "configuração",
            configuration.id,
            references={_CONFIGURATION_CRANE_FK: ("guindaste", configuration.crane_id)},
        )

    def get_configuration(self, configuration_id: str) -> CraneConfiguration | None:
        with self._session_factory() as session:
            model = session.get(CraneConfigurationModel, configuration_id)
            return None if model is None else configuration_from_model(model)

    def get_crane_geometry(self, configuration_id: str) -> CraneGeometry | None:
        """`CraneGeometryProvider`: `None` se a configuração não existe ou não tem ficha."""
        with self._session_factory() as session:
            model = session.get(CraneConfigurationModel, configuration_id)
            return None if model is None else geometry_from_model(model)

    def _add(
        self,
        model: Base,
        entity: str,
        entry_id: str,
        references: dict[str, tuple[str, str]] | None = None,
    ) -> None:
        try:
            with self._session_factory.begin() as session:
                session.add(model)
        except IntegrityError as error:
            constraint = violated_constraint(error)
            if constraint == f"pk_{model.__tablename__}":
                raise CatalogEntryAlreadyExistsError(entity, entry_id) from error
            if references and constraint in references:
                raise CatalogReferenceNotFoundError(*references[constraint]) from error
            raise
