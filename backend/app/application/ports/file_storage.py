"""Porta de armazenamento de arquivos fora do banco (`FileStoragePort`; doc-fonte §§ 19.2 e 22.1).

Guarda o arquivo-fonte de uma tabela de carga importada (RF-008; RNF-005: origem rastreável). O
banco guarda só a URI, o hash e os metadados; o arquivo fica aqui. Começa num diretório local
(`app.infrastructure.storage.local_file_storage`, TASK-031) e pode ser trocado por object storage
sem mudar os casos de uso (doc-fonte § 22.1).

O armazenamento é endereçado pelo conteúdo: o nome do arquivo guardado é o SHA-256 do conteúdo,
nunca um nome vindo de fora. Por isso:
- gravar o mesmo conteúdo duas vezes devolve a mesma URI e não reescreve nada (idempotente);
- um arquivo já guardado nunca é sobrescrito;
- nenhum nome enviado pelo usuário vira caminho (sem path traversal).
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StoredFile:
    """Arquivo guardado: onde está (`uri`, opaca, própria do adapter), o hash e o tamanho."""

    uri: str
    sha256: str
    size_bytes: int


class FileStorageError(Exception):
    """Base dos erros da porta de armazenamento de arquivos."""


class InvalidStoredFileUriError(FileStorageError):
    """A URI não é uma URI deste armazenamento (formato inválido ou fora do diretório)."""

    def __init__(self, uri: str) -> None:
        self.uri = uri
        super().__init__("URI de arquivo guardado inválida para este armazenamento")


class StoredFileNotFoundError(FileStorageError):
    """A URI é válida, mas não há arquivo guardado nela."""

    def __init__(self, uri: str) -> None:
        self.uri = uri
        super().__init__(f"não há arquivo guardado em {uri!r}")


class StoredFileIntegrityError(FileStorageError):
    """O arquivo já guardado com este hash tem outro conteúdo (corrompido); nada é sobrescrito."""

    def __init__(self, sha256: str) -> None:
        self.sha256 = sha256
        super().__init__(
            f"o arquivo guardado com sha256 {sha256} não confere com o conteúdo; "
            "ele não foi sobrescrito"
        )


class FileStoragePort(Protocol):
    """Guarda e lê arquivos pelo conteúdo.

    Contrato de toda implementação:
    - `save` guarda `content` sob o seu SHA-256 e devolve `StoredFile`; se já houver arquivo com o
      mesmo hash e o mesmo conteúdo, devolve a mesma URI sem reescrevê-lo; se houver com conteúdo
      diferente, levanta `StoredFileIntegrityError` sem sobrescrever;
    - `read` devolve o conteúdo guardado em `uri`; levanta `InvalidStoredFileUriError` para URI que
      não é deste armazenamento e `StoredFileNotFoundError` quando não há arquivo nela.
    """

    def save(self, content: bytes) -> StoredFile: ...

    def read(self, uri: str) -> bytes: ...
