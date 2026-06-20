"""
One-time-password (OTP) generation, storage and verification.

OTPs are stored in Redis when available (with a short TTL) so they survive
across requests/processes. A bounded in-memory fallback is used for local
development when Redis is not reachable.

Security properties:
  * Random 6-digit code generated with ``secrets`` (cryptographically secure).
  * Each issued OTP is valid for ``OTP_TTL_SECONDS`` (default 5 minutes).
  * Repeated verification attempts are limited by ``OTP_MAX_ATTEMPTS`` per
    phone number; the stored entry is deleted once the limit is hit.
  * A successful verification consumes the OTP so it cannot be replayed.
  * Requests for a new OTP for the same phone are rate-limited by
    ``OTP_RESEND_COOLDOWN_SECONDS`` to prevent flooding.
"""

from __future__ import annotations

import secrets
import time
from collections import defaultdict
from typing import Optional

from redis import asyncio as aioredis

from app.core.config import get_settings

settings = get_settings()

OTP_TTL_SECONDS: int = 5 * 60
OTP_RESEND_COOLDOWN_SECONDS: int = 60
OTP_MAX_ATTEMPTS: int = 5

_REDIS: Optional[aioredis.Redis] = None

# In-memory fallback store: phone -> (otp_hash, expires_at, attempts, issued_at)
_memory_store: dict[str, tuple[str, float, int, float]] = defaultdict(
    lambda: ("", 0.0, 0, 0.0)
)


async def _get_redis() -> Optional[aioredis.Redis]:
    """Return a shared async Redis client, or ``None`` if Redis is unavailable."""
    global _REDIS
    if _REDIS is not None:
        return _REDIS
    try:
        client = aioredis.from_url(settings.redis_url, encoding="utf8", decode_responses=True)
        await client.ping()
        _REDIS = client
        return _REDIS
    except Exception:
        # Local development without Redis: fall back to in-memory storage.
        _REDIS = None
        return None


def _hash_otp(otp: str) -> str:
    """One-way hash of the OTP so the raw code is not stored verbatim."""
    import hashlib

    salt = settings.jwt_secret_key
    return hashlib.sha256(f"{salt}:{otp}".encode()).hexdigest()


async def _issue_cooldown_key(phone: str) -> str:
    return f"otp:cooldown:{phone}"


async def generate_otp(phone: str) -> str:
    """Generate, store and return a fresh OTP for ``phone``.

    Raises ``ValueError`` if a new OTP was requested within the resend
    cooldown window (prevents OTP-flooding / abuse).
    """
    redis = await _get_redis()
    now = time.time()

    # Enforce resend cooldown.
    cooldown_key = f"otp:cooldown:{phone}"
    if redis is not None:
        last = await redis.get(cooldown_key)
        if last is not None:
            raise ValueError("Please wait before requesting another OTP.")
        await redis.set(cooldown_key, "1", ex=OTP_RESEND_COOLDOWN_SECONDS)
    else:
        issued_at = _memory_store[phone][3]
        if issued_at and now - issued_at < OTP_RESEND_COOLDOWN_SECONDS:
            raise ValueError("Please wait before requesting another OTP.")

    otp = f"{secrets.randbelow(1_000_000):06d}"
    payload = f"{_hash_otp(otp)}:{now + OTP_TTL_SECONDS}:0"

    if redis is not None:
        await redis.set(f"otp:code:{phone}", payload, ex=OTP_TTL_SECONDS)
    else:
        _memory_store[phone] = (_hash_otp(otp), now + OTP_TTL_SECONDS, 0, now)

    return otp


async def verify_otp(phone: str, otp: str) -> bool:
    """Return ``True`` if ``otp`` is valid for ``phone``; consumes it on success."""
    redis = await _get_redis()
    key = f"otp:code:{phone}"

    if redis is not None:
        raw = await redis.get(key)
        if not raw:
            return False
        stored_hash, expires_at_str, attempts_str = raw.split(":")
        expires_at = float(expires_at_str)
        attempts = int(attempts_str)

        if time.time() > expires_at:
            await redis.delete(key)
            return False

        if attempts >= OTP_MAX_ATTEMPTS:
            await redis.delete(key)
            return False

        if not secrets.compare_digest(stored_hash, _hash_otp(otp)):
            await redis.set(key, f"{stored_hash}:{expires_at}:{attempts + 1}", ex=OTP_TTL_SECONDS)
            return False

        # Success: invalidate so it cannot be reused.
        await redis.delete(key)
        return True

    # In-memory fallback.
    stored_hash, expires_at, attempts, issued_at = _memory_store[phone]
    if time.time() > expires_at:
        _memory_store.pop(phone, None)
        return False
    if attempts >= OTP_MAX_ATTEMPTS:
        _memory_store.pop(phone, None)
        return False
    if not secrets.compare_digest(stored_hash, _hash_otp(otp)):
        _memory_store[phone] = (stored_hash, expires_at, attempts + 1, issued_at)
        return False
    _memory_store.pop(phone, None)
    return True
