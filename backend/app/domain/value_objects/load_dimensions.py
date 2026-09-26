from dataclasses import dataclass

from app.domain.exceptions.load_errors import InvalidLoadError
from app.domain.value_objects.length import Length


@dataclass(frozen=True)
class LoadDimensions:
    """Dimensões da carga em metros: comprimento, largura e altura (RF-011; RN-006).

    São as arestas da caixa que envolve a carga, no referencial da própria carga (ver
    `LoadCenterOfGravity`). A doc-fonte (§ 10.2) só diz "peso e dimensões"; não diz como medir nem
    como a carga se orienta na cena, e isso fica fora deste value object.

    **Provisório (TASK-028):** cada dimensão precisa ser **maior que zero**. A doc não diz se uma
    dimensão pode ser zero; foi escolhida a opção mais restritiva, registrada como pendência no
    handoff da TASK-028. Não finito ou negativo já é barrado por `Length`.

    Não há ordem entre as dimensões (o comprimento pode ser menor que a largura): a doc não define.
    """

    length: Length
    width: Length
    height: Length

    def __post_init__(self) -> None:
        for field_name, value in (
            ("length", self.length),
            ("width", self.width),
            ("height", self.height),
        ):
            if not isinstance(value, Length):
                raise InvalidLoadError(f"{field_name} da carga deve ser Length, recebido {value!r}")
            if value.meters == 0:
                raise InvalidLoadError(
                    f"{field_name} da carga deve ser maior que zero (regra provisória, TASK-028)"
                )
