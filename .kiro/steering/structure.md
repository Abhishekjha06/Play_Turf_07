# Project Structure

The repo is a monorepo with two independent apps — a React frontend and a FastAPI backend.

```
Play_Turf_copy/
├── components/          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # App-level shared components (routes, error boundaries, splash)
│   │   ├── pages/       # One file per route/page (lazy-loaded in App.tsx)
│   │   ├── ui/          # ShadCN UI primitives + custom UI atoms (never put business logic here)
│   │   ├── layout/      # Shell, header, bottom nav, back button
│   │   ├── hooks/       # Custom React hooks (use-auth, use-mobile, use-toast, etc.)
│   │   ├── lib/         # Non-React utilities: api.ts, auth.ts, supabase.ts, websocket.ts
│   │   ├── services/    # Domain service wrappers (turfService, authService, offerService)
│   │   ├── data/        # seed.ts — shared type definitions + mock data
│   │   ├── home/        # Feature-scoped components for the Home page
│   │   ├── turf/        # Turf card components (TurfCard, CompactTurfCard)
│   │   ├── booking/     # Booking-specific components (BookingRow)
│   │   ├── offers/      # Offer card component
│   │   ├── cricket/     # Cricket game module (self-contained: types, context, screens)
│   │   ├── luxury/      # Luxury theme provider + themed components
│   │   └── test/        # Vitest setup and test files
│   ├── public/          # Static assets served as-is
│   └── App.tsx          # Root router — all routes defined here
│
└── backend/             # Backend (FastAPI + SQLAlchemy)
    ├── app/
    │   ├── main.py      # App factory, middleware, startup hooks, router registration
    │   ├── core/        # config.py, security.py, logging.py
    │   ├── db/          # base.py, models.py, session.py
    │   └── modules/     # Feature modules — each has its own router.py
    │       ├── auth/    # OTP auth, admin login, client login, JWT, deps
    │       ├── bookings/
    │       ├── turfs/
    │       ├── health/
    │       └── realtime/
    └── alembic/         # DB migrations
        └── versions/
```

## Key Conventions

### Frontend

- **Path alias**: `@/` maps to `components/src/` — always use this, never relative `../../`
- **Pages** are lazy-loaded via `React.lazy()` in `App.tsx`; add new routes there
- **Data fetching**: use `api.*` from `src/lib/api.ts` or service functions from `src/services/`; UI components do not hit fetch/supabase directly
- **Auth state**: read via `useAuth()` hook; mutate via functions in `src/lib/auth.ts`
- **Data mode**: `api.ts` checks Supabase → FastAPI → mock in that order; new endpoints must implement all three branches
- **Types**: shared types live in `src/data/seed.ts` — import from there, do not redeclare
- **UI**: use existing ShadCN components from `src/ui/` before creating new ones; style with Tailwind utility classes only
- **Toasts**: use `sonner` (`import { toast } from "sonner"`)
- **Forms**: React Hook Form + Zod schema; never use uncontrolled inputs for validated forms

### Backend

- **Module structure**: each feature gets a folder under `app/modules/` with a `router.py`; register the router in `main.py`
- **Models**: defined in `app/db/models.py` using SQLAlchemy 2 `Mapped` / `mapped_column` style
- **Schemas**: Pydantic v2 models are defined inline in the router file they are used in
- **Settings**: always access via `get_settings()` (cached with `lru_cache`); never read `os.environ` directly
- **DB sessions**: inject via `Depends(get_db)`; never create sessions manually in route handlers
- **Auth dependency**: protect routes with `Depends(get_current_user)` from `app/modules/auth/deps.py`
- **Migrations**: every model change needs an Alembic migration — never use `create_all` for schema changes in production
- **Error responses**: raise `HTTPException` with appropriate status codes; unhandled exceptions are caught by the global handler in `main.py`
