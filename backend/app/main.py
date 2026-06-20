from uuid import uuid4
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import select
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.rate_limit import limiter
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import Turf, User
from app.db.session import SessionLocal, engine
from app.modules.auth.router import router as auth_router
from app.modules.auth.client_router import router as client_auth_router
from app.modules.bookings.router import router as bookings_router
from app.modules.health.router import router as health_router
from app.modules.turfs.router import router as turfs_router
from app.modules.realtime.router import router as realtime_router

settings = get_settings()
setup_logging()

app = FastAPI(title=settings.app_name, debug=settings.debug)

# Rate limiting (slowapi). State + exception handler + middleware.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.on_event("startup")
async def startup() -> None:
    # Initialize Redis cache for fastapi-cache2
    redis = aioredis.from_url(settings.redis_url, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="playturf-cache")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed turfs
        existing = db.scalar(select(Turf.id).limit(1))
        if existing is None:
            db.add_all(
                [
                    Turf(
                        name="Arena 7",
                        city="Pune",
                        address="Baner",
                        price_per_hour=1200,
                        rating=4.7,
                        is_popular=True,
                        is_nearby=True,
                    ),
                    Turf(
                        name="Night Strikers",
                        city="Pune",
                        address="Wakad",
                        price_per_hour=1000,
                        rating=4.4,
                    ),
                ]
            )
            db.commit()

        # Seed admin user (only when SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are set).
        # SECURITY: no default password is ever seeded. Operators must provide a
        # strong bootstrap password via env, ideally for development only.
        if settings.seed_admin_email and settings.seed_admin_password:
            existing_admin = db.scalar(select(User.id).where(User.email == settings.seed_admin_email))
            if existing_admin is None:
                admin = User(
                    phone="0000000000",
                    email=settings.seed_admin_email,
                    name="Admin",
                    role="admin",
                    is_active=True,
                    password_hash=get_password_hash(settings.seed_admin_password),
                )
                db.add(admin)
                db.commit()

        # Seed demo client user (only when SEED_CLIENT_ID / SEED_CLIENT_PASSWORD are set).
        if settings.seed_client_id and settings.seed_client_password:
            existing_client = db.scalar(select(User.id).where(User.client_id == settings.seed_client_id))
            if existing_client is None:
                client = User(
                    phone="0000000001",
                    email="client@playturf.app",
                    name="Demo Client",
                    role="client",
                    is_active=True,
                    client_id=settings.seed_client_id,
                    password_hash=get_password_hash(settings.seed_client_password),
                )
                db.add(client)
                db.commit()
    finally:
        db.close()


@app.middleware("http")
async def add_request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
    return response


logger = logging.getLogger("app.errors")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # SECURITY: log full detail server-side only; expose only a generic
    # message + the request id so clients can correlate without learning
    # anything about the internal error.
    request_id = request.headers.get("x-request-id", "-")
    logger.exception("Unhandled exception (request_id=%s): %s", request_id, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
    )


app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(client_auth_router, prefix=settings.api_prefix)
app.include_router(turfs_router, prefix=settings.api_prefix)
app.include_router(bookings_router, prefix=settings.api_prefix)
app.include_router(realtime_router, prefix=settings.api_prefix)
