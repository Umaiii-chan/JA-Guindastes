"""Exceções de domínio da carga da simulação (`Load`, RF-011).

Ficam num módulo próprio, como as da geometria, mas herdam de `DomainError`. Valores não
numéricos, não finitos ou negativos continuam sendo `InvalidQuantityError`, levantado por
`Length`, `Mass` e pela validação numérica compartilhada.
"""

from app.domain.exceptions.domain_errors import DomainError


class InvalidLoadError(DomainError):
    """A carga viola um invariante de domínio.

    Exemplos: peso ou dimensão igual a zero, descrição vazia, campo com tipo errado, centro de
    gravidade fora da caixa definida pelas dimensões.
    """
