"""`LocalFileStorage` (TASK-031; RF-008, RNF-005; P-008: path traversal). Conteúdos FICTÍCIOS."""

import hashlib
from pathlib import Path

import pytest

from app.application.ports.file_storage import (
    FileStoragePort,
    InvalidStoredFileUriError,
    StoredFileIntegrityError,
    StoredFileNotFoundError,
)
from app.infrastructure.storage.local_file_storage import (
    FILE_STORAGE_DIR_ENV_VAR,
    LocalFileStorage,
)

CONTEUDO_FICTICIO = b"boom_length_m,working_radius_m,max_capacity_kg\n10,3,9000\n"
SHA_FICTICIO = hashlib.sha256(CONTEUDO_FICTICIO).hexdigest()


@pytest.fixture
def root(tmp_path: Path) -> Path:
    return tmp_path / "armazenamento"


@pytest.fixture
def storage(root: Path) -> LocalFileStorage:
    return LocalFileStorage(root)


def test_satisfies_the_port(storage: LocalFileStorage) -> None:
    port: FileStoragePort = storage
    assert port is storage


def test_directory_is_created_only_on_the_first_save(root: Path, storage: LocalFileStorage) -> None:
    assert not root.exists()
    storage.save(CONTEUDO_FICTICIO)
    assert root.is_dir()


def test_save_names_the_file_by_sha256_and_returns_the_metadata(
    root: Path, storage: LocalFileStorage
) -> None:
    stored = storage.save(CONTEUDO_FICTICIO)

    assert stored.sha256 == SHA_FICTICIO
    assert stored.uri == f"local://{SHA_FICTICIO}"
    assert stored.size_bytes == len(CONTEUDO_FICTICIO)
    assert sorted(path.name for path in root.iterdir()) == [SHA_FICTICIO]
    assert (root / SHA_FICTICIO).read_bytes() == CONTEUDO_FICTICIO


def test_read_returns_the_saved_content(storage: LocalFileStorage) -> None:
    stored = storage.save(CONTEUDO_FICTICIO)
    assert storage.read(stored.uri) == CONTEUDO_FICTICIO


def test_saving_the_same_content_twice_is_idempotent_and_does_not_rewrite(
    root: Path, storage: LocalFileStorage
) -> None:
    first = storage.save(CONTEUDO_FICTICIO)
    target = root / SHA_FICTICIO
    modified_before = target.stat().st_mtime_ns

    second = storage.save(CONTEUDO_FICTICIO)

    assert second == first
    assert target.stat().st_mtime_ns == modified_before
    assert sorted(path.name for path in root.iterdir()) == [SHA_FICTICIO]


def test_empty_content_is_stored_like_any_other(storage: LocalFileStorage) -> None:
    stored = storage.save(b"")
    assert storage.read(stored.uri) == b""


def test_existing_file_with_other_content_is_never_overwritten(
    root: Path, storage: LocalFileStorage
) -> None:
    root.mkdir(parents=True)
    corrupted = root / SHA_FICTICIO
    corrupted.write_bytes(b"conteudo corrompido FICTICIO")

    with pytest.raises(StoredFileIntegrityError):
        storage.save(CONTEUDO_FICTICIO)

    assert corrupted.read_bytes() == b"conteudo corrompido FICTICIO"


def test_no_temporary_file_is_left_behind(root: Path, storage: LocalFileStorage) -> None:
    storage.save(CONTEUDO_FICTICIO)
    storage.save(b"outro conteudo FICTICIO")
    assert all(not path.name.startswith(".tmp-") for path in root.iterdir())


@pytest.mark.parametrize(
    "uri",
    [
        "local://../segredo",
        f"local://../{SHA_FICTICIO}",
        f"local://{SHA_FICTICIO}/../../segredo",
        f"local://sub/{SHA_FICTICIO}",
        f"local://{SHA_FICTICIO.upper()}",
        f"local://{SHA_FICTICIO[:-1]}",
        f"local://{SHA_FICTICIO}\n",
        f"file://{SHA_FICTICIO}",
        "/etc/passwd",
        "..\\..\\windows\\win.ini",
        "",
    ],
)
def test_read_rejects_uris_that_are_not_from_this_storage(
    storage: LocalFileStorage, uri: str
) -> None:
    with pytest.raises(InvalidStoredFileUriError):
        storage.read(uri)


def test_read_of_a_missing_file_raises_not_found(storage: LocalFileStorage) -> None:
    with pytest.raises(StoredFileNotFoundError):
        storage.read(f"local://{SHA_FICTICIO}")


def test_from_environment_uses_the_directory_or_returns_none(tmp_path: Path) -> None:
    configured = LocalFileStorage.from_environment({FILE_STORAGE_DIR_ENV_VAR: str(tmp_path)})
    assert configured is not None
    assert configured.root == tmp_path.resolve()
    assert LocalFileStorage.from_environment({}) is None
    assert LocalFileStorage.from_environment({FILE_STORAGE_DIR_ENV_VAR: "   "}) is None
