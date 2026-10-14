from collections.abc import Iterable

from app.domain.entities.accessory import Accessory
from app.domain.entities.load import Load
from app.domain.value_objects.mass import Mass


def weight_compared_with_capacity(
    load: Load | Mass,
    hook_block_weight: Mass | None = None,
    accessories: Iterable[Accessory] = (),
) -> Mass:
    """Peso a comparar com a capacidade da tabela (RF-017; doc-fonte § 14.2; ADR-018 § 2; RN-014).

    É o ponto único da regra do peso comparado (TASK-028):

    - `load`: a carga (`Load`: vale o peso informado pelo usuário) ou só o peso dela (`Mass`: a
      entrada dos contratos REST e WebSocket, que recebem só `load_weight_kg`);
    - `hook_block_weight`: o peso do gancho que a tabela considera, cadastrado na configuração
      (`hook_block_weight_kg`; `None` = 0). A tabela oficial que inclui o gancho na capacidade pede
      **carga + gancho** (ADR-018 § 2; PEND-006 respondida para o gancho);
    - `accessories`: os acessórios de içamento escolhidos (TASK-056; RN-014), cada ocorrência soma
      o próprio peso. Jib e contrapeso não entram: são configurações (RN-001, RN-002).

    Sem gancho nem acessórios, devolve o próprio peso da carga.
    """
    load_weight = load.weight if isinstance(load, Load) else load
    hook_kg = 0.0 if hook_block_weight is None else hook_block_weight.kilograms
    accessories_kg = sum(accessory.weight.kilograms for accessory in accessories)
    if hook_kg == 0 and accessories_kg == 0:
        return load_weight
    return Mass(load_weight.kilograms + hook_kg + accessories_kg)
