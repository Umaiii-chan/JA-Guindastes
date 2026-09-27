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

Zona de giro (TASK-046; ADR-018): com o catálogo (`CraneCatalogRepository`), a zona informada é
conferida **antes** de ler o arquivo, contra as zonas da configuração:

1. configuração inexistente → `LoadChartConfigurationNotFoundError`;
2. configuração com zonas e sem zona informada → `RotationZoneRequiredError`;
3. zona que não existe na configuração → `UnknownRotationZoneError`;
4. configuração sem zonas e zona informada → `RotationZoneNotAllowedError`.

Sem o catálogo, a configuração é tratada como sem zonas (só em composições de teste). A zona vai
para a tabela gravada (`LoadChart.rotation_zone_code`).
"""

import dataclasses
import hashlib
from dataclasses import dataclass

from app.application.ports.crane_catalog_repository import CraneCatalogRepository
from app.application.ports.file_storage import FileStoragePort
from app.application.ports.load_chart_parser import LoadChartParser
from app.application.ports.load_chart_repository import (
    LoadChartConfigurationNotFoundError,
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


class RotationZoneImportError(Exception):
    """A zona de giro informada na importação não combina com as zonas da configuração."""

    def __init__(self, configuration_id: str, rotation_zone_code: str | None, message: str) -> None:
        self.configuration_id = configuration_id
        self.rotation_zone_code = rotation_zone_code
        super().__init__(message)


class RotationZoneRequiredError(RotationZoneImportError):
    """A configuração tem zonas de giro, e a importação não informou a zona."""

    def __init__(self, configuration_id: str, codes: tuple[str, ...]) -> None:
        self.codes = codes
        super().__init__(
            configuration_id,
            None,
            f"a configuração {configuration_id!r} tem zonas de giro ({', '.join(codes)}); "
            "informe rotation_zone_code",
        )


class UnknownRotationZoneError(RotationZoneImportError):
    """A zona informada não existe na configuração."""

    def __init__(
        self, configuration_id: str, rotation_zone_code: str, codes: tuple[str, ...]
    ) -> None:
        self.codes = codes
        super().__init__(
            configuration_id,
            rotation_zone_code,
            f"a configuração {configuration_id!r} não tem a zona de giro {rotation_zone_code!r}; "
            f"zonas: {', '.join(codes)}",
        )


class RotationZoneNotAllowedError(RotationZoneImportError):
    """A configuração não tem zonas de giro, e a importação informou uma zona."""

    def __init__(self, configuration_id: str, rotation_zone_code: str) -> None:
        super().__init__(
            configuration_id,
            rotation_zone_code,
            f"a configuração {configuration_id!r} não tem zonas de giro; não informe "
            f"rotation_zone_code (recebido {rotation_zone_code!r})",
        )


class ImportLoadChart:
    """Valida, preserva o arquivo-fonte e grava a tabela de carga em `DRAFT`."""

    def __init__(
        self,
        repository: LoadChartRepository,
        file_storage: FileStoragePort,
        catalog: CraneCatalogRepository | None = None,
    ) -> None:
        self._repository = repository
        self._file_storage = file_storage
        self._catalog = catalog

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
        rotation_zone_code: str | None = None,
    ) -> ImportLoadChartResult:
        """Levanta `ValueError` se `file_name` ou `file_type` vierem vazios, antes de ler o arquivo.

        Com o catálogo, a zona é conferida antes de ler o arquivo (`RotationZoneImportError` e
        `LoadChartConfigurationNotFoundError`; ver o módulo). Erros do repositório
        (`DuplicateLoadChartVersionError`, `LoadChartAlreadyExistsError`,
        `LoadChartConfigurationNotFoundError`) e do armazenamento (`FileStorageError`) propagam.
        """
        sha256 = hashlib.sha256(content).hexdigest()
        # Valida nome e tipo antes de tudo: `LoadChartSource` recusa valores vazios.
        LoadChartSource(file_name=file_name, file_type=file_type, sha256=sha256)
        self._require_rotation_zone(configuration_id, rotation_zone_code)

        result = ValidateLoadChartImport(parser).execute(
            content,
            load_chart_id=load_chart_id,
            version=version,
            configuration_id=configuration_id,
        )
        match result:
            case InvalidLoadChartImport():
                return result
            case ValidLoadChartImport(chart=validated):
                chart = dataclasses.replace(validated, rotation_zone_code=rotation_zone_code)
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

    def _require_rotation_zone(self, configuration_id: str, rotation_zone_code: str | None) -> None:
        zones = None
        # Id em branco fica para o relatório da validação (MISSING_METADATA), como antes.
        if self._catalog is not None and configuration_id.strip():
            configuration = self._catalog.get_configuration(configuration_id)
            if configuration is None:
                raise LoadChartConfigurationNotFoundError(configuration_id)
            zones = configuration.rotation_zones
        if zones is None:
            if rotation_zone_code is not None:
                raise RotationZoneNotAllowedError(configuration_id, rotation_zone_code)
            return
        if rotation_zone_code is None:
            raise RotationZoneRequiredError(configuration_id, zones.codes)
        if zones.by_code(rotation_zone_code) is None:
            raise UnknownRotationZoneError(configuration_id, rotation_zone_code, zones.codes)
