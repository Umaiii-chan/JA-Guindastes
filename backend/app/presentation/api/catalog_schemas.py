"""Schemas Pydantic dos cadastros do catálogo (TASK-030; ADR-006; doc-fonte § 15.1; ADR-013 C-4).

Ficam na apresentação (ADR-006): o domínio e a aplicação não conhecem Pydantic. Os campos da ficha
técnica têm os nomes do ADR-013 C-4, com o sufixo da unidade interna (`_m`, `_deg`; RN-006).

Entradas estritas, como as da avaliação (TASK-024): `strict` (número em texto e booleano não viram
número), `allow_inf_nan=False` (`NaN` e infinito recusados) e `extra="forbid"` (campo desconhecido
é erro, inclusive um `id`: ids são gerados pelo servidor). Nomes obrigatórios não podem ser vazios
nem só espaços. Não há limite de tamanho dos nomes: nenhuma regra o define.
"""

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.application.ports.crane_catalog_repository import (
    HOOK_BLOCK_WEIGHT_MAX_KG,
    Crane,
    CraneConfiguration,
    Manufacturer,
)
from app.domain.exceptions.domain_errors import DomainError
from app.domain.value_objects.angle import Angle
from app.domain.value_objects.crane_geometry import CraneGeometry
from app.domain.value_objects.length import Length
from app.domain.value_objects.mass import Mass
from app.domain.value_objects.rotation_zone import RotationZone, RotationZones

_STRICT_INPUT = ConfigDict(strict=True, allow_inf_nan=False, extra="forbid")
# Texto obrigatório: pelo menos um caractere que não seja espaço.
RequiredText = Annotated[str, StringConstraints(min_length=1, pattern=r"\S")]


class CraneGeometryPayload(BaseModel):
    """Ficha técnica geométrica da configuração (ADR-013 C-4), em metros e graus.

    Os valores são FICTÍCIOS até a empresa fornecer as fichas reais (ADR-013 C-4 regra 2). Além da
    forma de cada campo, a ficha inteira é validada pela `CraneGeometry` do domínio: todo mínimo ≤
    máximo, θ dentro de (−90°, 90°] e os dois limites de giro juntos, com amplitude menor que 360°.
    Violar isso responde 422.
    """

    model_config = _STRICT_INPUT

    boom_pivot_offset_m: float = Field(
        description="a: distância horizontal do eixo de giro até o pino do pé da lança P, na "
        "direção da lança, em metros. Tem sinal: negativa se P fica atrás do eixo; 0 é válido."
    )
    boom_pivot_height_m: float = Field(
        ge=0, description="h: altura de P acima do plano de apoio, em metros."
    )
    boom_length_min_m: float = Field(ge=0, description="L_min: lança toda recolhida, em metros.")
    boom_length_max_m: float = Field(
        ge=0, description="L_max: lança toda estendida, em metros (igual a L_min se fixa)."
    )
    boom_angle_min_deg: float = Field(description="θ_min: inclinação mínima da lança, em graus.")
    boom_angle_max_deg: float = Field(description="θ_max: inclinação máxima da lança, em graus.")
    cable_length_min_m: float = Field(ge=0, description="c_min: cabo mínimo, em metros.")
    cable_length_max_m: float | None = Field(
        default=None, ge=0, description="c_max: cabo máximo, em metros; opcional."
    )
    turret_rotation_min_deg: float | None = Field(
        default=None,
        description="ψ_min: limite de giro, em graus. Os dois limites juntos ou nenhum; sem eles, "
        "o giro é contínuo.",
    )
    turret_rotation_max_deg: float | None = Field(
        default=None, description="ψ_max: limite de giro, em graus (ver `turret_rotation_min_deg`)."
    )

    @model_validator(mode="after")
    def _validate_with_domain(self) -> Self:
        try:
            self.to_domain()
        except DomainError as error:
            raise ValueError(str(error)) from error
        return self

    def to_domain(self) -> CraneGeometry:
        return CraneGeometry(
            boom_pivot_offset_m=self.boom_pivot_offset_m,
            boom_pivot_height=Length(self.boom_pivot_height_m),
            boom_length_min=Length(self.boom_length_min_m),
            boom_length_max=Length(self.boom_length_max_m),
            boom_angle_min=Angle(self.boom_angle_min_deg),
            boom_angle_max=Angle(self.boom_angle_max_deg),
            cable_length_min=Length(self.cable_length_min_m),
            cable_length_max=_length(self.cable_length_max_m),
            turret_rotation_min=_angle(self.turret_rotation_min_deg),
            turret_rotation_max=_angle(self.turret_rotation_max_deg),
        )

    @classmethod
    def from_domain(cls, geometry: CraneGeometry) -> CraneGeometryPayload:
        return cls(
            boom_pivot_offset_m=geometry.boom_pivot_offset_m,
            boom_pivot_height_m=geometry.boom_pivot_height.meters,
            boom_length_min_m=geometry.boom_length_min.meters,
            boom_length_max_m=geometry.boom_length_max.meters,
            boom_angle_min_deg=geometry.boom_angle_min.degrees,
            boom_angle_max_deg=geometry.boom_angle_max.degrees,
            cable_length_min_m=geometry.cable_length_min.meters,
            cable_length_max_m=(
                None if geometry.cable_length_max is None else geometry.cable_length_max.meters
            ),
            turret_rotation_min_deg=(
                None
                if geometry.turret_rotation_min is None
                else geometry.turret_rotation_min.degrees
            ),
            turret_rotation_max_deg=(
                None
                if geometry.turret_rotation_max is None
                else geometry.turret_rotation_max.degrees
            ),
        )


