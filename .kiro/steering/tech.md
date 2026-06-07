# Tech Stack

## Frontend (`/components`)

- **Runtime**: React 18 + TypeScript 5
- **Build tool**: Vite 5 (plugin-react-swc)
- **Routing**: React Router v6
- **State / data fetching**: TanStack Query v5
- **UI components**: ShadCN UI (Radix UI primitives) + Tailwind CSS v3
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation
- **Notifications**: Sonner (toasts)
- **Charts**: Recharts
- **Auth store**: Custom event-emitter pattern in `src/lib/auth.ts` (no Redux/Zustand)
- **HTTP client**: Custom `http()` wrapper in `src/lib/api.ts` with auto token refresh
- **Real-time**: WebSocket (`src/lib/websocket.ts`) + Supabase channels (`src/lib/realtime.ts`)
- **Testing**: Vitest + Testing Library

## Backend (`/backend`)

- **Framework**: FastAPI (Python)
- **Server**: Uvicorn with standard extras
- **ORM**: SQLAlchemy 2 (mapped_column / Mapped style)
- **Migrations**: Alembic
- **Database**: PostgreSQL via psycopg (binary); SQLite fallback for local dev
- **Cache**: Redis via fastapi-cache2
- **Auth**: JWT (python-jose) + bcrypt (passlib) — access token (15 min) + httpOnly refresh cookie (7 days)
- **Config**: pydantic-settings, reads from `.env`
- **Validation**: Pydantic v2 models inline in routers

## Common Commands

### Frontend
```bash
# from /components
npm run dev          # start Vite dev server (port 5173)
npm run build        # production build → dist/
npm run build:dev    # dev-mode build
npm run lint         # ESLint
npm run test         # Vitest single run
npm run test:watch   # Vitest watch mode
npm run preview      # preview production build
```

### Backend
```bash
# from /backend
uvicorn app.main:app --reload          # start dev server (port 8000)
alembic upgrade head                   # run all migrations
alembic revision --autogenerate -m ""  # generate new migration
```

## Environment Variables

### Frontend (`.env` in `/components`)
| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | FastAPI base URL; omit to use mock mode |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

### Backend (`.env` in `/backend`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy DB URL (defaults to SQLite) |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET_KEY` | Must be changed in production |
| `ENVIRONMENT` | `development` or `production` |
| `DEBUG` | `true`/`false` |
| `SECURE_COOKIES` | `true` in production (HTTPS) |
