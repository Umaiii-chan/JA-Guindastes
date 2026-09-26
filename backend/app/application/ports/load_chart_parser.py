"""Porta de leitura de uma tabela de carga importada (doc-fonte § 13; RF-006, RF-009, RNF-006).

Cada formato de arquivo (CSV hoje; XLSX no futuro) é um adapter em `app.infrastructure.importers`
que implementa `LoadChartParser`. O caso de uso só conhece esta porta e os tipos do relatório
definidos aqui, então as validações que não dependem do formato (pontos conflitantes, tabela sem
pontos, metadados) valem para qualquer adapter.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from app.domain.entities.load_chart_point import LoadChartPoint


class ImportIssueCode(StrEnum):
    """Motivo, legível por máquina, de uma inconsistência na importação (RNF-006).

    A mensagem para o usuário fica em `ImportIssue.message`; o texto definitivo das mensagens
    ainda não foi definido pela pessoa responsável.
    """

    # Arquivo
    INVALID_ENCODING = "INVALID_ENCODING"
    """O conteúdo não é texto no encoding esperado pelo formato."""
    MALFORMED_FILE = "MALFORMED_FILE"
    """O arquivo não pôde ser lido até o fim (ex.: aspas não fechadas no CSV)."""
    EMPTY_FILE = "EMPTY_FILE"
    """Não há conteúdo nenhum, nem cabeçalho."""
    UNSUPPORTED_DELIMITER = "UNSUPPORTED_DELIMITER"
    """O arquivo parece usar outro separador de campos que não o do formato."""

    # Cabeçalho
    MISSING_COLUMN = "MISSING_COLUMN"
    """Coluna obrigatória ausente (doc-fonte § 13.1: campos obrigatórios presentes)."""
    DUPLICATE_COLUMN = "DUPLICATE_COLUMN"
    """A mesma coluna aparece mais de uma vez no cabeçalho."""
    UNKNOWN_COLUMN = "UNKNOWN_COLUMN"
    """Coluna que o formato não conhece."""
    MISSING_UNIT = "MISSING_UNIT"
    """Coluna conhecida sem sufixo de unidade (RN-006)."""
    UNRECOGNIZED_UNIT = "UNRECOGNIZED_UNIT"
    """Coluna conhecida com unidade não reconhecida (doc-fonte § 13.1: unidades reconhecidas)."""

    # Linha de dados
    WRONG_FIELD_COUNT = "WRONG_FIELD_COUNT"
    """A linha tem número de campos diferente do cabeçalho."""
    EMPTY_VALUE = "EMPTY_VALUE"
    """Valor obrigatório vazio."""
    INVALID_NUMBER = "INVALID_NUMBER"
    """Valor que não é número no formato esperado (doc-fonte § 13.1: valores numéricos válidos)."""
    NON_FINITE_NUMBER = "NON_FINITE_NUMBER"
    """`NaN` ou infinito."""
    NEGATIVE_VALUE = "NEGATIVE_VALUE"
    """Comprimento, raio ou capacidade negativos (doc-fonte § 13.1: capacidades não negativas)."""

    # Tabela como um todo (validados pelo caso de uso, para qualquer formato)
    CONFLICTING_POINTS = "CONFLICTING_POINTS"
    """Mesmo `boom_length` e `working_radius` com capacidades diferentes (doc-fonte § 13.1)."""
    NO_POINTS = "NO_POINTS"
    """A importação não produziu nenhum ponto válido."""
    MISSING_METADATA = "MISSING_METADATA"
    """Id, versão ou configuração da tabela não informados (RN-001, RN-005; doc-fonte § 13.1)."""


@dataclass(frozen=True)
class ImportIssue:
    """Uma inconsistência do relatório de importação (RNF-006; doc-fonte § 13.1).

    `line` é o número da linha no arquivo, começando em 1 (`None` quando o problema é do arquivo
    ou da tabela como um todo). `column` é o nome da coluna como está no arquivo, ou o nome
    esperado quando ela falta (`None` quando o problema não é de uma coluna).
    """

    code: ImportIssueCode
    message: str
    line: int | None = None
    column: str | None = None


@dataclass(frozen=True)
class ParsedLoadChartPoint:
    """Ponto lido do arquivo, já em unidades internas, com a linha de origem."""

    line: int
    point: LoadChartPoint


@dataclass(frozen=True)
class LoadChartParseResult:
    """Pontos válidos e inconsistências encontradas, na ordem do arquivo."""

    points: tuple[ParsedLoadChartPoint, ...]
    issues: tuple[ImportIssue, ...]


class LoadChartParser(Protocol):
    """Lê o conteúdo de um arquivo de tabela de carga (doc-fonte § 13).

    Contrato de toda implementação:
    - não levanta exceção por problema no conteúdo: devolve os pontos válidos **e** todas as
      inconsistências que conseguir encontrar, cada uma com linha, coluna e motivo (RNF-006);
    - devolve os pontos em unidades internas, como `LoadChartPoint` (RN-006);
    - uma linha com qualquer inconsistência não gera ponto;
    - não verifica regras que envolvem mais de uma linha (pontos conflitantes, tabela vazia) nem os
      metadados da tabela: isso é do caso de uso, para valer igual em todos os formatos.
    """

    def parse(self, content: bytes) -> LoadChartParseResult: ...
