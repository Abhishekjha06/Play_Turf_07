# Play Turf – Product Overview

Play Turf is a sports turf booking platform targeting urban players in India (initially Pune). It allows users to discover, filter, and book sports turf slots, view offers and tournaments, and manage their bookings.

## User Roles

- **User (Player)** – browses turfs, books slots, views offers/tournaments, manages profile
- **Admin** – manages turfs, bookings, users, and platform data via a dashboard
- **Client (Turf Owner)** – manages their own turf listing, slots, bookings, and settings via a dedicated client dashboard

## Core Features

- Turf discovery with search, filters (sport, city, price, rating, open now, nearby)
- Hourly slot booking with conflict prevention
- OTP-based phone authentication for players
- Password-based login for admins and clients
- Offers and promotions
- Tournaments listing
- Real-time booking notifications (WebSocket + Supabase)
- Mobile-first UI with a luxury dark theme

## Data Backend

The app supports three data modes, checked in this order:
1. **Supabase** – when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. **FastAPI backend** – when `VITE_BACKEND_URL` is set
3. **In-memory mock** – fallback using `src/data/seed.ts` with localStorage persistence

Default dev credentials: admin `admin@playturf.app / admin123`, client `demo_client / demo123`, OTP always `123456`.
