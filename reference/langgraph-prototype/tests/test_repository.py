from pathlib import Path

from ai_orchestrator.repository import collect_repository_context


def test_snapshot_excludes_env_and_git(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("print('ok')", encoding="utf-8")
    (tmp_path / ".env").write_text("SECRET=bad", encoding="utf-8")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("secret", encoding="utf-8")
    result = collect_repository_context(tmp_path)
    assert "app.py" in result
    assert "SECRET=bad" not in result
    assert ".git/config" not in result


def test_snapshot_is_bounded(tmp_path: Path) -> None:
    (tmp_path / "large.py").write_text("x" * 100, encoding="utf-8")
    result = collect_repository_context(tmp_path, max_file_chars=10, max_total_chars=100)
    assert "x" * 11 not in result

