"""Gravação de uma simulação (ADR-027; TASK-057; RN-005).

Uma gravação guarda a sequência de quadros do simulador (estado do guindaste, carga, resultado da
avaliação) para ser reproduzida depois, sem reavaliar. O backend não interpreta os quadros: eles são
uma lista de objetos JSON escrita pelo frontend, e os campos opcionais das outras tarefas da leva E
(patolas, acessórios, colisões, cenário) podem estar ausentes. Por isso o domínio só confere o que é
dele: nome, duração, tamanho e a forma geral.

- RN-005: `load_chart_refs` guarda as tabelas de carga (id e versão) que as avaliações dos quadros
  usaram.
- Limites PROVISÓRIOS (ADR-027; A VALIDAR com a pessoa responsável): 10 minutos e 5 MB.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.domain.exceptions.recording_errors import InvalidRecordingError

# PROVISÓRIOS (ADR-027).
MAX_RECORDING_DURATION_MS = 10 * 60 * 1000
MAX_RECORDING_BYTES = 5 * 1024 * 1024

NAME_MAX_LENGTH = 120


@dataclass(frozen=True, slots=True)
class LoadChartRef:
    """Tabela de carga e versão usadas numa avaliação gravada (RN-005)."""

    load_chart_id: str
    version: str

    def __post_init__(self) -> None:
        if not self.load_chart_id.strip():
            raise InvalidRecordingError("load_chart_refs", "o id da tabela de carga é obrigatório")
        if not self.version.strip():
            raise InvalidRecordingError("load_chart_refs", "a versão da tabela é obrigatória")


def normalize_recording_name(raw: str) -> str:
    """Nome sem espaços nas pontas, de 1 a `NAME_MAX_LENGTH` caracteres."""
    name = raw.strip() if isinstance(raw, str) else ""
    if not name:
        raise InvalidRecordingError("name", "o nome da gravação deve ser informado")
    if len(name) > NAME_MAX_LENGTH:
        raise InvalidRecordingError(
            "name", f"o nome da gravação deve ter no máximo {NAME_MAX_LENGTH} caracteres"
        )
    return name


@dataclass(frozen=True, slots=True)
class SimulationRecordingSummary:
    """Gravação sem o conteúdo, como aparece na lista."""

    id: str
    name: str
    author_user_id: str
    author_display_name: str
    created_at: datetime
    duration_ms: int
    configuration_id: str
    load_chart_refs: tuple[LoadChartRef, ...]
    frame_count: int

    def __post_init__(self) -> None:
        if not self.id.strip():
            raise InvalidRecordingError("id", "o id da gravação deve ser informado")
        normalize_recording_name(self.name)
        if not self.configuration_id.strip():
            raise InvalidRecordingError("configuration_id", "a configuração é obrigatória")
        if self.duration_ms < 0:
            raise InvalidRecordingError("duration_ms", "a duração não pode ser negativa")
        if self.created_at.tzinfo is None:
            raise ValueError("a data de criação da gravação deve ter fuso horário")


@dataclass(frozen=True, slots=True)
class SimulationRecording:
    """Gravação completa: resumo, cenário (opcional) e quadros."""

    summary: SimulationRecordingSummary
    scenario: dict[str, Any] | None
    frames: list[dict[str, Any]]

    def __post_init__(self) -> None:
        if not self.frames:
            raise InvalidRecordingError("frames", "a gravação precisa de pelo menos um quadro")
        if len(self.frames) != self.summary.frame_count:
            raise ValueError("frame_count do resumo não bate com a quantidade de quadros")
