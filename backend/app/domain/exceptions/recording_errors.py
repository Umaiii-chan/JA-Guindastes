"""Erros das gravações de simulação (ADR-027; TASK-057)."""

from app.domain.exceptions.domain_errors import DomainError


class InvalidRecordingError(DomainError):
    """Um campo da gravação viola uma regra do ADR-027.

    `field` é o nome do campo no domínio; a apresentação o traduz para o nome do contrato da API.
    """

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)


class RecordingTooLongError(DomainError):
    """A duração passa do limite de gravação (constante PROVISÓRIA, ADR-027)."""


class RecordingTooLargeError(DomainError):
    """O conteúdo (quadros + cenário) passa do limite de tamanho (constante PROVISÓRIA, ADR-027)."""
