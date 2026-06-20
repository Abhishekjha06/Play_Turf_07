"""
Rate limiting helpers built on top of ``slowapi``.

A single shared limiter is exposed via ``limiter`` and ``RateLimitMiddleware``
is applied to the FastAPI app. When the backend runs behind a proxy/load
balancer, set ``FORWARDED_ALLOW_IPS`` / use ``X-Forwarded-For`` handling so
that the correct client IP is used as the rate-limit key.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed by client IP. For more advanced setups (e.g. per-user limits) decorate
# the route with a custom ``key_func`` that reads the authenticated user id.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
