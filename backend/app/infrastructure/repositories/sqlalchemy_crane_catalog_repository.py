"""Catálogo de guindastes no PostgreSQL via SQLAlchemy (TASK-022).

Implementa `CraneCatalogRepository`, `CraneCatalogListing` (TASK-030), `CraneCatalogEditing`
(TASK-044), `CraneGeometryProvider`, `ConfigurationLoadRulesProvider` (TASK-046) e
`CraneLimitsProvider` (TASK-051).
Cada método abre a própria sessão e a própria transação (a aplicação ainda não tem porta de unidade
de trabalho).
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.application.ports.configuration_load_rules_provider import ConfigurationLoadRules
from app.application.ports.crane_catalog_repository import (
    CatalogEntryAlreadyExistsError,
    CatalogReferenceNotFoundError,
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.crane_limits import CraneLimits
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones
from app.infrastructure.database.base import Base
from app.infrastructure.database.models.catalog import (
    CraneConfigurationModel,
    CraneModel,
    ManufacturerModel,
)
from app.infrastructure.repositories._integrity import violated_constraint

_CRANE_MANUFACTURER_FK = "fk_cranes_manufacturer_id_manufacturers"
_CONFIGURATION_CRANE_FK = "fk_crane_configurations_crane_id_cranes"

GEOMETRY_COLUMNS = (
    "boom_pivot_offset_m",
    "boom_pivot_height_m",
    "boom_length_min_m",
    "boom_length_max_m",
    "boom_angle_min_deg",
    "boom_angle_max_deg",
    "cable_length_min_m",
    "cable_length_max_m",
    "turret_rotation_min_deg",
    "turret_rotation_max_deg",
)
"""Colunas da ficha técnica em `crane_configurations` (ADR-013 C-4)."""


def manufacturer_to_model(manufacturer: Manufacturer) -> ManufacturerModel:
    return ManufacturerModel(id=manufacturer.id, name=manufacturer.name)


def manufacturer_from_model(model: ManufacturerModel) -> Manufacturer:
    return Manufacturer(id=model.id, name=model.name)


def crane_to_model(crane: Crane) -> CraneModel:
    model = CraneModel(
        id=crane.id, manufacturer_id=crane.manufacturer_id, model_name=crane.model_name
    )
    write_limit_columns(model, crane.limits)
    return model


def write_limit_columns(model: CraneModel, limits: CraneLimits) -> None:
    """Grava os quatro limites do modelo (TASK-051)."""
    model.capacity_limit_percent = limits.capacity_limit_percent
    model.warning_band_percent = limits.warning_band_percent
    model.max_ground_slope_deg = limits.max_ground_slope_deg
    model.max_leveling_deg = limits.max_leveling_deg


def limits_from_model(model: CraneModel) -> CraneLimits:
    return CraneLimits(
        capacity_limit_percent=model.capacity_limit_percent,
        warning_band_percent=model.warning_band_percent,
        max_ground_slope_deg=model.max_ground_slope_deg,
        max_leveling_deg=model.max_leveling_deg,
    )


def crane_from_model(model: CraneModel) -> Crane:
    return Crane(
        id=model.id,
        manufacturer_id=model.manufacturer_id,
        model_name=model.model_name,
        limits=limits_from_model(model),
    )


def configuration_to_model(configuration: CraneConfiguration) -> CraneConfigurationModel:
    model = CraneConfigurationModel(
        id=configuration.id,
        crane_id=configuration.crane_id,
        name=configuration.name,
        rotation_zones=rotation_zones_to_json(configuration.rotation_zones),
        hook_block_weight_kg=_kilograms_or_none(configuration.hook_block_weight),
    )
    if configuration.geometry is not None:
        write_geometry_columns(model, configuration.geometry)
    return model


def rotation_zones_to_json(zones: RotationZones | None) -> list[dict[str, Any]] | None:
    """Zonas de giro como lista JSON, na ordem declarada (TASK-046); `None` sem zonas."""
    if zones is None:
        return None
    return [
        {
            "code": zone.code,
            "name": zone.name,
            "start_deg": zone.start_deg,
            "end_deg": zone.end_deg,
        }
        for zone in zones.zones
    ]


def rotation_zones_from_json(value: list[dict[str, Any]] | None) -> RotationZones | None:
    """Monta as `RotationZones` da coluna JSON; o domínio revalida a cobertura de 360°.

    Um valor incoerente gravado direto no banco levanta `InvalidRotationZonesError` (ou
    `KeyError`/`TypeError` se faltar campo) em vez de virar zonas inválidas em silêncio.
    """
    if value is None:
        return None
    return RotationZones(
        zones=tuple(
            RotationZone(
                code=item["code"],
                name=item["name"],
                start_deg=item["start_deg"],
                end_deg=item["end_deg"],
            )
            for item in value
        )
    )


def write_geometry_columns(model: CraneConfigurationModel, geometry: CraneGeometry | None) -> None:
    """Grava as colunas da ficha técnica; com `None`, todas ficam nulas (sem ficha).

    Escreve todas as colunas, inclusive as opcionais: substituir a ficha (TASK-044) não deixa
    sobrar um limite de giro ou um cabo máximo da ficha anterior.
    """
    if geometry is None:
        for column in GEOMETRY_COLUMNS:
            setattr(model, column, None)
        return
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


def configuration_from_model(model: CraneConfigurationModel) -> CraneConfiguration:
    return CraneConfiguration(
        id=model.id,
        crane_id=model.crane_id,
        name=model.name,
        geometry=geometry_from_model(model),
        rotation_zones=rotation_zones_from_json(model.rotation_zones),
        hook_block_weight=(
            None if model.hook_block_weight_kg is None else Mass(model.hook_block_weight_kg)
        ),
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


def _kilograms_or_none(value: Mass | None) -> float | None:
    return None if value is None else value.kilograms


def _meters_or_none(value: Length | None) -> float | None:
    return None if value is None else value.meters


def _degrees_or_none(value: Angle | None) -> float | None:
    return None if value is None else value.degrees


def _length_or_none(value: float | None) -> Length | None:
    return None if value is None else Length(value)


def _angle_or_none(value: float | None) -> Angle | None:
    return None if value is None else Angle(value)


class SqlAlchemyCraneCatalogRepository:
    """Implementa `CraneCatalogStore` (gravação, leitura, listagem e edição) e
    `CraneGeometryProvider`."""

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

    def get_load_rules(self, configuration_id: str) -> ConfigurationLoadRules | None:
        """`ConfigurationLoadRulesProvider` (TASK-046): zonas de giro e peso do gancho, ou `None`
        se a configuração não existe."""
        with self._session_factory() as session:
            model = session.get(CraneConfigurationModel, configuration_id)
            if model is None:
                return None
            return ConfigurationLoadRules(
                rotation_zones=rotation_zones_from_json(model.rotation_zones),
                hook_block_weight=(
                    None if model.hook_block_weight_kg is None else Mass(model.hook_block_weight_kg)
                ),
            )

    def get_crane_limits(self, configuration_id: str) -> CraneLimits | None:
        """`CraneLimitsProvider` (TASK-051): limites do guindaste da configuração, ou `None` se a
        configuração não existe."""
        statement = (
            select(CraneModel)
            .join(CraneConfigurationModel, CraneConfigurationModel.crane_id == CraneModel.id)
            .where(CraneConfigurationModel.id == configuration_id)
        )
        with self._session_factory() as session:
            model = session.scalars(statement).first()
            return None if model is None else limits_from_model(model)

    def list_manufacturers(self) -> list[Manufacturer]:
        """`CraneCatalogListing` (TASK-030): todos, por nome e id."""
        statement = select(ManufacturerModel).order_by(ManufacturerModel.name, ManufacturerModel.id)
        with self._session_factory() as session:
            return [manufacturer_from_model(model) for model in session.scalars(statement)]

    def list_cranes(self, manufacturer_id: str | None = None) -> list[Crane]:
        """`CraneCatalogListing` (TASK-030): todos ou os de um fabricante, por modelo e id."""
        statement = select(CraneModel).order_by(CraneModel.model_name, CraneModel.id)
        if manufacturer_id is not None:
            statement = statement.where(CraneModel.manufacturer_id == manufacturer_id)
        with self._session_factory() as session:
            return [crane_from_model(model) for model in session.scalars(statement)]

    def list_configurations(self, crane_id: str) -> list[CraneConfiguration]:
        """`CraneCatalogListing` (TASK-030): as de um guindaste, por nome e id."""
        statement = (
            select(CraneConfigurationModel)
            .where(CraneConfigurationModel.crane_id == crane_id)
            .order_by(CraneConfigurationModel.name, CraneConfigurationModel.id)
        )
        with self._session_factory() as session:
            return [configuration_from_model(model) for model in session.scalars(statement)]

    def update_manufacturer(self, manufacturer: Manufacturer) -> bool:
        """`CraneCatalogEditing` (TASK-044): troca o nome; `False` se o id não existe."""
        with self._session_factory.begin() as session:
            model = session.get(ManufacturerModel, manufacturer.id, with_for_update=True)
            if model is None:
                return False
            model.name = manufacturer.name
            return True

    def update_crane(self, crane: Crane) -> bool:
        """`CraneCatalogEditing` (TASK-044, TASK-051): troca o modelo e os limites; o fabricante
        não muda."""
        with self._session_factory.begin() as session:
            model = session.get(CraneModel, crane.id, with_for_update=True)
            if model is None:
                return False
            model.model_name = crane.model_name
            write_limit_columns(model, crane.limits)
            return True

    def update_configuration(self, configuration: CraneConfiguration) -> bool:
        """`CraneCatalogEditing` (TASK-044): troca o nome e a ficha inteira; o guindaste não muda.

        Todas as colunas da ficha vão num único `UPDATE`, então as restrições `CHECK` ("todos ou
        nenhum", limites de giro juntos) valem para a ficha nova inteira, nunca pela metade.
        """
        with self._session_factory.begin() as session:
            model = session.get(CraneConfigurationModel, configuration.id, with_for_update=True)
            if model is None:
                return False
            model.name = configuration.name
            write_geometry_columns(model, configuration.geometry)
            model.rotation_zones = rotation_zones_to_json(configuration.rotation_zones)
            model.hook_block_weight_kg = _kilograms_or_none(configuration.hook_block_weight)
            return True

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