class RotationZonePayload(BaseModel):
    """Uma zona de giro da configuração (ADR-018 § 1; TASK-046), em graus.

    Aqui só a forma (texto e números finitos). As regras (código com 1 a 32 caracteres `[A-Z0-9_]`,
    nome com 1 a 80 caracteres, ângulos em [0, 360), cobertura de 360° sem sobreposição, pelo menos
    2 zonas, códigos únicos) são do domínio (`RotationZones`) e, violadas, respondem 422 com
    `code: INVALID_ROTATION_ZONES`.
    """

    model_config = _STRICT_INPUT

    code: str = Field(description="Código único na configuração: 1 a 32 caracteres `[A-Z0-9_]`.")
    name: str = Field(description="Nome da zona: 1 a 80 caracteres.")
    start_deg: float = Field(
        description="Início do setor, em graus, em [0, 360), na convenção de ψ do ADR-013 (0° = "
        "lança sobre a frente do chassi, anti-horário visto de cima)."
    )
    end_deg: float = Field(
        description="Fim do setor, em graus, em [0, 360). O setor vai de `start_deg` a `end_deg` "
        "no sentido crescente e pode passar por 0° (ex.: frontal de 305° a 55°)."
    )

    @classmethod
    def from_domain(cls, zone: RotationZone) -> RotationZonePayload:
        return cls(code=zone.code, name=zone.name, start_deg=zone.start_deg, end_deg=zone.end_deg)


def rotation_zones_to_domain(zones: list[RotationZonePayload] | None) -> RotationZones | None:
    """Zonas do corpo para o domínio; `null` e `[]` = sem zonas.

    Levanta `InvalidRotationZonesError` se as zonas violarem as regras do domínio.
    """
    if not zones:
        return None
    return RotationZones(
        zones=tuple(
            RotationZone(
                code=zone.code, name=zone.name, start_deg=zone.start_deg, end_deg=zone.end_deg
            )
            for zone in zones
        )
    )


def _rotation_zones_payload(zones: RotationZones | None) -> list[RotationZonePayload] | None:
    return (
        None if zones is None else [RotationZonePayload.from_domain(zone) for zone in zones.zones]
    )


def hook_block_weight_to_domain(kilograms: float | None) -> Mass | None:
    return None if kilograms is None else Mass(kilograms)


