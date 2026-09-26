"""Hash de senhas com Argon2id (`argon2-cffi`, parâmetros padrão da biblioteca; ADR-016 § 3).

O hash sai no formato PHC (`$argon2id$v=19$m=...,t=...,p=...$<sal>$<hash>`), que carrega os
parâmetros: se a biblioteca mudar o padrão, os hashes antigos continuam verificáveis.
"""

from argon2 import PasswordHasher as _Argon2Hasher
from argon2.exceptions import InvalidHashError, VerificationError


class Argon2PasswordHasher:
    """Implementa a porta `PasswordHasher`."""

    def __init__(self) -> None:
        # O padrão do argon2-cffi é Argon2id (RFC 9106, perfil de baixa memória).
        self._hasher = _Argon2Hasher()

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except VerificationError, InvalidHashError:
            # `VerifyMismatchError` (senha errada) é subclasse de `VerificationError`.
            return False
