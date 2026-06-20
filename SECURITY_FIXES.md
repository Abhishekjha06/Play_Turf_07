# Security Fixes

This document tracks security-hardening changes applied to the Play Turf
backend and repository. Each entry describes the issue, the fix, and any
follow-up expected from operators.

> Last updated: 2026-06-20

---

## 1. Strict time/date input validation in bookings

**File:** `backend/app/modules/bookings/router.py`

### Problem

The `POST /bookings` endpoint accepted free-form strings for `date` and
`start_time` and an unbounded integer for `hours`. Validation was performed
inside the route handler with broad `except Exception` blocks that silently
swallowed errors, so malformed input (e.g. `start_time="99:99"`,
`hours=-5`, `date="tomorrow"`) could slip past the checks and reach the
database. The expiry/overlap logic also relied on `datetime.utcnow()`, which
is timezone-naive and deprecated in Python 3.12.

### Fix

Input is now validated at the schema boundary with Pydantic
`field_validator`s before the handler runs:

| Field        | Rule                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `turf_id`    | Must parse to a positive integer.                                             |
| `date`       | Strict `YYYY-MM-DD`; cannot be in the past; max 90 days ahead.                |
| `start_time` | Strict `HH:MM` 24-hour format.                                                |
| `hours`      | Integer between `MIN_HOURS` (1) and `MAX_HOURS` (12).                        |
| End time     | Computed `start + hours` cannot cross 24:00.                                  |

Additionally:

- All "now"/"today" comparisons are localized to IST (`Asia/Kolkata`) via a
  module-level `IST = pytz.timezone("Asia/Kolkata")` constant. The server is
  assumed to run in UTC.
- `datetime.utcnow()` (deprecated) in `upcoming_bookings` was replaced with
  `datetime.now(IST)`.
- The fragile `try/except Exception: pass` blocks were removed; expiry and
  overlap now raise explicit `HTTPException`s with the correct status codes
  (`400`, `409`).
- The ad-hoc `import pytz` inside the handler was hoisted to the module top
  (it was previously imported lazily, which made the dependency invisible to
  `requirements.txt`).

### Operator notes

- `pytz` is now an explicit dependency in `requirements.txt`.
- Bounds (`MAX_HOURS`, `MAX_ADVANCE_DAYS`) are constants near the top of the
  router and can be tuned without touching the validation logic.

---

## 2. `.gitignore` hardened for secrets and build artifacts

**File:** `.gitignore`

### Problem

The repository `.gitignore` contained only `node_modules`. Local databases,
environment files, logs, and build output could be accidentally committed.

### Fix

Expanded `.gitignore` to exclude:

- **Secrets/env** — `.env`, `.env.*` (with `!.env.example` so the template
  stays tracked).
- **Databases** — `*.db`, `*.db-journal`, `*.sqlite`, `*.sqlite3`,
  `play_turf.db`.
- **Logs** — `*.log`, `logs/`.
- **Build/dist** — `dist/`, `build/`, `.next/`, `.cache/`, `*.tsbuildinfo`.
- **Python artifacts** — `__pycache__/`, `*.pyc`, `.venv/`, `.pytest_cache/`,
  etc.

### Known follow-up

`vite-dev.log` and `vite-dev.err.log` are **already tracked** in git history,
so `.gitignore` will not remove them automatically. They contain dev-server
output and should be untracked in a follow-up commit:

```bash
git rm --cached vite-dev.log vite-dev.err.log
git commit -m "chore: stop tracking dev server logs"
```

(Note: removing them from prior history requires a history rewrite and is
out of scope for this change.)

---

## 3. Backend dependencies pinned to current versions

**File:** `backend/requirements.txt`

### Problem

All dependencies were unpinned. Builds were non-reproducible and a breaking
upstream release (e.g. a Pydantic v2 minor, or an incompatible `fastapi`
patch) could silently break or weaken security-sensitive code paths
(JWT validation, password hashing, rate limiting).

