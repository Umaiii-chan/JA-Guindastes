"""Limite simples de uso da IA por usuário, em memória (TASK-076; ADR-039).

Por padrão, 20 chamadas por hora por usuário (janela deslizante). O estado é **por processo**: com
mais de uma réplica, cada uma conta as suas, e reiniciar o processo zera as contagens (mesma
limitação do limite de login, ADR-016). Seguro para threads, porque as rotas síncronas do FastAPI
rodam em threads à parte. Chaves sem chamada recente são descartadas quando o total passa de
`max_tracked_keys`, para a memória não crescer sem limite.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable

from app.application.ports.ai_usage_limiter import UsageDecision

DEFAULT_LIMIT_PER_HOUR = 20
WINDOW_SECONDS = 3600.0
DEFAULT_MAX_TRACKED_KEYS = 10_000


class InMemoryAiUsageLimiter:
    """Implementa a porta `AiUsageLimiter`."""

    def __init__(
        self,
        *,
        limit: int = DEFAULT_LIMIT_PER_HOUR,
        window_seconds: float = WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        max_tracked_keys: int = DEFAULT_MAX_TRACKED_KEYS,
    ) -> None:
        if limit < 1:
            raise ValueError("o limite de chamadas deve ser pelo menos 1")
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._max_tracked_keys = max_tracked_keys
        self._calls: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    @property
    def limit(self) -> int:
        return self._limit

    def acquire(self, key: str) -> UsageDecision:
        with self._lock:
            now = self._clock()
            calls = self._calls.get(key)
            if calls is None:
                if len(self._calls) >= self._max_tracked_keys:
                    self._discard_stale_keys(now)
                calls = self._calls.setdefault(key, deque())
            while calls and now - calls[0] >= self._window:
                calls.popleft()
            if len(calls) >= self._limit:
                wait = self._window - (now - calls[0])
                return UsageDecision(
                    allowed=False, remaining=0, retry_after_seconds=max(1, math.ceil(wait))
                )
            calls.append(now)
            return UsageDecision(
                allowed=True, remaining=self._limit - len(calls), retry_after_seconds=0
            )

    def _discard_stale_keys(self, now: float) -> None:
        stale = [
            key
            for key, calls in self._calls.items()
            if not calls or now - calls[-1] >= self._window
        ]
        for key in stale:
            del self._calls[key]
