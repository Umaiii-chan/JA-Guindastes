"""Porta do hash de senhas (ADR-016 § 3: Argon2id com os parâmetros padrão da biblioteca)."""

from typing import Protocol


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str:
        """Hash novo, com sal aleatório, em formato textual que carrega os parâmetros."""
        ...

    def verify(self, password_hash: str, password: str) -> bool:
        """`True` se `password` confere com `password_hash`.

        Nunca levanta exceção por senha errada ou hash malformado: devolve `False`.
        """
        ...
