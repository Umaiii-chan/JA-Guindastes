"""Porta de gravação e consulta das tabelas de carga (doc-fonte §§ 13 e 19; TASK-022).

A tabela é gravada normalizada, com os pontos (ADR-009), e com os metadados do arquivo de onde veio
(RF-008; RNF-005: versão e origem rastreáveis). O arquivo em si fica fora do banco (doc-fonte
§ 19.2): aqui só vão nome, tipo, hash e o local onde ele foi guardado.

Transições de status: a doc-fonte § 13.2 só sugere o fluxo `DRAFT → VALIDATED → ACTIVE →
SUPERSEDED` (ou `INVALID`), e quais transições são permitidas não está definido. Por isso
`change_status` não valida a transição. A única restrição garantida é a pedida na TASK-022: no
máximo uma tabela `ACTIVE` por configuração. Ativar uma tabela não rebaixa a anterior sozinho
(isso seria regra funcional não documentada): quem chama precisa marcar a antiga como `SUPERSEDED`
antes.
"""

import re
from dataclasses import dataclass
from typing import Protocol

from app.domain.entities.load_chart import LoadChart, LoadChartStatus

_SHA256_HEX = re.compile(r"[0-9a-f]{64}")


@dataclass(frozen=True)
class LoadChartSource:
    """Metadados do arquivo-fonte de uma tabela de carga (RF-008, RNF-005; doc-fonte § 19.2).

    - `file_name`: nome do arquivo como foi enviado;
    - `file_type`: tipo do arquivo (ex.: `text/csv`); o conjunto de valores não está fechado;
    - `sha256`: hash SHA-256 do conteúdo, em 64 dígitos hexadecimais minúsculos;
    - `uri`: onde o arquivo original foi guardado, ou `None` enquanto não há armazenamento de
      arquivos (`app.infrastructure.storage` ainda está vazio).
    """

    file_name: str
    file_type: str
    sha256: str
    uri: str | None = None

    def __post_init__(self) -> None:
        for name, value in (("file_name", self.file_name), ("file_type", self.file_type)):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} do arquivo-fonte deve ser informado")
        if not isinstance(self.sha256, str) or not _SHA256_HEX.fullmatch(self.sha256):
            raise ValueError("sha256 do arquivo-fonte deve ter 64 dígitos hexadecimais minúsculos")
        if self.uri is not None and (not isinstance(self.uri, str) or not self.uri.strip()):
            raise ValueError("uri do arquivo-fonte, se informada, não pode ser vazia")


@dataclass(frozen=True)
class StoredLoadChart:
    """Tabela de carga gravada, com os metadados de origem."""

    chart: LoadChart
    source: LoadChartSource


class LoadChartRepositoryError(Exception):
    """Base dos erros da porta de tabelas de carga."""


class LoadChartNotDraftError(LoadChartRepositoryError):
    """`save_draft` recebeu uma tabela que não está em `DRAFT`."""

    def __init__(self, status: LoadChartStatus) -> None:
        self.status = status
        super().__init__(f"só tabelas em DRAFT podem ser gravadas como novas, recebido {status}")


class LoadChartAlreadyExistsError(LoadChartRepositoryError):
    """Já existe uma tabela com o mesmo id."""

    def __init__(self, load_chart_id: str) -> None:
        self.load_chart_id = load_chart_id
        super().__init__(f"tabela de carga com id {load_chart_id!r} já existe")


class DuplicateLoadChartVersionError(LoadChartRepositoryError):
    """A configuração já tem uma tabela com a mesma versão (RN-005)."""

    def __init__(self, configuration_id: str, version: str) -> None:
        self.configuration_id = configuration_id
        self.version = version
        super().__init__(
            f"a configuração {configuration_id!r} já tem uma tabela de carga na versão {version!r}"
        )


class LoadChartConfigurationNotFoundError(LoadChartRepositoryError):
    """A configuração da tabela não existe (doc-fonte § 13.1: vínculo com configuração)."""

    def __init__(self, configuration_id: str) -> None:
        self.configuration_id = configuration_id
        super().__init__(f"configuração {configuration_id!r} não existe")


class LoadChartNotFoundError(LoadChartRepositoryError):
    """Não existe tabela com o id pedido."""

    def __init__(self, load_chart_id: str) -> None:
        self.load_chart_id = load_chart_id
        super().__init__(f"tabela de carga com id {load_chart_id!r} não existe")


class ActiveLoadChartConflictError(LoadChartRepositoryError):
    """A configuração já tem outra tabela `ACTIVE` (no máximo uma por configuração)."""

    def __init__(self, configuration_id: str) -> None:
        self.configuration_id = configuration_id
        super().__init__(f"a configuração {configuration_id!r} já tem uma tabela de carga ACTIVE")


class LoadChartRepository(Protocol):
    """Grava e consulta tabelas de carga com os pontos e os metadados de origem.

    Contrato de toda implementação:
    - `save_draft` grava uma tabela nova em `DRAFT` com todos os pontos, na ordem recebida, ou
      nada: levanta `LoadChartNotDraftError`, `LoadChartAlreadyExistsError`,
      `DuplicateLoadChartVersionError` ou `LoadChartConfigurationNotFoundError`;
    - `change_status` troca só o status, sem validar a transição; levanta
      `LoadChartNotFoundError` ou `ActiveLoadChartConflictError`;
    - `get_by_id` devolve a tabela gravada ou `None` quando o id não existe.
    """

    def save_draft(self, chart: LoadChart, source: LoadChartSource) -> None: ...

    def change_status(self, load_chart_id: str, new_status: LoadChartStatus) -> None: ...

    def get_by_id(self, load_chart_id: str) -> StoredLoadChart | None: ...
