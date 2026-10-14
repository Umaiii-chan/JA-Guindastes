"""Casos de uso das gravações de simulação (TASK-057; ADR-027). Dados FICTÍCIOS."""

from typing import Any

import pytest

from app.application.use_cases.manage_simulation_recordings import (
    ManageSimulationRecordings,
    NewRecording,
    RecordingForbiddenError,
    RecordingNotFoundError,
)
from app.domain.entities.simulation_recording import (
    MAX_RECORDING_BYTES,
    MAX_RECORDING_DURATION_MS,
)
from app.domain.entities.user import UserRole
from app.domain.exceptions.recording_errors import (
    InvalidRecordingError,
    RecordingTooLargeError,
    RecordingTooLongError,
)
from tests.fixtures.auth_ficticia import AuthFicticia, user_ficticio
from tests.fixtures.simulation_recording_fakes import (
    InMemorySimulationRecordingRepository,
    frames_ficticios,
)


def new(**changes: Any) -> NewRecording:
    values: dict[str, Any] = {
        "name": "  Teste FICTÍCIO  ",
        "configuration_id": "CFG-FICTICIA",
        "duration_ms": 200,
        "load_chart_refs": [("LC-FICTICIA", "v1")],
        "scenario": None,
        "frames": frames_ficticios(),
    }
    values.update(changes)
    return NewRecording(**values)


@pytest.fixture
def auth() -> AuthFicticia:
    return AuthFicticia()


@pytest.fixture
def use_cases(auth: AuthFicticia) -> ManageSimulationRecordings:
    return ManageSimulationRecordings(
        InMemorySimulationRecordingRepository(), clock=auth.clock, id_generator=auth.generate_id
    )


def test_create_normalizes_the_name_and_records_the_author(
    use_cases: ManageSimulationRecordings, auth: AuthFicticia
) -> None:
    recording = use_cases.create_recording(auth.operator, new())

    assert recording.summary.name == "Teste FICTÍCIO"
    assert recording.summary.author_user_id == auth.operator.id
    assert recording.summary.frame_count == 3
    assert use_cases.get_recording(recording.summary.id) == recording


def test_create_rejects_a_recording_over_the_duration_limit(
    use_cases: ManageSimulationRecordings, auth: AuthFicticia
) -> None:
    with pytest.raises(RecordingTooLongError):
        use_cases.create_recording(auth.operator, new(duration_ms=MAX_RECORDING_DURATION_MS + 1))
    use_cases.create_recording(auth.operator, new(duration_ms=MAX_RECORDING_DURATION_MS))


def test_create_rejects_content_over_the_size_limit(
    use_cases: ManageSimulationRecordings, auth: AuthFicticia
) -> None:
    frame = {"tMs": 0, "padding": "x" * MAX_RECORDING_BYTES}

    with pytest.raises(RecordingTooLargeError):
        use_cases.create_recording(auth.operator, new(frames=[frame]))


@pytest.mark.parametrize(
    "changes",
    [{"name": ""}, {"frames": []}, {"duration_ms": -1}, {"configuration_id": ""}],
)
def test_create_rejects_invalid_fields(
    use_cases: ManageSimulationRecordings, auth: AuthFicticia, changes: dict[str, Any]
) -> None:
    with pytest.raises(InvalidRecordingError):
        use_cases.create_recording(auth.operator, new(**changes))


def test_delete_by_author_and_by_admin_but_not_by_others(
    use_cases: ManageSimulationRecordings, auth: AuthFicticia
) -> None:
    other = user_ficticio("outro.ficticio", UserRole.OPERATOR)
    first = use_cases.create_recording(auth.operator, new())
    second = use_cases.create_recording(auth.operator, new())

    with pytest.raises(RecordingForbiddenError):
        use_cases.delete_recording(other, first.summary.id)
    use_cases.delete_recording(auth.operator, first.summary.id)
    use_cases.delete_recording(auth.admin, second.summary.id)

    assert use_cases.list_recordings() == []
    with pytest.raises(RecordingNotFoundError):
        use_cases.delete_recording(auth.admin, second.summary.id)
    with pytest.raises(RecordingNotFoundError):
        use_cases.get_recording(second.summary.id)
