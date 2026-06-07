# play_Turf backend

FastAPI service scaffold for the production migration.

## Run locally

### One command (Windows PowerShell)

- `./start.ps1`

This script creates `.venv`, installs dependencies, seeds `.env` from `.env.example`, and starts uvicorn.

### Manual

1. Create and activate a virtualenv.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Start API:
   - `uvicorn app.main:app --reload --port 8000`

## Alembic migrations

- Create migration:
  - `alembic revision --autogenerate -m "init schema"`
- Apply migrations:
  - `alembic upgrade head`

## Current implemented slices

- `GET /api/health`
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/turfs`
- `POST /api/bookings`
- `GET /api/bookings/me`

## Next migration targets

- SQLAlchemy models + Alembic migrations
- JWT verification dependency and RBAC guards
- Redis-backed lock and rate-limit middleware
- Payment/webhook flow and idempotency keys
