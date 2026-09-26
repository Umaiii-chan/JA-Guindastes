from pathlib import Path

IGNORED_PARTS = {".git", ".venv", "node_modules", "dist", "build", ".ai"}
TEXT_SUFFIXES = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".kt",
    ".md", ".toml", ".yaml", ".yml", ".json", ".sql", ".sh",
}


def collect_repository_context(
    root: Path, max_files: int = 200, max_file_chars: int = 30_000, max_total_chars: int = 350_000
) -> str:
    """Return a bounded, deterministic snapshot; never include secrets or binary files."""
    chunks: list[str] = []
    total = 0
    candidates = sorted(
        path for path in root.rglob("*")
        if path.is_file()
        and not any(part in IGNORED_PARTS for part in path.parts)
        and path.suffix.lower() in TEXT_SUFFIXES
        and path.name != ".env"
    )
    for path in candidates[:max_files]:
        content = path.read_text(encoding="utf-8", errors="replace")[:max_file_chars]
        block = f"\n--- FILE: {path.relative_to(root)} ---\n{content}"
        if total + len(block) > max_total_chars:
            break
        chunks.append(block)
        total += len(block)
    return "".join(chunks)

