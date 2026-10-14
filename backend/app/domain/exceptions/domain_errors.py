"""Exceções de domínio (sem dependência de framework, RNF-002).

Consulta fora do domínio da tabela NÃO é exceção: é um resultado explícito de "não suportado"
(`app.domain.value_objects.capacity_result.CapacityUnsupported`, RN-007).
"""


class DomainError(Exception):
    """Base de todos os erros de domínio."""


class InvalidQuantityError(DomainError):
    """Grandeza física inválida (não numérica, NaN, infinita ou fora da faixa aceita)."""


class InvalidLoadChartError(DomainError):
    """A tabela de carga viola um invariante de domínio."""


class ConflictingLoadChartPointsError(InvalidLoadChartError):
    """Dois pontos com o mesmo comprimento de lança e raio têm capacidades diferentes.

    Doc-fonte § 13.1: "ausência de linhas duplicadas conflitantes".
    """

    def __init__(self, boom_length_m: float, working_radius_m: float) -> None:
        self.boom_length_m = boom_length_m
        self.working_radius_m = working_radius_m
        super().__init__(
            "pontos conflitantes na tabela de carga: capacidades diferentes para "
            f"boom_length={boom_length_m} m e working_radius={working_radius_m} m"
        )


class UndefinedUtilizationError(DomainError):
    """A utilização não pode ser calculada (capacidade igual a zero)."""


class InvalidRotationZonesError(DomainError):
    """As zonas de giro da configuração, ou o código de zona de uma tabela, são inválidos.

    Código inválido, nome vazio ou longo demais, ângulo fora de [0°, 360°), menos de 2 zonas,
    códigos repetidos, buraco ou sobreposição no giro (ADR-018 § 1).
    """


class InvalidAccessoryError(DomainError):
    """O acessório de içamento tem dado inválido (id, nome, tipo, peso, altura ou arquivo)."""
