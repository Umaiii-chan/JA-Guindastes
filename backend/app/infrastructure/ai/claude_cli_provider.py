"""Adaptador do Claude Code CLI como provedor de IA, SÓ PARA USO PESSOAL LOCAL (TASK-083).

Chama o executável `claude` em modo não interativo (`claude -p --output-format json`) e lê o campo
`result` do JSON. O prompt vai pelo stdin (nunca pela linha de comando e nunca para o log). O CLI
roda num diretório temporário vazio, sem ferramentas, sem sessão gravada, sem configurações de
projeto, sem skills e sem servidores MCP.

AVISO: usa o plano de assinatura da pessoa que está logada no CLI desta máquina. Não pode servir
outras pessoas por um servidor público. Por isso o provedor só é montado com
`AI_PROVIDER=claude_cli` E `CLAUDE_CLI_ENABLED=true` (ver `app.ai_composition`), nunca no modo
`auto`, e nunca em deploy.

Para JSON, o esquema vai no texto do pedido; a resposta é extraída (removendo cercas ```json) e
validada pelo caso de uso, como nos outros provedores.
"""

import json
import logging
import re
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.application.ports.llm_provider import (
    LlmCompletion,
    LlmError,
    LlmErrorKind,
    LlmRequest,
)

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "sonnet"
DEFAULT_EXECUTABLE = "claude"
MODEL_LABEL_PREFIX = "claude-cli/"

_MODEL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\[\]-]{0,63}$")
_FENCE = re.compile(r"^```[A-Za-z]*\s*\n?(.*?)\n?```\s*$", re.DOTALL)
_AUTH_HINTS = ("not logged in", "please run /login", "invalid api key", "authentication", "login")


@dataclass(frozen=True, slots=True)
class CliResult:
    returncode: int
    stdout: str
    stderr: str


# (comando, entrada pelo stdin, diretório de trabalho, prazo em segundos) -> resultado.
# Levanta `subprocess.TimeoutExpired` no prazo e `FileNotFoundError` se o executável não existe.
CliRunner = Callable[[list[str], str, str, float], CliResult]


def subprocess_runner(command: list[str], stdin: str, cwd: str, timeout: float) -> CliResult:
    completed = subprocess.run(  # noqa: S603 - comando montado aqui, sem shell
        command,
        input=stdin,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=cwd,
        timeout=timeout,
        check=False,
    )
    return CliResult(completed.returncode, completed.stdout or "", completed.stderr or "")


class ClaudeCliProvider:
    """Implementa a porta `LlmProvider` sobre o `claude -p` local."""

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        executable: str = DEFAULT_EXECUTABLE,
        *,
        timeout_seconds: float = 55.0,
        runner: CliRunner = subprocess_runner,
    ) -> None:
        if not _MODEL_NAME.fullmatch(model):
            raise ValueError("nome de modelo inválido")
        if not executable.strip():
            raise ValueError("o caminho do executável deve ser informado")
        self._model = model
        self._executable = executable.strip()
        self._timeout = timeout_seconds
        self._runner = runner

    @property
    def model(self) -> str:
        return f"{MODEL_LABEL_PREFIX}{self._model}"

    @property
    def fallback_models(self) -> tuple[str, ...]:
        return ()

    def __repr__(self) -> str:
        return f"ClaudeCliProvider(model={self._model!r})"

    def build_command(self, request: LlmRequest) -> list[str]:
        return [
            self._executable,
            "-p",
            "--output-format",
            "json",
            "--model",
            self._model,
            "--tools",
            "",
            "--no-session-persistence",
            "--setting-sources",
            "",
            "--strict-mcp-config",
            "--disable-slash-commands",
            "--system-prompt",
            request.system,
        ]

    def build_prompt(self, request: LlmRequest) -> str:
        if request.json_schema is None:
            return request.user
        schema = json.dumps(request.json_schema, ensure_ascii=False)
        return (
            f"{request.user}\n\nResponda SOMENTE com um objeto JSON válido que siga este esquema "
            f"JSON Schema, sem texto antes ou depois e sem cercas de código:\n{schema}"
        )

    def generate(self, request: LlmRequest) -> LlmCompletion:
        command = self.build_command(request)
        prompt = self.build_prompt(request)
        try:
            with tempfile.TemporaryDirectory(prefix="claude-cli-") as workdir:
                result = self._runner(command, prompt, workdir, self._timeout)
        except subprocess.TimeoutExpired:
            logger.warning("IA (Claude CLI): sem resposta dentro do prazo")
            raise LlmError(LlmErrorKind.TIMEOUT, _MSG_TIMEOUT) from None
        except OSError as error:
            logger.warning("IA (Claude CLI): falha ao executar (%s)", type(error).__name__)
            raise LlmError(LlmErrorKind.UNAVAILABLE, _MSG_NOT_FOUND) from None

        text = self._read_result(result)
        if request.json_schema is not None:
            text = extract_json_object(text)
        return LlmCompletion(text=text, model=self.model, fallback_used=False, calls=1)

    def _read_result(self, result: CliResult) -> str:
        data = _parse_json(result.stdout)
        failed = result.returncode != 0 or (isinstance(data, dict) and data.get("is_error") is True)
        if failed:
            detail = " ".join(
                str(part)
                for part in (
                    data.get("result") if isinstance(data, dict) else "",
                    result.stderr,
                    result.stdout if data is None else "",
                )
            ).lower()
            logger.warning(
                "IA (Claude CLI): o CLI terminou com erro (código %s)", result.returncode
            )
            if any(hint in detail for hint in _AUTH_HINTS):
                raise LlmError(LlmErrorKind.REJECTED, _MSG_NOT_LOGGED_IN)
            raise LlmError(LlmErrorKind.UNAVAILABLE, _MSG_FAILED)
        value = data.get("result") if isinstance(data, dict) else None
        text = value.strip() if isinstance(value, str) else ""
        if not text:
            raise LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE)
        return text


def _parse_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except ValueError:
        return None


def extract_json_object(text: str) -> str:
    """O objeto JSON da resposta, sem cercas ```json nem texto em volta."""
    cleaned = text.strip()
    fenced = _FENCE.match(cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise LlmError(LlmErrorKind.BAD_RESPONSE, _MSG_BAD_RESPONSE)
    return cleaned[start : end + 1]


_MSG_TIMEOUT = "O Claude local demorou demais para responder. Tente de novo."
_MSG_NOT_FOUND = (
    "O Claude Code não foi encontrado nesta máquina. Instale-o ou ajuste CLAUDE_CLI_PATH."
)
_MSG_NOT_LOGGED_IN = "O Claude Code não está logado. Rode `claude` no terminal e entre na conta."
_MSG_FAILED = "O Claude local falhou ao responder. Tente de novo."
_MSG_BAD_RESPONSE = "A IA devolveu uma resposta que não pôde ser usada. Tente de novo."
