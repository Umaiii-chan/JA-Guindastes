from pathlib import Path
from typing import Any

from langgraph.graph import END, START, StateGraph

from .models import ModelFactory, default_model_factory, text_from_response
from .repository import collect_repository_context
from .state import WorkflowState

SYSTEM_GUARDRAILS = """You are one stage in an audited software workflow.
Use only the task and repository snapshot supplied. Distinguish facts from assumptions.
Do not invent files, APIs, test results, or commands that were not observed.
Return Markdown. Mention missing evidence explicitly. Never include credentials.
"""


def _ask(factory: ModelFactory, model_id: str, role: str, input_text: str) -> str:
    model = factory(model_id)
    response = model.invoke([
        {"role": "system", "content": SYSTEM_GUARDRAILS + f"\nYour role: {role}."},
        {"role": "user", "content": input_text},
    ])
    return text_from_response(response)


def build_workflow(
    models: dict[str, str], repository: Path, model_factory: ModelFactory = default_model_factory
) -> Any:
    snapshot = collect_repository_context(repository)

    def architect(state: WorkflowState) -> dict[str, str]:
        prompt = (
            f"TASK\n{state['task']}\n\nREPOSITORY\n{snapshot}\n\n"
            "Create an implementation plan with acceptance criteria, affected files, risks, "
            "and explicit assumptions."
        )
        plan = _ask(model_factory, models["architect"], "software architect", prompt)
        return {"repository_context": snapshot, "architecture_plan": plan}

    def test_engineer(state: WorkflowState) -> dict[str, str]:
        prompt = (
            f"TASK\n{state['task']}\n\nPLAN\n{state['architecture_plan']}\n\n"
            "Design failing-first tests. Map every acceptance criterion to at least one test."
        )
        return {"test_plan": _ask(model_factory, models["test_engineer"], "test engineer", prompt)}

    def developer(state: WorkflowState) -> dict[str, str]:
        prompt = (
            f"TASK\n{state['task']}\n\nPLAN\n{state['architecture_plan']}\n\n"
            f"TEST PLAN\n{state['test_plan']}\n\n"
            f"REPOSITORY\n{state['repository_context']}\n\n"
            "Propose a minimal implementation as a unified diff. Do not claim tests ran."
        )
        implementation = _ask(
            model_factory, models["developer"], "senior developer", prompt
        )
        return {"implementation": implementation}

    def reviewer(state: WorkflowState) -> dict[str, object]:
        prompt = (
            f"TASK\n{state['task']}\n\nPLAN\n{state['architecture_plan']}\n\n"
            f"TEST PLAN\n{state['test_plan']}\n\n"
            f"PROPOSED DIFF\n{state['implementation']}\n\n"
            "Review correctness, security, scope, test coverage, and hallucinated references. "
            "End with exactly VERDICT: APPROVE or VERDICT: REJECT."
        )
        review = _ask(model_factory, models["reviewer"], "independent code reviewer", prompt)
        return {"review": review, "approved": "VERDICT: APPROVE" in review}

    graph = StateGraph(WorkflowState)
    graph.add_node("architect", architect)
    graph.add_node("test_engineer", test_engineer)
    graph.add_node("developer", developer)
    graph.add_node("reviewer", reviewer)
    graph.add_edge(START, "architect")
    graph.add_edge("architect", "test_engineer")
    graph.add_edge("test_engineer", "developer")
    graph.add_edge("developer", "reviewer")
    graph.add_edge("reviewer", END)
    return graph.compile()


def stage_documents(state: WorkflowState) -> dict[str, str]:
    return {
        "01-architecture.md": state["architecture_plan"],
        "02-tests.md": state["test_plan"],
        "03-implementation.patch": state["implementation"],
        "04-review.md": state["review"],
    }