_ROTATION_ZONES_DESCRIPTION = (
    "Zonas de giro (ADR-018; TASK-046): `[{code, name, start_deg, end_deg}]`, cobrindo 360° sem "
    "sobreposição, com pelo menos 2 zonas; `null`, `[]` ou ausente = sem zonas (uma tabela vale "
    "para todo o giro). Zonas inválidas → 422 `INVALID_ROTATION_ZONES`."
)
_HOOK_BLOCK_WEIGHT_DESCRIPTION = (
    "Peso do gancho que a tabela considera, em kg, de 0 a 100 000 (ADR-018 § 2): a avaliação "
    "compara carga + gancho com a capacidade. `null` = 0 kg na comparação."
)


def _length(meters: float | None) -> Length | None:
    return None if meters is None else Length(meters)


def _angle(degrees: float | None) -> Angle | None:
    return None if degrees is None else Angle(degrees)


class ManufacturerCreateRequest(BaseModel):
    """Fabricante a cadastrar (RF-001). O id é gerado pelo servidor."""

    model_config = _STRICT_INPUT

    name: RequiredText = Field(description="Nome do fabricante.")


class ManufacturerResponse(BaseModel):
    """Fabricante cadastrado."""

    id: str = Field(description="Id gerado pelo servidor (UUID em texto).")
    name: str = Field(description="Nome do fabricante.")

    @classmethod
    def from_record(cls, manufacturer: Manufacturer) -> ManufacturerResponse:
        return cls(id=manufacturer.id, name=manufacturer.name)


class CraneCreateRequest(BaseModel):
    """Modelo de guindaste a cadastrar (RF-002), sem capacidade global (doc-fonte § 10.2)."""

    model_config = _STRICT_INPUT

    manufacturer_id: RequiredText = Field(
        description="Id do fabricante; precisa existir (senão, 404)."
    )
    model_name: RequiredText = Field(description="Nome do modelo do guindaste.")


class CraneResponse(BaseModel):
    """Modelo de guindaste cadastrado."""

    id: str = Field(description="Id gerado pelo servidor (UUID em texto).")
    manufacturer_id: str = Field(description="Id do fabricante.")
    model_name: str = Field(description="Nome do modelo do guindaste.")

    @classmethod
    def from_record(cls, crane: Crane) -> CraneResponse:
        return cls(id=crane.id, manufacturer_id=crane.manufacturer_id, model_name=crane.model_name)


class ConfigurationCreateRequest(BaseModel):
    """Configuração operacional a cadastrar num guindaste (RF-005; RN-001).

    O guindaste vem da rota. Os atributos físicos que distinguem configurações (lança, jib,
    contrapeso, estabilizadores; RN-002) estão pendentes (PEND-005): por enquanto, só um nome.
    """

    model_config = _STRICT_INPUT

    name: RequiredText = Field(description="Nome da configuração.")
    geometry: CraneGeometryPayload | None = Field(
        default=None,
        description="Ficha técnica geométrica (ADR-013 C-4); opcional. Sem ela, a avaliação da "
        "configuração responde `NOT_EVALUABLE` com `CRANE_GEOMETRY_NOT_FOUND`.",
    )
    rotation_zones: list[RotationZonePayload] | None = Field(
        default=None, description=_ROTATION_ZONES_DESCRIPTION
    )
    hook_block_weight_kg: float | None = Field(
        default=None, ge=0, le=HOOK_BLOCK_WEIGHT_MAX_KG, description=_HOOK_BLOCK_WEIGHT_DESCRIPTION
    )


