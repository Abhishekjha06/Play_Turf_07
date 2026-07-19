"""Smart compression middleware with brotli + gzip support.

Avoids double-compressing already-compressed or binary payloads.
Responds with the best encoding the client accepts.
"""

from __future__ import annotations

import gzip
import io
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Optional brotli support — gracefully degrade to gzip if unavailable
try:
    import brotli
    HAS_BROTLI = True
except ImportError:  # pragma: no cover
    HAS_BROTLI = False

# Content types that compress well
COMPRESSIBLE_TYPES = {
    "application/json",
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/xml",
    "text/xml",
    "application/rss+xml",
    "text/rss+xml",
}

# Already-compressed or binary types that should NEVER be double-compressed
ALREADY_COMPRESSED_CONTENT_TYPES = {
    "image/",
    "video/",
    "audio/",
    "application/pdf",
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/x-brotli",
    "application/octet-stream",
    "font/",
    "application/font-",
    "application/vnd.ms-fontobject",
    "application/wasm",
}

# Already-compressed encodings — skip if response already has Content-Encoding
SKIP_ENCODINGS = {"gzip", "deflate", "br", "compress", "identity"}

MINIMUM_SIZE = 1000  # Don't compress responses smaller than this


def _should_compress(response: Response) -> bool:
    """Return True if the response body should be compressed."""
    # Already encoded? Skip.
    content_encoding = response.headers.get("content-encoding", "").lower()
    if content_encoding and content_encoding in SKIP_ENCODINGS:
        return False

    # Check content type
    content_type = response.headers.get("content-type", "").lower()
    # Strip charset suffix for matching
    content_type = content_type.split(";")[0].strip()

    # Is it already compressed/binary?
    for prefix in ALREADY_COMPRESSED_CONTENT_TYPES:
        if content_type.startswith(prefix):
            return False

    # Is it a known compressible type?
    if content_type in COMPRESSIBLE_TYPES:
        return True

    # Default to compressing text/* and application/*
    if content_type.startswith("text/") or content_type.startswith("application/"):
        return True

    return False


def _parse_accept_encoding(accept_encoding: str) -> tuple[bool, bool]:
    """Parse Accept-Encoding header. Returns (accepts_brotli, accepts_gzip)."""
    if not accept_encoding:
        return False, False

    encodings = [e.strip().lower() for e in accept_encoding.split(",")]
    # Handle quality values (e.g., "gzip;q=0.8")
    parsed = {}
    for enc in encodings:
        if ";" in enc:
            name, q = enc.split(";", 1)
            name = name.strip()
            try:
                q_val = float(q.split("=")[1]) if "=" in q else 1.0
            except (ValueError, IndexError):
                q_val = 1.0
        else:
            name = enc
            q_val = 1.0
        parsed[name] = q_val

    # Brotli preferred over gzip if both supported
    accepts_brotli = HAS_BROTLI and parsed.get("br", 0) > 0
    accepts_gzip = parsed.get("gzip", 0) > 0 or parsed.get("deflate", 0) > 0
    return accepts_brotli, accepts_gzip


class _CompressedResponse(Response):
    """Helper to build a compressed response from a raw response."""

    def __init__(
        self,
        body: bytes,
        encoding: str,
        status_code: int,
        headers: dict,
        media_type: str | None = None,
    ):
        super().__init__(content=body, status_code=status_code, headers=headers, media_type=media_type)
        self.headers["content-encoding"] = encoding
        self.headers["content-length"] = str(len(body))
        # Vary header so caches keep separate compressed/uncompressed variants
        vary = self.headers.get("vary", "")
        if vary:
            if "accept-encoding" not in vary.lower():
                self.headers["vary"] = f"{vary}, Accept-Encoding"
        else:
            self.headers["vary"] = "Accept-Encoding"


class SmartCompressionMiddleware(BaseHTTPMiddleware):
    """
    ASGI middleware that compresses responses with brotli (preferred) or gzip,
    while avoiding double-compression of already-compressed payloads.

    - Only compresses JSON, text, HTML, CSS, JS, XML, and similar text types.
    - Skips images, videos, audio, PDFs, fonts, wasm, and already-encoded responses.
    - Only compresses responses >= 1000 bytes (configurable via `minimum_size`).
    - Adds `Vary: Accept-Encoding` so CDNs/proxies cache correctly.
    """

    def __init__(self, app: ASGIApp, minimum_size: int = MINIMUM_SIZE) -> None:
        super().__init__(app)
        self.minimum_size = minimum_size

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Only compress successful responses
        if response.status_code < 200 or response.status_code >= 300:
            return response

        # Skip streaming responses (handled separately if needed)
        if isinstance(response, StreamingResponse):
            return response

        # Check if we should compress this response type
        if not _should_compress(response):
            return response

        # Get body bytes
        body = b""
        if hasattr(response, "body"):
            body = response.body
        else:
            async for chunk in response.body_iterator:
                body += chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")

        # Skip small responses
        if len(body) < self.minimum_size:
            return response

        # Parse client Accept-Encoding
        accept_encoding = request.headers.get("accept-encoding", "")
        accepts_brotli, accepts_gzip = _parse_accept_encoding(accept_encoding)

        if not accepts_brotli and not accepts_gzip:
            return response

        # Compress
        if accepts_brotli and HAS_BROTLI:
            compressed = brotli.compress(body, quality=4)
            encoding = "br"
        else:
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=5) as gz:
                gz.write(body)
            compressed = buf.getvalue()
            encoding = "gzip"

        # Only use compressed if it's actually smaller
        if len(compressed) >= len(body):
            return response

        # Build compressed response preserving original headers
        new_headers = dict(response.headers)
        # Remove content-length — it will be wrong after compression
        new_headers.pop("content-length", None)
        new_headers.pop("content-encoding", None)

        return _CompressedResponse(
            body=compressed,
            encoding=encoding,
            status_code=response.status_code,
            headers=new_headers,
            media_type=response.media_type,
        )
