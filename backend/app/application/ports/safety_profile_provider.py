"""Porta dos parâmetros de segurança de uma configuração (RN-011, RN-013; ADR-025).

A TASK-051 liga esta porta ao catálogo (limite, faixa de atenção e `max_ground_slope_deg`). Até
lá, sem provedor, valem os padrões FICTÍCIOS de `SafetyProfile` (ADR-012).
"""

from typing import Protocol

from app.domain.value_objects.safety_profile import SafetyProfile


class SafetyProfileProvider(Protocol):
    """Devolve o perfil da configuração, ou `None` se ela não existe (vale o padrão)."""

    def get_safety_profile(self, configuration_id: str) -> SafetyProfile | None: ...
