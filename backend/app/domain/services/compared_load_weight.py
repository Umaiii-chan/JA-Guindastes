from app.domain.entities.load import Load
from app.domain.value_objects.mass import Mass


def weight_compared_with_capacity(load: Load) -> Mass:
    """Peso da carga a comparar com a capacidade da tabela (RF-017; doc-fonte § 14.2).

    Hoje é exatamente o peso informado pelo usuário (`load.weight`). Acessórios, moitões, cabos e
    pesos auxiliares **não** são somados: a composição da "carga bruta" depende da PEND-006, ainda
    pendente (known-gaps P-005). Quando ela for respondida, a regra muda só aqui.

    O `EvaluateOperation.execute_for_load` usa esta função (TASK-029); os contratos REST e WebSocket
    ainda recebem só o peso (`load_weight_kg`) e chamam `execute` com ele.
    """
    return load.weight
