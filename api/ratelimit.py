"""In-process sliding-window rate limiter.

Per instance only, which is fine for a single free-tier container. Swap for a shared store
if the API ever runs as several instances.
"""

import time
from collections import defaultdict, deque

_hits: dict[str, deque] = defaultdict(deque)


def allow(key: str, limit: int, window_s: int) -> bool:
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def reset() -> None:
    _hits.clear()
