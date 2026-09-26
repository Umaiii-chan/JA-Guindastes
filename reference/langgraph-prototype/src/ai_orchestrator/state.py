from typing import TypedDict


class WorkflowState(TypedDict, total=False):
    run_id: str
    task: str
    repository_context: str
    architecture_plan: str
    test_plan: str
    implementation: str
    review: str
    approved: bool

