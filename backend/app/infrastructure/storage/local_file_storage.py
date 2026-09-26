"""`FileStoragePort` num diretório local (TASK-031; doc-fonte § 22.1: "volume local" no início).

Cada arquivo é guardado em `<diretório>/<sha256>` e a URI é `local://<sha256>`:

- o nome vem só do SHA-256 calculado aqui, nunca de um nome enviado, e a URI lida é conferida com
  uma expressão regular estrita e com o caminho resolvido dentro do diretório: sem path traversal;
- a gravação escreve num arquivo temporário do próprio diretório e o publica com `os.link`, que
  falha se o destino já existe: nunca sobrescreve, e ninguém vê um arquivo pela metade;
- gravar de novo o mesmo conteúdo devolve a mesma URI (idempotente); se o arquivo existente não
  conferir com o conteúdo, levanta `StoredFileIntegrityError` e o mantém como está.

O diretório vem da variável de ambiente `FILE_STORAGE_DIR` (`from_environment`) e é criado na
primeira gravação, não na construção.
"""

import hashlib
import os
import re
import tempfile
from collections.abc import Mapping
from pathlib import Path

from app.application.ports.file_storage import (
    InvalidStoredFileUriError,
    StoredFile,
    StoredFileIntegrityError,
    StoredFileNotFoundError,
)

FILE_STORAGE_DIR_ENV_VAR = "FILE_STORAGE_DIR"
LOCAL_URI_PREFIX = "local://"

_LOCAL_URI = re.compile(r"local://(?P<sha256>[0-9a-f]{64})")
_READ_CHUNK_BYTES = 64 * 1024


class LocalFileStorage:
    """Implementa `FileStoragePort` guardando os arquivos em `root`, pelo SHA-256."""

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root).resolve()

    @classmethod
    def from_environment(cls, environ: Mapping[str, str] | None = None) -> LocalFileStorage | None:
        """Armazenamento em `FILE_STORAGE_DIR`, ou `None` se a variável não está definida."""
        source = os.environ if environ is None else environ
        raw = source.get(FILE_STORAGE_DIR_ENV_VAR, "").strip()
        return cls(raw) if raw else None

    @property
    def root(self) -> Path:
        return self._root

    def save(self, content: bytes) -> StoredFile:
        sha256 = hashlib.sha256(content).hexdigest()
        stored = StoredFile(uri=LOCAL_URI_PREFIX + sha256, sha256=sha256, size_bytes=len(content))
        target = self._path_for(sha256)
        if target.exists():
            self._ensure_same_content(target, sha256)
            return stored

        self._root.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            dir=self._root, prefix=".tmp-", suffix=".part"
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "wb") as temporary_file:
                temporary_file.write(content)
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            try:
                os.link(temporary, target)
            except FileExistsError:
                # Outra gravação publicou o mesmo hash no meio do caminho: confere e reaproveita.
                self._ensure_same_content(target, sha256)
        finally:
            temporary.unlink(missing_ok=True)
        return stored

    def read(self, uri: str) -> bytes:
        match = _LOCAL_URI.fullmatch(uri) if isinstance(uri, str) else None
        if match is None:
            raise InvalidStoredFileUriError(str(uri))
        target = self._path_for(match["sha256"])
        try:
            return target.read_bytes()
        except FileNotFoundError:
            raise StoredFileNotFoundError(uri) from None

    def _path_for(self, sha256: str) -> Path:
        """Caminho do arquivo; defesa em profundidade: precisa ficar dentro do diretório."""
        target = (self._root / sha256).resolve()
        if target.parent != self._root:
            raise InvalidStoredFileUriError(LOCAL_URI_PREFIX + sha256)
        return target

    @staticmethod
    def _ensure_same_content(target: Path, sha256: str) -> None:
        digest = hashlib.sha256()
        with target.open("rb") as existing:
            while chunk := existing.read(_READ_CHUNK_BYTES):
                digest.update(chunk)
        if digest.hexdigest() != sha256:
            raise StoredFileIntegrityError(sha256)
