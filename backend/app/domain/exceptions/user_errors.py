"""Erros de validação de usuário (ADR-016 § 2; TASK-038).

Nenhuma mensagem repete a senha recebida: só o motivo e os limites.
"""

from app.domain.exceptions.domain_errors import DomainError


class InvalidUserError(DomainError):
    """Um campo do usuário viola uma regra do ADR-016 § 2.

    `field` é o nome do campo no domínio (`username`, `display_name` ou `password`); a apresentação
    o traduz para o nome do contrato da API.
    """

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)


class InvalidUsernameError(InvalidUserError):
    def __init__(self, message: str) -> None:
        super().__init__("username", message)


class InvalidDisplayNameError(InvalidUserError):
    def __init__(self, message: str) -> None:
        super().__init__("display_name", message)


class InvalidPasswordError(InvalidUserError):
    def __init__(self, message: str) -> None:
        super().__init__("password", message)


class LastAdminError(DomainError):
    """A mudança deixaria o sistema sem nenhum admin ativo (ADR-016 § 2)."""

    def __init__(self) -> None:
        super().__init__("o sistema precisa de pelo menos um admin ativo")