A second, more serious problem was found while verifying: the code imported
packages that were **not declared** in `requirements.txt` at all. In
particular `pytz` (used by the bookings router for IST timezone handling)
was missing entirely, which would crash `POST /bookings` at runtime with
`ModuleNotFoundError`. `slowapi` and `fastapi-cache2` are imported by
`app/main.py` and `app/core/rate_limit.py` and were likewise undeclared.

### Fix

Every dependency is now pinned to an exact `==X.Y.Z` version — chosen to
match the versions actually installed and verified in the local venv
(Python 3.14), not estimated:

- `fastapi==0.136.1`, `uvicorn[standard]==0.46.0`
- `SQLAlchemy==2.0.49`, `alembic==1.18.4`, `psycopg[binary]==3.3.4`
- `python-jose[cryptography]==3.5.0`, `passlib[bcrypt]==1.7.4`
- `pydantic-settings==2.14.1`, `python-multipart==0.0.27`
- `redis==4.6.0`, `fastapi-cache2[redis]==0.2.2`, `slowapi==0.1.10`
- `pytz==2026.2` (newly explicit — see §1)

### Verification

- `from app.main import app` now imports cleanly (was failing before
  `pytz` was added). The app exposes 19 routes.
- Booking input validation exercised end-to-end (see checklist): all 8
  cases (422 schema rejects, 404 missing turf, 201 success, 409 overlap)
  behaved as expected.

### Operator notes

- `fastapi-cache2==0.2.2` pins `redis<5`; that is why `redis` is held at
  `4.6.0` rather than the latest 7.x. Do not raise `redis` without first
  confirming `fastapi-cache2` compatibility, or the cache backend import
  will break.
- The local venv runs **Python 3.14**, while `backend/Dockerfile` pins
  `python:3.12-slim`. The declared pins were verified on 3.14; if you
  build via the Dockerfile, rebuild and re-test on 3.12 to confirm.
- `python-jose` is in maintenance mode; evaluate migrating to
  `pyca/cryptography` or `authlib` during a future dependency refresh.
- A separate latent issue was observed: `passlib[bcrypt]` raises a
  `ValueError` during its `detect_wrap_bug` self-test on bcrypt 4.x /
  Python 3.14, which can affect password-hash seeding. This is
  pre-existing and out of scope for these fixes, but worth tracking.

---

## 4. Pre-existing security posture (context)

These items were already in place and are documented here for completeness —
they form the baseline against which the fixes above were applied.

- **JWT secret validation** (`backend/app/core/config.py`) — placeholder
  secrets (`change-me-in-prod`, etc.) are rejected in any environment other
  than `development`/`docker`; real secrets must be ≥32 characters.
- **Password hashing** (`backend/app/core/security.py`) — bcrypt via
  `passlib.CryptContext`; tokens use `datetime.now(UTC)` with explicit
  `iat`/`exp` claims.
- **CORS** — origins are configurable via `ALLOWED_ORIGINS`, defaulting to
  localhost only.
- **Rate limiting** (`backend/app/core/rate_limit.py`) — `slowapi` limiter
  keyed by remote address. When behind a proxy, set
  `FORWARDED_ALLOW_IPS` / trust `X-Forwarded-For` so the real client IP is
  used.
- **Bootstrap credentials** — demo `admin123`/`demo123` defaults were
  removed; seeding now requires explicit `SEED_*` env vars.

---

## Verification checklist

- [x] `python -m py_compile backend/app/modules/bookings/router.py` passes.
- [x] `.gitignore` verified: `.env`, `*.db`, `*.log`, `dist/` ignored;
      `.env.example` still tracked.
- [x] `requirements.txt` parses and every line carries an exact pin.
- [x] `from app.main import app` imports cleanly (19 routes) after adding
      the previously-missing `pytz` dependency.
- [x] Booking schema validation: 9 unit cases pass (valid/bad turf_id,
      past/far-future/bad date, bad time, zero/too-many hours, whitespace).
- [x] Booking endpoint behavior via the route function: past date→422,
      bad time→422, zero hours→422, too-many hours→422, bad turf_id→422,
      nonexistent turf→404, valid booking→201, overlap→409.
- [ ] Re-verify on Python 3.12 (the `python:3.12-slim` Docker base), since
      the local venv is Python 3.14.
