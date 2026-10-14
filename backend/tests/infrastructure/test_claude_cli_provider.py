"""`ClaudeCliProvider` (TASK-083; uso pessoal local). Executor falso: o CLI de verdade não roda."""

import json
import subprocess
from pathlib import Path

import pytest

from app.ai_composition import build_ai_assistant
from app.application.ports.llm_provider import LlmError, LlmErrorKind, LlmRequest
from app.infrastructure.ai.claude_cli_provider import ClaudeCliProvider, CliResult

SCHEMA = {"type": "OBJECT", "properties": {"a": {"type": "INTEGER"}}}


class FakeRunner:
    def __init__(self, result: CliResult | Exception) -> None:
        self.result = result
        self.calls: list[tuple[list[str], str, str, float]] = []

    def __call__(self, command: list[str], stdin: str, cwd: str, timeout: float) -> CliResult:
        self.calls.append((command, stdin, cwd, timeout))
        assert Path(cwd).is_dir()
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def cli_ok(text: str) -> CliResult:
    return CliResult(0, json.dumps({"type": "result", "is_error": False, "result": text}), "")


def test_builds_a_locked_down_command_and_sends_the_prompt_by_stdin() -> None:
    runner = FakeRunner(cli_ok("olá"))
    provider = ClaudeCliProvider("opus", "claude-x", timeout_seconds=40, runner=runner)

    completion = provider.generate(LlmRequest(system="sistema", user="pedido secreto"))

    command, stdin, _cwd, timeout = runner.calls[0]
    assert command[:7] == [
        "claude-x",
        "-p",
        "--output-format",
        "json",
        "--model",
        "opus",
        "--tools",
    ]
    assert "--no-session-persistence" in command and "--strict-mcp-config" in command
    assert command[command.index("--setting-sources") + 1] == ""
    assert command[-2:] == ["--system-prompt", "sistema"]
    assert "pedido secreto" not in " ".join(command)
    assert stdin == "pedido secreto" and timeout == 40
    assert (completion.text, completion.model) == ("olá", "claude-cli/opus")
    assert provider.model == "claude-cli/opus"


def test_json_reply_inside_a_fence_is_extracted_and_the_schema_goes_in_the_prompt() -> None:
    runner = FakeRunner(cli_ok('Aqui está:\n```json\n{"a": 1}\n```'))
    provider = ClaudeCliProvider(runner=runner)

    completion = provider.generate(LlmRequest(system="s", user="u", json_schema=SCHEMA))

    assert json.loads(completion.text) == {"a": 1}
    assert '"INTEGER"' in runner.calls[0][1]


def test_timeout_missing_cli_and_not_logged_in_are_clear_llm_errors() -> None:
    request = LlmRequest(system="s", user="u")
    timeout = FakeRunner(subprocess.TimeoutExpired("claude", 1))
    with pytest.raises(LlmError) as expired:
        ClaudeCliProvider(runner=timeout).generate(request)
    assert expired.value.kind is LlmErrorKind.TIMEOUT

    with pytest.raises(LlmError) as missing:
        ClaudeCliProvider(runner=FakeRunner(FileNotFoundError())).generate(request)
    assert missing.value.kind is LlmErrorKind.UNAVAILABLE

    logged_out = FakeRunner(CliResult(1, "", "Not logged in · Please run /login"))
    with pytest.raises(LlmError) as no_login:
        ClaudeCliProvider(runner=logged_out).generate(request)
    assert "logado" in no_login.value.message


def test_provider_is_only_built_with_claude_cli_and_the_enable_flag() -> None:
    assert build_ai_assistant({"AI_PROVIDER": "claude_cli"}) is None
    assert build_ai_assistant({"AI_PROVIDER": "claude_cli", "CLAUDE_CLI_ENABLED": "no"}) is None
    # Nunca no modo auto, mesmo com a flag ligada.
    assert build_ai_assistant({"CLAUDE_CLI_ENABLED": "true"}) is None

    assistant = build_ai_assistant(
        {"AI_PROVIDER": "claude_cli", "CLAUDE_CLI_ENABLED": "true", "CLAUDE_CLI_MODEL": "haiku"}
    )
    assert assistant is not None
    assert assistant.model == "claude-cli/haiku"
