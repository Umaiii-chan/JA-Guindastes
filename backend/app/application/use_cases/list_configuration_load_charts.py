"""Caso de uso `ListConfigurationLoadCharts` (TASK-044; ADR-009; RN-001, RN-005).

Lista as versões de tabela de carga de uma configuração, com a tabela `ACTIVE` (no máximo uma por
configuração, garantida no banco; TASK-022). Atende à linha do tempo de versões e ao detalhe do
catálogo.

Ordem: não há coluna de data de criação em `load_charts`, e nenhuma migration foi criada para isso
(TASK-044, CA-3). Por isso a ordem **não é** a da importação: é a da versão, da maior para a menor,
em ordem natural (`version_sort_key`), e, na mesma versão, pelo id da tabela, também decrescente.
Na prática, "v10" vem antes de "v9", que vem antes de "v2". Se a versão não crescer a cada
importação, a lista não reflete a ordem em que as tabelas foram importadas.
"""

import re
from dataclasses import dataclass

from app.application.ports.crane_catalog_repository import CraneCatalogRepository
from app.application.ports.load_chart_listing import LoadChartListing, LoadChartSummary
from app.application.use_cases.crane_catalog import (
    CONFIGURATION_ENTITY,
    CatalogEntryNotFoundError,
)
from app.domain.entities.load_chart import LoadChartStatus

_DIGITS = re.compile(r"([0-9]+)")

type VersionSortKey = tuple[tuple[int, int, str], ...]


def version_sort_key(version: str) -> VersionSortKey:
    """Chave de ordem natural da versão: trechos de dígitos comparados como números.

    O texto é comparado sem diferenciar maiúsculas e sem os espaços das pontas. Num mesmo trecho,
    número vem antes de texto; uma versão que é prefixo de outra vem antes dela ("v2" < "v2.1").
    """
    key: list[tuple[int, int, str]] = []
    for index, chunk in enumerate(_DIGITS.split(version.strip().casefold())):
        if not chunk:
            continue
        if index % 2 == 1:  # `split` com grupo: os índices ímpares são os trechos de dígitos
            key.append((0, int(chunk), chunk))
        else:
            key.append((1, 0, chunk))
    return tuple(key)


@dataclass(frozen=True)
class ConfigurationLoadCharts:
    """Tabelas de uma configuração, na ordem do caso de uso, e o id da `ACTIVE` (ou `None`)."""

    items: tuple[LoadChartSummary, ...]
    active_load_chart_id: str | None


class ListConfigurationLoadCharts:
    """Lista as tabelas de carga de uma configuração existente.

    Levanta `CatalogEntryNotFoundError` se a configuração não existe (em vez de lista vazia, para
    não confundir "sem tabelas" com "configuração inexistente").
    """

    def __init__(self, catalog: CraneCatalogRepository, listing: LoadChartListing) -> None:
        self._catalog = catalog
        self._listing = listing

    def execute(self, configuration_id: str) -> ConfigurationLoadCharts:
        if self._catalog.get_configuration(configuration_id) is None:
            raise CatalogEntryNotFoundError(CONFIGURATION_ENTITY, configuration_id)
        items = sorted(
            self._listing.list_by_configuration(configuration_id),
            key=lambda item: (version_sort_key(item.version), item.load_chart_id),
            reverse=True,
        )
        active = next(
            (item.load_chart_id for item in items if item.status is LoadChartStatus.ACTIVE), None
        )
        return ConfigurationLoadCharts(items=tuple(items), active_load_chart_id=active)
