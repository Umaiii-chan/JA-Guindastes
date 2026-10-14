"""Erros de validação de cenário (TASK-052; ADR-023)."""

from app.domain.exceptions.domain_errors import DomainError


class InvalidScenarioError(DomainError):
    """Um campo do cenário viola uma regra do ADR-023.

    `field` é o caminho do campo no JSON do cenário (por exemplo, `spec.terrain.features[0]`).
    """

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)
