"""Exceções de domínio da geometria operacional (ADR-013).

Ficam num módulo próprio, separado de `domain_errors.py`, mas todas herdam de `DomainError`.
"""

from enum import StrEnum

from app.domain.exceptions.domain_errors import DomainError


class InvalidCraneGeometryError(DomainError):
    """A ficha técnica geométrica do guindaste é incoerente (ADR-013 C-4).

    Exemplos: mínimo maior que o máximo, faixa de inclinação fora de −90° < θ ≤ 90°, só um dos
    limites de giro informado.
    """


class InvalidOperationalStateError(DomainError):
    """O estado operacional de entrada está mal formado (tipo errado de algum campo)."""


class OperationalLimitViolation(StrEnum):
    """Qual faixa da ficha técnica o estado operacional viola (ADR-013 C-5, "Validade").

    Legível por máquina. A mensagem mostrada ao usuário ainda não está definida.
    """

    BOOM_LENGTH_BELOW_MIN = "BOOM_LENGTH_BELOW_MIN"
    BOOM_LENGTH_ABOVE_MAX = "BOOM_LENGTH_ABOVE_MAX"
    BOOM_ANGLE_BELOW_MIN = "BOOM_ANGLE_BELOW_MIN"
    BOOM_ANGLE_ABOVE_MAX = "BOOM_ANGLE_ABOVE_MAX"
    CABLE_LENGTH_BELOW_MIN = "CABLE_LENGTH_BELOW_MIN"
    CABLE_LENGTH_ABOVE_MAX = "CABLE_LENGTH_ABOVE_MAX"
    TURRET_ROTATION_OUTSIDE_LIMITS = "TURRET_ROTATION_OUTSIDE_LIMITS"


class OperationalStateOutOfLimitsError(DomainError):
    """O estado operacional está fora das faixas da ficha técnica.

    ADR-013 C-5: o `GeometryService` sinaliza, e não corrige, esses estados. Nenhum valor é
    ajustado ao limite mais próximo e nenhuma geometria é devolvida. `violations` traz todas as
    faixas violadas, não só a primeira.
    """

    def __init__(self, violations: tuple[OperationalLimitViolation, ...]) -> None:
        self.violations = violations
        super().__init__(
            "estado operacional fora das faixas da ficha técnica: "
            + ", ".join(violation.value for violation in violations)
        )


class OutsideGeometricDomainError(DomainError):
    """A ponta da lança fica atrás do eixo de giro (alcance horizontal R < 0).

    ADR-013 C-5: o raio não vira |R|; o estado é sinalizado como fora do domínio geométrico e não
    é consultado na tabela (RN-007, RF-020).
    """

    def __init__(self, horizontal_reach_m: float) -> None:
        self.horizontal_reach_m = horizontal_reach_m
        super().__init__(
            f"ponta da lança atrás do eixo de giro (alcance horizontal {horizontal_reach_m} m): "
            "estado fora do domínio geométrico"
        )
