import json
import uuid
from pathlib import Path
from typing import Annotated

import typer
import yaml

from .workflow import build_workflow, stage_documents

app = typer.Typer(no_args_is_help=True)


@app.command()
def run(
    task_file: Annotated[Path, typer.Option(exists=True, readable=True)],
    repo: Annotated[Path, typer.Option(exists=True, file_okay=False)] = Path("."),
    config: Annotated[Path, typer.Option(exists=True, readable=True)] = Path("config.yaml"),
    output: Annotated[Path, typer.Option()] = Path(".ai/runs"),
) -> None:
    """Run the four-stage workflow and persist an auditable handoff."""
    settings = yaml.safe_load(config.read_text(encoding="utf-8"))
    run_id = uuid.uuid4().hex[:12]
    initial = {"run_id": run_id, "task": task_file.read_text(encoding="utf-8")}
    result = build_workflow(settings["models"], repo.resolve()).invoke(initial)
    run_dir = output / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    for name, content in stage_documents(result).items():
        (run_dir / name).write_text(content, encoding="utf-8")
    manifest = {"run_id": run_id, "approved": result["approved"], "task_file": str(task_file)}
    (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    typer.echo(str(run_dir))
    if not result["approved"]:
        raise typer.Exit(code=2)


if __name__ == "__main__":
    app()