class ConfigurationResponse(BaseModel):
    """Configuração operacional cadastrada, com a ficha técnica, as zonas de giro e o gancho."""

    id: str = Field(description="Id gerado pelo servidor (UUID em texto).")
    crane_id: str = Field(description="Id do guindaste.")
    name: str = Field(description="Nome da configuração.")
    geometry: CraneGeometryPayload | None = Field(
        description="Ficha técnica geométrica (ADR-013 C-4), ou `null` se não foi cadastrada."
    )
    rotation_zones: list[RotationZonePayload] | None = Field(
        description="Zonas de giro na ordem em que foram cadastradas (TASK-046), ou `null` sem "
        "zonas."
    )
    hook_block_weight_kg: float | None = Field(
        description="Peso do gancho em kg, como cadastrado (TASK-046), ou `null` (= 0 kg na "
        "comparação)."
    )

    @classmethod
    def from_record(cls, configuration: CraneConfiguration) -> ConfigurationResponse:
        geometry = configuration.geometry
        hook = configuration.hook_block_weight
        return cls(
            id=configuration.id,
            crane_id=configuration.crane_id,
            name=configuration.name,
            geometry=None if geometry is None else CraneGeometryPayload.from_domain(geometry),
            rotation_zones=_rotation_zones_payload(configuration.rotation_zones),
            hook_block_weight_kg=None if hook is None else hook.kilograms,
        )


class ManufacturerUpdateRequest(BaseModel):
    """Edição do fabricante (TASK-044): o nome, com a mesma validação do cadastro."""

    model_config = _STRICT_INPUT

    name: RequiredText = Field(description="Novo nome do fabricante.")


class CraneUpdateRequest(BaseModel):
    """Edição do guindaste (TASK-044): só o nome do modelo; o fabricante não muda."""

    model_config = _STRICT_INPUT

    model_name: RequiredText = Field(description="Novo nome do modelo do guindaste.")


class ConfigurationUpdateRequest(BaseModel):
    """Edição da configuração (TASK-044, TASK-046): nome, ficha técnica, zonas de giro e/ou peso
    do gancho; o guindaste não muda.

    Os campos são opcionais, mas pelo menos um precisa vir. Campo ausente mantém o valor atual.
    `name` e `geometry` não aceitam `null` (422): a ficha, quando vem, substitui a ficha inteira, e
    esta rota não apaga a ficha. `rotation_zones` substitui a lista (`[]` ou `null` remove as
    zonas; remover ou renomear uma zona com tabelas → 409 `ROTATION_ZONE_IN_USE`), e
    `hook_block_weight_kg: null` apaga o peso do gancho. Os valores novos valem para as próximas
    avaliações e não alteram as tabelas de carga.
    """

    model_config = _STRICT_INPUT

    name: RequiredText | None = Field(
        default=None, description="Novo nome da configuração; ausente mantém o atual."
    )
    geometry: CraneGeometryPayload | None = Field(
        default=None,
        description="Ficha técnica nova e completa (ADR-013 C-4), que substitui a atual; ausente "
        "mantém a atual. Não pode ser `null`.",
    )
    rotation_zones: list[RotationZonePayload] | None = Field(
        default=None,
        description="Zonas de giro novas, que substituem a lista atual; `[]` ou `null` remove as "
        "zonas; ausente mantém. Zonas inválidas → 422 `INVALID_ROTATION_ZONES`; remover ou "
        "renomear o código de uma zona que já tem tabelas → 409 `ROTATION_ZONE_IN_USE`.",
    )
    hook_block_weight_kg: float | None = Field(
        default=None,
        ge=0,
        le=HOOK_BLOCK_WEIGHT_MAX_KG,
        description="Peso do gancho novo, em kg (0 a 100 000); `null` apaga (= 0 kg na "
        "comparação); ausente mantém.",
    )

    @model_validator(mode="after")
    def _validate_fields_present(self) -> Self:
        if not self.model_fields_set:
            raise ValueError(
                "informe ao menos um campo: name, geometry, rotation_zones ou hook_block_weight_kg"
            )
        for field_name in ("name", "geometry"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} não pode ser null")
        return self


class CatalogErrorResponse(BaseModel):
    """Corpo das respostas 404 e 409 do catálogo (e do 404 da listagem de tabelas, TASK-044)."""

    detail: str = Field(description="Mensagem legível (sem código de erro definido ainda).")
