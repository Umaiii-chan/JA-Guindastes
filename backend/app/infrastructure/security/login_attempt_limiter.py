"""Limite de tentativas de login em memória (ADR-016 § 3; TASK-038).

5 falhas por `username` em 15 min bloqueiam novas tentativas desse `username` até a falha mais
antiga sair da janela. O estado é **por processo**: com mais de uma réplica, cada uma conta as
suas (dívida registrada no ADR-016). Reiniciar o processo zera as contagens.

Seguro para threads: as rotas síncronas do FastAPI rodam em threads à parte. Para a memória não
crescer sem limite com muitos nomes diferentes, as chaves sem falha dentro da janela são descartadas
quando o total passa de `max_tracked_keys`.
"""

import threading
import time
from collections import deque
from collections.abc import Callable

MAX_FAILURES = 5
WINDOW_SECONDS = 15 * 60
DEFAULT_MAX_TRACKED_KEYS = 10_000


class InMemoryLoginAttemptLimiter:
    """Implementa a porta `LoginAttemptLimiter`."""

    def __init__(
        self,
        *,
        max_failures: int = MAX_FAILURES,
        window_seconds: float = WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        max_tracked_keys: int = DEFAULT_MAX_TRACKED_KEYS,
    ) -> None:
        self._max_failures = max_failures
        self._window = window_seconds
        self._clock = clock
        self._max_tracked_keys = max_tracked_keys
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def is_blocked(self, key: str) -> bool:
        with self._lock:
            failures = self._recent_failures(key, self._clock())
            return failures is not None and len(failures) >= self._max_failures

    def register_failure(self, key: str) -> None:
        with self._lock:
            now = self._clock()
            failures = self._recent_failures(key, now)
            if failures is None:
                if len(self._failures) >= self._max_tracked_keys:
                    self._discard_stale_keys(now)
                failures = self._failures.setdefault(key, deque())
            failures.append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def _recent_failures(self, key: str, now: float) -> deque[float] | None:
        """Falhas da chave dentro da janela (descarta as antigas), ou `None` se não há nenhuma."""
        failures = self._failures.get(key)
        if failures is None:
            return None
        while failures and failures[0] <= now - self._window:
            failures.popleft()
        if not failures:
            del self._failures[key]
            return None
        return failures

    def _discard_stale_keys(self, now: float) -> None:
        for key in list(self._failures):
            self._recent_failures(key, now)
