"""Modelos ORM (TASK-022, TASK-038). Importar este pacote registra as tabelas em `Base.metadata`.

O `backend/alembic/env.py` importa este pacote para que o autogenerate enxergue as tabelas.
"""

from app.infrastructure.database.models.accessory import AccessoryModel
from app.infrastructure.database.models.catalog import (
    CraneConfigurationModel,
    CraneModel,
    ManufacturerModel,
)
from app.infrastructure.database.models.load_chart import LoadChartModel, LoadChartPointModel
from app.infrastructure.database.models.simulation_recording import SimulationRecordingModel
from app.infrastructure.database.models.user import AppUserModel, UserSessionModel

__all__ = [
    "AccessoryModel",
    "SimulationRecordingModel",
    "AppUserModel",
    "CraneConfigurationModel",
    "CraneModel",
    "LoadChartModel",
    "LoadChartPointModel",
    "ManufacturerModel",
    "UserSessionModel",
]
