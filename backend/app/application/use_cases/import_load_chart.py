"""Caso de uso `ImportLoadChart` (TASK-031; doc-fonte § 13; RF-006..RF-009, RNF-005, RNF-006).

Segue o fluxo da doc-fonte § 13: valida o conteúdo com `ValidateLoadChartImport` (qualquer
`LoadChartParser`: CSV ou XLSX) e, **só se não houver inconsistência**:

1. preserva o arquivo-fonte no `FileStoragePort` (RF-008; endereçado pelo SHA-256, nunca
   sobrescreve);
2. grava a tabela em `DRAFT`, com os pontos e os metadados de origem (nome, tipo, SHA-256, URI),
   pelo `LoadChartRepository` (RNF-005).

Importação inválida devolve o relatório (`InvalidLoadChartImport`) sem gravar nada, nem o arquivo
(RNF-006: não corromper dados válidos existentes). Versão já existente na mesma configuração
propaga `DuplicateLoadChartVersionError` (RN-005), um conflito explícito; configuração inexistente
propaga `LoadChartConfigurationNotFoundError`. Nesses dois casos o arquivo já foi guardado: fica
órfão, mas é inofensivo (endereçado pelo conteúdo, nunca sobrescrito, e reaproveitado se o mesmo
arquivo for importado de novo). A tabela nunca é ativada aqui (`ActivateLoadChart`).
"""

import hashlib
from dataclasses import dataclass

from app.application.ports.file_storage import FileStoragePort
from app.application.ports.load_chart_parser import LoadChartParser
from app.application.ports.load_chart_repository import (
    LoadChartRepository,
    LoadChartSource,
    StoredLoadChart,
)
from app.application.use_cases.validate_load_chart_import import (
    InvalidLoadChartImport,
    ValidateLoadChartImport,
    ValidLoadChartImport,
)
from app.domain.entities.load_chart import LoadChartStatus


@dataclass(frozen=True)
class ImportedLoadChart:
    """Importação gravada: a tabela em `DRAFT` com os metadados do arquivo-fonte guardado."""

    stored: StoredLoadChart

    @property
    def status(self) -> LoadChartStatus:
        return self.stored.chart.status


type ImportLoadChartResult = ImportedLoadChart | InvalidLoadChartImport


class StoredSourceMismatchError(Exception):
    """O armazenamento devolveu um hash diferente do calculado; a tabela não foi gravada."""

    def __init__(self, expected: str, actual: str) -> None:
        self.expected = expected
        self.actual = actual
        super().__init__(
            f"o armazenamento devolveu sha256 {actual}, mas o conteúdo tem sha256 {expected}"
        )


class ImportLoadChart:
    """Valida, preserva o arquivo-fonte e grava a tabela de carga em `DRAFT`."""

    def __init__(self, repository: LoadChartRepository, file_storage: FileStoragePort) -> None:
        self._repository = repository
        self._file_storage = file_storage

    def execute(
        self,
        content: bytes,
        *,
        parser: LoadChartParser,
        file_name: str,
        file_type: str,
        load_chart_id: str,
        version: str,
        configuration_id: str,
    ) -> ImportLoadChartResult:
        """Levanta `ValueError` se `file_name` ou `file_type` vierem vazios, antes de ler o arquivo.

        Erros do repositório (`DuplicateLoadChartVersionError`, `LoadChartAlreadyExistsError`,
        `LoadChartConfigurationNotFoundError`) e do armazenamento (`FileStorageError`) propagam.
        """
        sha256 = hashlib.sha256(content).hexdigest()
        # Valida nome e tipo antes de tudo: `LoadChartSource` recusa valores vazios.
        LoadChartSource(file_name=file_name, file_type=file_type, sha256=sha256)

        result = ValidateLoadChartImport(parser).execute(
            content,
            load_chart_id=load_chart_id,
            version=version,
            configuration_id=configuration_id,
        )
        match result:
            case InvalidLoadChartImport():
                return result
            case ValidLoadChartImport(chart=chart):
                stored_file = self._file_storage.save(content)
                if stored_file.sha256 != sha256:
                    raise StoredSourceMismatchError(expected=sha256, actual=stored_file.sha256)
                source = LoadChartSource(
                    file_name=file_name,
                    file_type=file_type,
                    sha256=sha256,
                    uri=stored_file.uri,
                )
                self._repository.save_draft(chart, source)
                return ImportedLoadChart(stored=StoredLoadChart(chart=chart, source=source))
