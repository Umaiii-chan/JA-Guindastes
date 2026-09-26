from pathlib import Path

from ai_orchestrator.workflow import build_workflow, stage_documents


class Response:
    def __init__(self, content: str) -> None:
        self.content = content


class FakeModel:
    def __init__(self, answer: str) -> None:
        self.answer = answer

    def invoke(self, messages: list[dict[str, str]]) -> Response:
        assert messages[0]["role"] == "system"
        return Response(self.answer)


def test_full_workflow_and_handoff(tmp_path: Path) -> None:
    answers = iter(["plan", "tests", "diff", "review\nVERDICT: APPROVE"])

    def factory(_: str) -> FakeModel:
        return FakeModel(next(answers))

    models = {key: "fake:model" for key in ("architect", "test_engineer", "developer", "reviewer")}
    result = build_workflow(models, tmp_path, factory).invoke({"run_id": "1", "task": "Do it"})
    assert result["approved"] is True
    assert set(stage_documents(result)) == {
        "01-architecture.md", "02-tests.md", "03-implementation.patch", "04-review.md"
    }

