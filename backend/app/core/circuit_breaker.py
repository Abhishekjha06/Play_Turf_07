"""Circuit breaker pattern for protecting against cascading failures.

Trips when a dependency exceeds failure/slow thresholds, fast-failing
subsequent requests until a recovery timeout passes.
"""

from __future__ import annotations

import asyncio
import functools
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, TypeVar

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Failing fast
    HALF_OPEN = "half_open" # Testing recovery


@dataclass
class CircuitBreakerConfig:
    """Configuration for a circuit breaker."""
    # Trip after this many failures within the window
    failure_threshold: int = 5
    # Time window (seconds) for counting failures
    failure_window_seconds: float = 60.0
    # How long to stay OPEN before trying HALF_OPEN
    recovery_timeout_seconds: float = 30.0
    # Half-open: allow this many test requests
    half_open_max_calls: int = 3
    # Slow-call threshold (seconds) — counts as failure
    slow_call_threshold_seconds: float = 5.0
    # Max concurrent requests to this dependency
    max_concurrency: int = 20


@dataclass
class _CircuitRecord:
    failures: list[float] = field(default_factory=list)
    state: CircuitState = CircuitState.CLOSED
    opened_at: float = 0.0
    half_open_calls: int = 0
    concurrency: int = 0


class CircuitBreaker:
    """
    Thread-safe circuit breaker for async functions.

    Usage:
        cb = CircuitBreaker("supabase", CircuitBreakerConfig())
        result = await cb.call(my_async_function, arg1, arg2)
    """

    def __init__(self, name: str, config: CircuitBreakerConfig | None = None) -> None:
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self._record = _CircuitRecord()
        self._lock = asyncio.Lock()

    def _now(self) -> float:
        return time.monotonic()

    def _trim_failures(self) -> None:
        cutoff = self._now() - self.config.failure_window_seconds
        self._record.failures = [f for f in self._record.failures if f > cutoff]

    def _should_trip(self) -> bool:
        self._trim_failures()
        return len(self._record.failures) >= self.config.failure_threshold

    async def call(
        self,
        fn: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        async with self._lock:
            record = self._record

            # Concurrency limit
            if record.concurrency >= self.config.max_concurrency:
                raise CircuitBreakerError(
                    f"Circuit '{self.name}' concurrency limit exceeded ({self.config.max_concurrency})"
                )

            # State machine
            if record.state == CircuitState.OPEN:
                if self._now() - record.opened_at >= self.config.recovery_timeout_seconds:
                    record.state = CircuitState.HALF_OPEN
                    record.half_open_calls = 0
                else:
                    raise CircuitBreakerError(
                        f"Circuit '{self.name}' is OPEN — dependency unavailable. Retry after {self.config.recovery_timeout_seconds}s."
                    )

            if record.state == CircuitState.HALF_OPEN:
                if record.half_open_calls >= self.config.half_open_max_calls:
                    raise CircuitBreakerError(
                        f"Circuit '{self.name}' is HALF_OPEN — test quota exhausted."
                    )
                record.half_open_calls += 1

            record.concurrency += 1

        start = self._now()
        try:
            result = await fn(*args, **kwargs)
            elapsed = self._now() - start

            # Slow call counts as failure
            if elapsed > self.config.slow_call_threshold_seconds:
                await self._record_failure()
            else:
                await self._record_success()

            return result
        except CircuitBreakerError:
            raise
        except Exception as exc:
            await self._record_failure()
            raise CircuitBreakerError(
                f"Circuit '{self.name}' recorded failure: {exc}"
            ) from exc
        finally:
            async with self._lock:
                self._record.concurrency = max(0, self._record.concurrency - 1)

    async def _record_failure(self) -> None:
        async with self._lock:
            self._record.failures.append(self._now())
            self._trim_failures()
            if self._should_trip() and self._record.state != CircuitState.OPEN:
                self._record.state = CircuitState.OPEN
                self._record.opened_at = self._now()
                self._record.half_open_calls = 0

    async def _record_success(self) -> None:
        async with self._lock:
            if self._record.state == CircuitState.HALF_OPEN:
                # Success in half-open → close the circuit
                self._record.state = CircuitState.CLOSED
                self._record.failures.clear()
                self._record.half_open_calls = 0

    def get_state(self) -> dict:
        """Return circuit state for health monitoring."""
        self._trim_failures()
        return {
            "name": self.name,
            "state": self._record.state.value,
            "failures_in_window": len(self._record.failures),
            "threshold": self.config.failure_threshold,
            "concurrency": self._record.concurrency,
            "max_concurrency": self.config.max_concurrency,
        }


class CircuitBreakerError(Exception):
    """Raised when a circuit breaker is OPEN or has exceeded limits."""
    pass


# Global registry of circuit breakers
_BREAKERS: dict[str, CircuitBreaker] = {}


def get_breaker(name: str, config: CircuitBreakerConfig | None = None) -> CircuitBreaker:
    """Get or create a named circuit breaker."""
    if name not in _BREAKERS:
        _BREAKERS[name] = CircuitBreaker(name, config)
    return _BREAKERS[name]


def breaker(name: str, config: CircuitBreakerConfig | None = None):
    """Decorator to wrap an async function with a circuit breaker."""
    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        cb = get_breaker(name, config)

        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await cb.call(fn, *args, **kwargs)

        return wrapper
    return decorator
