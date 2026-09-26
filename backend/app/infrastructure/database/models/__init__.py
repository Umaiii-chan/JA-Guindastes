"""Modelos ORM (TASK-022). Importar este pacote registra todas as tabelas em `Base.metadata`.

O `backend/alembic/env.py` importa este pacote para que o autogenerate enxergue as tabelas.
"""

from app.infrastructure.database.models.catalog import (
    CraneConfigurationModel,
    CraneModel,
    ManufacturerModel,
)
from app.infrastructure.database.models.load_chart import LoadChartModel, LoadChartPointModel

__all__ = [
    "CraneConfigurationModel",
    "CraneModel",
    "LoadChartModel",
    "LoadChartPointModel",
    "ManufacturerModel",
]
