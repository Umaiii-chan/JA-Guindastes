# FICTÍCIO — zonas de giro inventadas só para testar o mecanismo (ADR-012).
#
# Imitam o formato "frontal 110° + lateral e traseira 250°" de uma tabela de fabricante, mas nenhum
# ângulo, nome ou peso daqui vem de tabela ou ficha técnica real.
"""Zonas de giro FICTÍCIAS para os testes da TASK-046."""

from typing import Any

from app.domain.value_objects.rotation_zone import RotationZone, RotationZones

ZONA_FRONTAL_FICTICIA = "FRONTAL"
ZONA_LATERAL_TRASEIRA_FICTICIA = "LATERAL_TRASEIRA"
GANCHO_FICTICIO_KG = 200.0


def zonas_ficticias() -> RotationZones:
    """Frontal de 305° a 55° (110°) e lateral/traseira de 55° a 305° (250°), FICTÍCIAS."""
    return RotationZones(
        zones=(
            RotationZone(ZONA_FRONTAL_FICTICIA, "Frontal FICTÍCIA", 305.0, 55.0),
            RotationZone(
                ZONA_LATERAL_TRASEIRA_FICTICIA, "Lateral e traseira FICTÍCIA", 55.0, 305.0
            ),
        )
    )


def zonas_payload_ficticio() -> list[dict[str, Any]]:
    """As mesmas zonas FICTÍCIAS no formato da API."""
    return [
        {
            "code": ZONA_FRONTAL_FICTICIA,
            "name": "Frontal FICTÍCIA",
            "start_deg": 305.0,
            "end_deg": 55.0,
        },
        {
            "code": ZONA_LATERAL_TRASEIRA_FICTICIA,
            "name": "Lateral e traseira FICTÍCIA",
            "start_deg": 55.0,
            "end_deg": 305.0,
        },
    ]
