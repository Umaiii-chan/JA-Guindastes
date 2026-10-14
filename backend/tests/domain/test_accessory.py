"""Acessório de içamento e peso comparado (TASK-056; RN-014). Dados FICTÍCIOS."""

import pytest

from app.domain.entities.accessory import Accessory, AccessoryType
from app.domain.exceptions.domain_errors import InvalidAccessoryError
from app.domain.services.compared_load_weight import weight_compared_with_capacity
from app.domain.value_objects.mass import Mass
from tests.fixtures.acessorios_ficticios import (
    CINTA_FICTICIA,
    GANCHO_ACESSORIO_FICTICIO,
    MANILHA_FICTICIA,
)


def build(**overrides: object) -> Accessory:
    values: dict[str, object] = {
        "id": "ACC-1",
        "type": AccessoryType.SHACKLE,
        "name": "Manilha FICTÍCIA",
        "weight": Mass(10.0),
    }
    values.update(overrides)
    return Accessory(**values)  # type: ignore[arg-type]


def test_valid_accessory_defaults_to_no_model_and_zero_rigging_height() -> None:
    accessory = build()

    assert accessory.model_file is None
    assert accessory.rigging_height_m == 0.0


@pytest.mark.parametrize(
    "overrides",
    [
        {"id": " "},
        {"name": ""},
        {"type": "SHACKLE"},
        {"weight": 10.0},
        {"weight": Mass(100_001.0)},
        {"rigging_height_m": -0.1},
        {"rigging_height_m": 50.1},
        {"rigging_height_m": True},
        {"model_file": "../segredo.glb"},
        {"model_file": "pasta/manilha.glb"},
        {"model_file": "manilha.exe"},
        {"model_file": ""},
    ],
)
def test_invalid_accessory_is_rejected(overrides: dict[str, object]) -> None:
    with pytest.raises(InvalidAccessoryError):
        build(**overrides)


def test_rn014_example_load_hook_shackle_and_sling_sum_to_3235_kg() -> None:
    # RN-014: carga 3000 + gancho 200 + manilha 20 + cinta 15 = 3235 kg.
    compared = weight_compared_with_capacity(
        Mass(3000.0), None, (GANCHO_ACESSORIO_FICTICIO, MANILHA_FICTICIA, CINTA_FICTICIA)
    )

    assert compared == Mass(3235.0)


def test_without_hook_or_accessories_the_compared_weight_is_the_load_itself() -> None:
    assert weight_compared_with_capacity(Mass(3000.0)) == Mass(3000.0)


def test_accessories_add_to_the_configuration_hook_block() -> None:
    compared = weight_compared_with_capacity(Mass(1000.0), Mass(300.0), (MANILHA_FICTICIA,))

    assert compared == Mass(1320.0)


def test_repeated_accessory_counts_once_per_occurrence() -> None:
    compared = weight_compared_with_capacity(Mass(0.0), None, (MANILHA_FICTICIA,) * 2)

    assert compared == Mass(40.0)
