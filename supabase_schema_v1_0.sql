-- ====================================================================
-- PLAY_TURF OPEN GAME SYSTEM v1.0 — PRODUCTION SCHEMA
-- Date: 2026-07-02
-- Purpose: Clean separation of Booking (turf ownership) from Game (event).
--          Run this ONCE in the Supabase SQL Editor.
-- ====================================================================

-- ====================================================================
-- 0. MIGRATION: Drop old conflicting objects (if migrating from v0.x)
--    WARNING: This destroys existing open_game data. Backup first.
-- ====================================================================

-- Drop views that depend on columns we are removing
DROP VIEW IF EXISTS public.booking_availability CASCADE;

-- Drop old tables
DROP TABLE IF EXISTS public.open_game_players CASCADE;
DROP TABLE IF EXISTS public.open_games CASCADE;

-- Drop old columns that violate separation of concerns (Booking ≠ Game)
ALTER TABLE public.bookings DROP COLUMN IF EXISTS open_game_id;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS is_split_booking;

-- Drop old indexes
drop index if exists public.unique_active_booking;

-- Drop old triggers on bookings (will be recreated with new logic)
drop trigger if exists on_booking_change on public.bookings;
drop trigger if exists trg_check_booking_overlap_and_expiry on public.bookings;

-- Drop old functions that will be recreated
drop function if exists public.check_booking_overlap_and_expiry();

-- drop realtime publication additions for old tables (safe re-run)
do $$
declare
    v_has_pub boolean;
begin
    select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into v_has_pub;
    if v_has_pub then
        -- remove old tables from publication if they exist (ignore errors)
        begin
            alter publication supabase_realtime drop table public.open_games;
        exception when undefined_table then
            null;
        end;
        begin
            alter publication supabase_realtime drop table public.open_game_players;
        exception when undefined_table then
            null;
        end;
    end if;
end
$$;

-- ====================================================================
-- 1. CORE TABLES (profiles, turfs, offers, banners, tournaments, reviews, favorites)
--    — These are kept as-is from the original schema.
-- ====================================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    phone varchar(10) not null,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    constraint phone_length check (phone ~ '^[0-9]{10}$')
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;

-- turfs
CREATE TABLE IF NOT EXISTS public.turfs (
    id text PRIMARY KEY,
    name text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    lat double precision,
    lng double precision,
    image text NOT NULL,
    gallery text[] NOT NULL DEFAULT '{}',
    rating double precision NOT NULL DEFAULT 4.5,
    timing text NOT NULL,
    price_per_hour double precision NOT NULL,
    sport_types text[] NOT NULL DEFAULT '{}',
    amenities text[] NOT NULL DEFAULT '{}',
    videos text[] DEFAULT '{}',
    description text,
    is_popular boolean NOT NULL DEFAULT false,
    is_nearby boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- offers, banners, tournaments, reviews, favorites (kept as-is)
CREATE TABLE IF NOT EXISTS public.offers (
    id text PRIMARY KEY, title text NOT NULL, subtitle text NOT NULL,
    badge text NOT NULL, image text NOT NULL, discount text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.banners (
    id text PRIMARY KEY, title text NOT NULL, highlight text NOT NULL,
    subtitle text NOT NULL, image text NOT NULL, badge text NOT NULL,
    cta_text text NOT NULL, cta_link text NOT NULL, "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tournaments (
    id text PRIMARY KEY, name text NOT NULL, sport text NOT NULL,
    location text NOT NULL, image text NOT NULL, date text NOT NULL,
    prize_pool text NOT NULL, teams integer NOT NULL, entry_fee double precision NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id text PRIMARY KEY, turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    user_id text NOT NULL, user_name text NOT NULL, rating double precision NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorites (
    id text PRIMARY KEY, user_id text NOT NULL, turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_turf UNIQUE (user_id, turf_id)
);

-- ====================================================================
-- 2. BOOKINGS TABLE (v1.0) — Turf Ownership Layer
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    turf_name text NOT NULL DEFAULT '',
    turf_image text NOT NULL DEFAULT '',
    date text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    hours double precision NOT NULL DEFAULT 1,
    price_per_hour double precision NOT NULL DEFAULT 0,
    total_amount double precision NOT NULL DEFAULT 0,
    booking_type text NOT NULL DEFAULT 'private',
    status text NOT NULL DEFAULT 'confirmed',
    payment_status text NOT NULL DEFAULT 'pending',
    payment_id text,
    receipt_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT ck_bookings_booking_type CHECK (booking_type IN ('private', 'open_game')),
    CONSTRAINT ck_bookings_status CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    CONSTRAINT ck_bookings_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Add missing columns if migrating from older schema
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_time text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS price_per_hour double precision NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_amount double precision NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'private';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Remove old columns that violated separation of concerns
ALTER TABLE public.bookings DROP COLUMN IF EXISTS open_game_id;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS is_split_booking;

-- Ensure bookings.id has a default for new inserts from functions
-- (Old schema had id text PRIMARY KEY with no default; new functions do INSERT without id)
ALTER TABLE public.bookings ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Normalize old status values to lowercase before creating new indexes
-- (Old schema used 'PENDING', 'CANCELLED', 'CONFIRMED'; new schema uses lowercase)
UPDATE public.bookings SET status = LOWER(status);

-- Deduplicate: keep only the most recent active booking per (turf_id, date, start_time)
-- Mark older duplicates as cancelled so the unique index can be created safely
WITH dups AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY turf_id, date, start_time 
                              ORDER BY created_at DESC, id DESC) as rn
    FROM public.bookings
    WHERE status NOT IN ('cancelled', 'completed')
)
UPDATE public.bookings
SET status = 'cancelled',
    payment_status = 'failed'
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_turf_id ON public.bookings(turf_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON public.bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);

-- Unique constraint: one active booking per turf per exact slot (exact date + start_time)
-- Full overlap prevention is enforced by the trigger below.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking
ON public.bookings (turf_id, date, start_time)
WHERE status NOT IN ('cancelled', 'completed');

-- View for non-sensitive booking timing checks (used by frontend / availability checks)
CREATE OR REPLACE VIEW public.booking_availability AS
SELECT id, turf_id, date, start_time, end_time, hours, status, booking_type, payment_status, created_at
FROM public.bookings;

-- ====================================================================
-- 3. GAMES TABLE (v1.0) — Event Layer built on top of a Booking
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id text NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,

    sport text NOT NULL,
    visibility text NOT NULL DEFAULT 'public',
    title text,
    description text,
    game_code text UNIQUE,

    skill_level text,
    gender text,
    age_limit integer,

    max_players integer NOT NULL DEFAULT 10,
    joined_players integer NOT NULL DEFAULT 1,
    waiting_players integer NOT NULL DEFAULT 0,
    price_per_player double precision NOT NULL DEFAULT 0,

    status text NOT NULL DEFAULT 'open',
    allow_waitlist boolean NOT NULL DEFAULT true,
    allow_invites boolean NOT NULL DEFAULT true,

    -- Denormalized from booking for fast querying without a join
    start_time text NOT NULL,
    end_time text NOT NULL,
    date text NOT NULL,

    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uq_games_booking UNIQUE (booking_id),
    CONSTRAINT ck_games_status CHECK (status IN ('draft', 'open', 'full', 'started', 'completed', 'cancelled')),
    CONSTRAINT ck_games_visibility CHECK (visibility IN ('public', 'private')),
    CONSTRAINT ck_games_joined_max CHECK (joined_players <= max_players),
    CONSTRAINT ck_games_waiting_nonneg CHECK (waiting_players >= 0)
);

CREATE INDEX IF NOT EXISTS idx_games_host_id ON public.games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_visibility ON public.games(visibility);
CREATE INDEX IF NOT EXISTS idx_games_sport ON public.games(sport);
CREATE INDEX IF NOT EXISTS idx_games_date ON public.games(date);
CREATE INDEX IF NOT EXISTS idx_games_turf_id ON public.games(turf_id);
CREATE INDEX IF NOT EXISTS idx_games_game_code ON public.games(game_code) WHERE game_code IS NOT NULL;

-- ====================================================================
-- 4. GAME_PLAYERS TABLE (v1.0) — Player Relationship to a Game
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.game_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'joined',
    payment_status text NOT NULL DEFAULT 'pending',

    joined_at timestamp with time zone,
    approved_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    left_at timestamp with time zone,

    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

    CONSTRAINT uq_game_player UNIQUE (game_id, user_id),
    CONSTRAINT ck_game_player_status CHECK (
        status IN ('pending', 'approved', 'payment_pending', 'joined', 'checked_in',
                   'completed', 'rejected', 'cancelled', 'removed', 'no_show')
    ),
    CONSTRAINT ck_game_player_payment_status CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON public.game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON public.game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_status ON public.game_players(status);

-- ====================================================================
-- 5. GAME_WAITLIST TABLE (v1.0) — Waitlist for full games
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.game_waitlist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    status text NOT NULL DEFAULT 'waiting',
    requested_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    notified_at timestamp with time zone,
    converted_at timestamp with time zone,

    CONSTRAINT uq_game_waitlist UNIQUE (game_id, user_id),
    CONSTRAINT ck_waitlist_status CHECK (status IN ('waiting', 'notified', 'expired', 'converted'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_game_id ON public.game_waitlist(game_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user_id ON public.game_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.game_waitlist(status);

-- ====================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_waitlist ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid conflicts on re-run
DO $$
BEGIN
    -- Turfs
    DROP POLICY IF EXISTS "Allow public read access on turfs" ON public.turfs;
    CREATE POLICY "Allow public read access on turfs" ON public.turfs FOR SELECT USING (true);

    -- Offers
    DROP POLICY IF EXISTS "Allow public read access on offers" ON public.offers;
    CREATE POLICY "Allow public read access on offers" ON public.offers FOR SELECT USING (true);

    -- Banners
    DROP POLICY IF EXISTS "Allow public read access on banners" ON public.banners;
    CREATE POLICY "Allow public read access on banners" ON public.banners FOR SELECT USING (true);

    -- Tournaments
    DROP POLICY IF EXISTS "Allow public read access on tournaments" ON public.tournaments;
    CREATE POLICY "Allow public read access on tournaments" ON public.tournaments FOR SELECT USING (true);

    -- Reviews
    DROP POLICY IF EXISTS "Allow public read access on reviews" ON public.reviews;
    CREATE POLICY "Allow public read access on reviews" ON public.reviews FOR SELECT USING (true);

    -- Favorites
    DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
    CREATE POLICY "Users manage own favorites" ON public.favorites
        FOR ALL USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id);

    -- Profiles
    DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
    CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

    -- Bookings: users see their own bookings
    DROP POLICY IF EXISTS "Users manage own bookings" ON public.bookings;
    CREATE POLICY "Users manage own bookings" ON public.bookings
        FOR ALL USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id);

    -- Games: public can read; host can manage; players can read their games
    DROP POLICY IF EXISTS "Public read games" ON public.games;
    DROP POLICY IF EXISTS "Host can manage games" ON public.games;
    CREATE POLICY "Public read games" ON public.games FOR SELECT USING (true);
    CREATE POLICY "Host can manage games" ON public.games
        FOR ALL USING (auth.uid() = host_id)
        WITH CHECK (auth.uid() = host_id);

    -- GamePlayers: players can read their own; host can manage
    DROP POLICY IF EXISTS "Players manage own records" ON public.game_players;
    DROP POLICY IF EXISTS "Host can manage game players" ON public.game_players;
    CREATE POLICY "Players manage own records" ON public.game_players
        FOR ALL USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Host can manage game players" ON public.game_players
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.games
                WHERE games.id = game_players.game_id
                  AND games.host_id = auth.uid()
            )
        );

    -- GameWaitlist: users manage their own entries; host can read
    DROP POLICY IF EXISTS "Users manage own waitlist" ON public.game_waitlist;
    DROP POLICY IF EXISTS "Host can read waitlist" ON public.game_waitlist;
    CREATE POLICY "Users manage own waitlist" ON public.game_waitlist
        FOR ALL USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Host can read waitlist" ON public.game_waitlist
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.games
                WHERE games.id = game_waitlist.game_id
                  AND games.host_id = auth.uid()
            )
        );
END
$$;

-- Service role bypass policies (for admin dashboard / edge functions)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on turfs" ON public.turfs;
    DROP POLICY IF EXISTS "Service role full access on offers" ON public.offers;
    DROP POLICY IF EXISTS "Service role full access on banners" ON public.banners;
    DROP POLICY IF EXISTS "Service role full access on tournaments" ON public.tournaments;
    DROP POLICY IF EXISTS "Service role full access on reviews" ON public.reviews;
    DROP POLICY IF EXISTS "Service role full access on favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Service role full access on bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Service role full access on games" ON public.games;
    DROP POLICY IF EXISTS "Service role full access on game_players" ON public.game_players;
    DROP POLICY IF EXISTS "Service role full access on game_waitlist" ON public.game_waitlist;

    CREATE POLICY "Service role full access on turfs" ON public.turfs FOR ALL USING (true);
    CREATE POLICY "Service role full access on offers" ON public.offers FOR ALL USING (true);
    CREATE POLICY "Service role full access on banners" ON public.banners FOR ALL USING (true);
    CREATE POLICY "Service role full access on tournaments" ON public.tournaments FOR ALL USING (true);
    CREATE POLICY "Service role full access on reviews" ON public.reviews FOR ALL USING (true);
    CREATE POLICY "Service role full access on favorites" ON public.favorites FOR ALL USING (true);
    CREATE POLICY "Service role full access on bookings" ON public.bookings FOR ALL USING (true);
    CREATE POLICY "Service role full access on games" ON public.games FOR ALL USING (true);
    CREATE POLICY "Service role full access on game_players" ON public.game_players FOR ALL USING (true);
    CREATE POLICY "Service role full access on game_waitlist" ON public.game_waitlist FOR ALL USING (true);
END
$$;

-- ====================================================================
-- 7. REALTIME SETUP
-- ====================================================================

ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
ALTER TABLE public.game_waitlist REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
    END IF;
END
$$;

-- Add tables to publication (safe re-run: ignore if already exists)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;
    EXCEPTION WHEN duplicate_table THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.games;
    EXCEPTION WHEN duplicate_table THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_players;
    EXCEPTION WHEN duplicate_table THEN
        NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.game_waitlist;
    EXCEPTION WHEN duplicate_table THEN
        NULL;
    END;
END
$$;

-- Realtime broadcast policies
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send broadcasts" ON realtime.messages;

CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
    topic LIKE 'turf:%' OR
    topic LIKE 'booking:%' OR
    topic LIKE 'game:%' OR
    topic LIKE 'user:%'
);

CREATE POLICY "Authenticated users can send broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ====================================================================
-- 8. CORE FUNCTIONS & TRIGGERS
-- ====================================================================

-- 8.1 Overlap check: prevent double bookings at the DB level
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    existing_count integer;
    new_start time;
    new_end time;
BEGIN
    -- Only check active bookings (not cancelled, not completed)
    IF NEW.status IN ('cancelled', 'completed') THEN
        RETURN NEW;
    END IF;

    new_start := NEW.start_time::time;
    new_end := NEW.end_time::time;

    SELECT COUNT(*) INTO existing_count
    FROM public.bookings
    WHERE turf_id = NEW.turf_id
      AND date = NEW.date
      AND status NOT IN ('cancelled', 'completed')
      AND id IS DISTINCT FROM NEW.id
      AND (
        new_start < end_time::time AND
        new_end > start_time::time
      );

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'One or more slots in this time range are already booked.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_booking_overlap ON public.bookings;
CREATE TRIGGER trg_check_booking_overlap
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_booking_overlap();

-- 8.2 Auto-sync game joined_players from game_players table
CREATE OR REPLACE FUNCTION public.sync_game_player_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_joined integer;
    v_waiting integer;
    v_game_status text;
    v_max integer;
BEGIN
    -- Recalculate joined_players for the affected game
    SELECT COUNT(*) INTO v_joined
    FROM public.game_players
    WHERE game_id = COALESCE(NEW.game_id, OLD.game_id)
      AND status IN ('joined', 'checked_in', 'completed');

    SELECT COUNT(*) INTO v_waiting
    FROM public.game_waitlist
    WHERE game_id = COALESCE(NEW.game_id, OLD.game_id)
      AND status IN ('waiting', 'notified');

    SELECT max_players, status INTO v_max, v_game_status
    FROM public.games
    WHERE id = COALESCE(NEW.game_id, OLD.game_id);

    -- Update game counts
    UPDATE public.games
    SET joined_players = v_joined,
        waiting_players = v_waiting,
        status = CASE
            WHEN v_game_status IN ('cancelled', 'completed', 'started') THEN v_game_status
            WHEN v_joined >= v_max THEN 'full'
            ELSE 'open'
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = COALESCE(NEW.game_id, OLD.game_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_game_counts ON public.game_players;
CREATE TRIGGER trg_sync_game_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.game_players
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_game_player_counts();

-- Also trigger on waitlist changes
DROP TRIGGER IF EXISTS trg_sync_waitlist_counts ON public.game_waitlist;
CREATE TRIGGER trg_sync_waitlist_counts
    AFTER INSERT OR UPDATE OR DELETE ON public.game_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_game_player_counts();

-- 8.3 Expire pending bookings after 15 minutes
CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.bookings
    SET status = 'cancelled',
        payment_status = 'failed'
    WHERE status = 'pending'
      AND payment_status = 'pending'
      AND created_at < timezone('utc'::text, now()) - interval '15 minutes';
END;
$$;

-- 8.4 Broadcast booking changes to Realtime
CREATE OR REPLACE FUNCTION public.broadcast_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'realtime'
AS $$
DECLARE
    payload jsonb;
    turf_channel text;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        turf_channel := 'turf:' || NEW.turf_id || ':slots';
        payload := jsonb_build_object(
            'id', NEW.id,
            'turf_id', NEW.turf_id,
            'date', NEW.date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'hours', NEW.hours,
            'total_amount', NEW.total_amount,
            'booking_type', NEW.booking_type,
            'status', NEW.status,
            'payment_status', NEW.payment_status,
            'turf_name', NEW.turf_name
        );
    ELSE
        turf_channel := 'turf:' || OLD.turf_id || ':slots';
        payload := jsonb_build_object(
            'id', OLD.id,
            'turf_id', OLD.turf_id,
            'status', 'deleted'
        );
    END IF;

    PERFORM realtime.broadcast_changes(TG_TABLE_NAME, turf_channel, lower(TG_OP), payload);

    -- Status change notification to booking channel
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM realtime.broadcast_changes(
            TG_TABLE_NAME,
            'booking:' || NEW.id || ':status',
            'booking_status_changed',
            jsonb_build_object(
                'id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'turf_id', NEW.turf_id,
                'turf_name', NEW.turf_name,
                'date', NEW.date,
                'start_time', NEW.start_time
            )
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_booking_change ON public.bookings;
CREATE TRIGGER on_booking_change
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_booking_change();

-- 8.5 Broadcast game changes to Realtime
CREATE OR REPLACE FUNCTION public.broadcast_game_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'realtime'
AS $$
DECLARE
    payload jsonb;
    game_channel text;
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        game_channel := 'game:' || NEW.id;
        payload := jsonb_build_object(
            'id', NEW.id,
            'booking_id', NEW.booking_id,
            'turf_id', NEW.turf_id,
            'sport', NEW.sport,
            'visibility', NEW.visibility,
            'title', NEW.title,
            'status', NEW.status,
            'joined_players', NEW.joined_players,
            'waiting_players', NEW.waiting_players,
            'max_players', NEW.max_players,
            'price_per_player', NEW.price_per_player,
            'game_code', NEW.game_code,
            'date', NEW.date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time
        );
    ELSE
        game_channel := 'game:' || OLD.id;
        payload := jsonb_build_object('id', OLD.id, 'status', 'deleted');
    END IF;

    PERFORM realtime.broadcast_changes(TG_TABLE_NAME, game_channel, lower(TG_OP), payload);

    -- Also broadcast to the turf channel so turf subscribers see game changes
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM realtime.broadcast_changes(
            TG_TABLE_NAME,
            'turf:' || NEW.turf_id || ':slots',
            'game_' || lower(TG_OP),
            payload
        );
    ELSE
        PERFORM realtime.broadcast_changes(
            TG_TABLE_NAME,
            'turf:' || OLD.turf_id || ':slots',
            'game_deleted',
            payload
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_game_change ON public.games;
CREATE TRIGGER on_game_change
    AFTER INSERT OR UPDATE OR DELETE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_game_change();

-- 8.6 Broadcast game player changes
CREATE OR REPLACE FUNCTION public.broadcast_game_player_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'realtime'
AS $$
DECLARE
    payload jsonb;
    game_id uuid;
    turf_id text;
BEGIN
    game_id := COALESCE(NEW.game_id, OLD.game_id);

    SELECT g.turf_id INTO turf_id
    FROM public.games g
    WHERE g.id = game_id;

    payload := jsonb_build_object(
        'player_id', COALESCE(NEW.id, OLD.id),
        'game_id', game_id,
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'status', COALESCE(NEW.status, OLD.status),
        'payment_status', COALESCE(NEW.payment_status, OLD.payment_status),
        'operation', lower(TG_OP)
    );

    PERFORM realtime.broadcast_changes(
        TG_TABLE_NAME,
        'game:' || game_id || ':players',
        lower(TG_OP) || '_player',
        payload
    );

    -- Also broadcast to turf channel
    IF turf_id IS NOT NULL THEN
        PERFORM realtime.broadcast_changes(
            TG_TABLE_NAME,
            'turf:' || turf_id || ':slots',
            'player_' || lower(TG_OP),
            payload
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_game_player_change ON public.game_players;
CREATE TRIGGER on_game_player_change
    AFTER INSERT OR UPDATE OR DELETE ON public.game_players
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_game_player_change();

-- ====================================================================
-- 9. HELPER RPC FUNCTIONS (called from Edge / Client)
-- ====================================================================

-- 9.1 Host a public game (atomic: booking + game + host player)
CREATE OR REPLACE FUNCTION public.host_public_game(
    p_turf_id text,
    p_date text,
    p_start_time text,
    p_hours integer,
    p_sport text,
    p_title text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_skill_level text DEFAULT NULL,
    p_gender text DEFAULT NULL,
    p_age_limit integer DEFAULT NULL,
    p_max_players integer DEFAULT 10,
    p_price_per_player double precision DEFAULT 0,
    p_allow_waitlist boolean DEFAULT true,
    p_allow_invites boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id uuid := auth.uid();
    v_turf record;
    v_booking_id text;
    v_game_id uuid;
    v_end_time text;
    v_total_amount double precision;
    v_game_code text;
    v_existing integer;
BEGIN
    -- Auth check
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    -- Get turf
    SELECT * INTO v_turf FROM public.turfs WHERE id = p_turf_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Turf not found');
    END IF;

    v_end_time := to_char((p_date || ' ' || p_start_time)::timestamp + (p_hours || ' hours')::interval, 'HH24:MI');
    v_total_amount := v_turf.price_per_hour * p_hours;

    -- Overlap check
    SELECT COUNT(*) INTO v_existing
    FROM public.bookings
    WHERE turf_id = p_turf_id
      AND date = p_date
      AND status NOT IN ('cancelled', 'completed')
      AND start_time::time < v_end_time::time
      AND end_time::time > p_start_time::time;

    IF v_existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Slot already booked');
    END IF;

    -- Create booking
    INSERT INTO public.bookings (
        user_id, turf_id, turf_name, turf_image, date, start_time, end_time,
        hours, price_per_hour, total_amount, booking_type, status, payment_status
    ) VALUES (
        v_host_id::text, p_turf_id, v_turf.name, v_turf.image,
        p_date, p_start_time, v_end_time, p_hours,
        v_turf.price_per_hour, v_total_amount, 'open_game', 'confirmed', 'pending'
    )
    RETURNING id INTO v_booking_id;

    -- Create game
    INSERT INTO public.games (
        booking_id, host_id, turf_id, sport, visibility, title, description,
        skill_level, gender, age_limit, max_players, joined_players, waiting_players,
        price_per_player, status, allow_waitlist, allow_invites, start_time, end_time, date
    ) VALUES (
        v_booking_id, v_host_id, p_turf_id, p_sport, 'public', p_title, p_description,
        p_skill_level, p_gender, p_age_limit, p_max_players, 1, 0,
        p_price_per_player, 'open', p_allow_waitlist, p_allow_invites,
        p_start_time, v_end_time, p_date
    )
    RETURNING id INTO v_game_id;

    -- Add host as first player
    INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
    VALUES (v_game_id, v_host_id, 'joined', CASE WHEN p_price_per_player > 0 THEN 'pending' ELSE 'completed' END, now());

    RETURN jsonb_build_object('ok', true, 'game_id', v_game_id, 'booking_id', v_booking_id);
END;
$$;

-- 9.2 Host a private game (with game code)
CREATE OR REPLACE FUNCTION public.host_private_game(
    p_turf_id text,
    p_date text,
    p_start_time text,
    p_hours integer,
    p_sport text,
    p_title text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_skill_level text DEFAULT NULL,
    p_gender text DEFAULT NULL,
    p_age_limit integer DEFAULT NULL,
    p_max_players integer DEFAULT 10,
    p_price_per_player double precision DEFAULT 0,
    p_allow_waitlist boolean DEFAULT true,
    p_allow_invites boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id uuid := auth.uid();
    v_turf record;
    v_booking_id text;
    v_game_id uuid;
    v_end_time text;
    v_total_amount double precision;
    v_game_code text;
    v_existing integer;
BEGIN
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_turf FROM public.turfs WHERE id = p_turf_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Turf not found');
    END IF;

    v_end_time := to_char((p_date || ' ' || p_start_time)::timestamp + (p_hours || ' hours')::interval, 'HH24:MI');
    v_total_amount := v_turf.price_per_hour * p_hours;

    -- Generate unique 6-char game code
    FOR i IN 1..10 LOOP
        v_game_code := upper(substr(md5(random()::text), 1, 6));
        IF NOT EXISTS (SELECT 1 FROM public.games WHERE game_code = v_game_code) THEN
            EXIT;
        END IF;
    END LOOP;
    IF v_game_code IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Could not generate unique game code');
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM public.bookings
    WHERE turf_id = p_turf_id
      AND date = p_date
      AND status NOT IN ('cancelled', 'completed')
      AND start_time::time < v_end_time::time
      AND end_time::time > p_start_time::time;

    IF v_existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Slot already booked');
    END IF;

    INSERT INTO public.bookings (
        user_id, turf_id, turf_name, turf_image, date, start_time, end_time,
        hours, price_per_hour, total_amount, booking_type, status, payment_status
    ) VALUES (
        v_host_id::text, p_turf_id, v_turf.name, v_turf.image,
        p_date, p_start_time, v_end_time, p_hours,
        v_turf.price_per_hour, v_total_amount, 'open_game', 'confirmed', 'pending'
    )
    RETURNING id INTO v_booking_id;

    INSERT INTO public.games (
        booking_id, host_id, turf_id, sport, visibility, title, description,
        skill_level, gender, age_limit, max_players, joined_players, waiting_players,
        price_per_player, status, allow_waitlist, allow_invites, game_code,
        start_time, end_time, date
    ) VALUES (
        v_booking_id, v_host_id, p_turf_id, p_sport, 'private', p_title, p_description,
        p_skill_level, p_gender, p_age_limit, p_max_players, 1, 0,
        p_price_per_player, 'open', p_allow_waitlist, p_allow_invites, v_game_code,
        p_start_time, v_end_time, p_date
    )
    RETURNING id INTO v_game_id;

    INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
    VALUES (v_game_id, v_host_id, 'joined', CASE WHEN p_price_per_player > 0 THEN 'pending' ELSE 'completed' END, now());

    RETURN jsonb_build_object('ok', true, 'game_id', v_game_id, 'booking_id', v_booking_id, 'game_code', v_game_code);
END;
$$;

-- 9.3 Join a public game
CREATE OR REPLACE FUNCTION public.join_public_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_game record;
    v_player_id uuid;
    v_existing integer;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game not found');
    END IF;

    IF v_game.visibility != 'public' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'This is not a public game');
    END IF;
    IF v_game.status IN ('cancelled', 'completed', 'started') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game is not open');
    END IF;
    IF v_game.host_id = v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are the host');
    END IF;

    -- Check if already in game
    SELECT COUNT(*) INTO v_existing
    FROM public.game_players
    WHERE game_id = p_game_id AND user_id = v_user_id
      AND status IN ('pending', 'approved', 'payment_pending', 'joined', 'checked_in', 'completed');
    IF v_existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Already joined or requested');
    END IF;

    -- Check if full
    IF v_game.joined_players >= v_game.max_players THEN
        IF v_game.allow_waitlist THEN
            INSERT INTO public.game_waitlist (game_id, user_id, status)
            VALUES (p_game_id, v_user_id, 'waiting')
            ON CONFLICT (game_id, user_id) DO NOTHING;
            RETURN jsonb_build_object('ok', true, 'waitlist', true, 'message', 'Game full. Added to waitlist.');
        ELSE
            RETURN jsonb_build_object('ok', false, 'error', 'Game is full');
        END IF;
    END IF;

    INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
    VALUES (p_game_id, v_user_id, 'joined', CASE WHEN v_game.price_per_player > 0 THEN 'pending' ELSE 'completed' END, now())
    RETURNING id INTO v_player_id;

    RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'status', 'joined');
END;
$$;

-- 9.4 Request to join a private game
CREATE OR REPLACE FUNCTION public.request_join_private_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_game record;
    v_player_id uuid;
    v_existing integer;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game not found');
    END IF;

    IF v_game.visibility != 'private' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'This is not a private game');
    END IF;
    IF v_game.status IN ('cancelled', 'completed', 'started') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game is not open');
    END IF;
    IF v_game.host_id = v_user_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are the host');
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM public.game_players
    WHERE game_id = p_game_id AND user_id = v_user_id
      AND status IN ('pending', 'approved', 'payment_pending', 'joined', 'checked_in', 'completed');
    IF v_existing > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Already requested or joined');
    END IF;

    INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
    VALUES (p_game_id, v_user_id, 'pending', 'pending', now())
    RETURNING id INTO v_player_id;

    RETURN jsonb_build_object('ok', true, 'player_id', v_player_id, 'status', 'pending');
END;
$$;

-- 9.5 Approve a player request (host only)
CREATE OR REPLACE FUNCTION public.approve_player_request(p_game_id uuid, p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id uuid := auth.uid();
    v_game record;
    v_player record;
BEGIN
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game not found');
    END IF;
    IF v_game.host_id != v_host_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Only host can approve');
    END IF;

    SELECT * INTO v_player FROM public.game_players WHERE id = p_player_id AND game_id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Player not found');
    END IF;
    IF v_player.status != 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Player is not pending');
    END IF;

    IF v_game.joined_players >= v_game.max_players THEN
        IF v_game.allow_waitlist THEN
            UPDATE public.game_players SET status = 'rejected', left_at = now() WHERE id = p_player_id;
            INSERT INTO public.game_waitlist (game_id, user_id, status)
            VALUES (p_game_id, v_player.user_id, 'waiting')
            ON CONFLICT (game_id, user_id) DO NOTHING;
            RETURN jsonb_build_object('ok', true, 'waitlist', true, 'message', 'Game full. Player moved to waitlist.');
        ELSE
            RETURN jsonb_build_object('ok', false, 'error', 'Game is full');
        END IF;
    END IF;

    UPDATE public.game_players
    SET status = CASE WHEN v_game.price_per_player > 0 THEN 'approved' ELSE 'joined' END,
        payment_status = CASE WHEN v_game.price_per_player > 0 THEN 'pending' ELSE 'completed' END,
        approved_at = now()
    WHERE id = p_player_id;

    RETURN jsonb_build_object('ok', true, 'player_id', p_player_id, 'status', CASE WHEN v_game.price_per_player > 0 THEN 'approved' ELSE 'joined' END);
END;
$$;

-- 9.6 Reject a player request (host only)
CREATE OR REPLACE FUNCTION public.reject_player_request(p_game_id uuid, p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id uuid := auth.uid();
    v_game record;
    v_player record;
BEGIN
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND OR v_game.host_id != v_host_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
    END IF;

    SELECT * INTO v_player FROM public.game_players WHERE id = p_player_id AND game_id = p_game_id;
    IF NOT FOUND OR v_player.status != 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Player not pending');
    END IF;

    UPDATE public.game_players SET status = 'rejected', left_at = now() WHERE id = p_player_id;
    RETURN jsonb_build_object('ok', true, 'player_id', p_player_id, 'status', 'rejected');
END;
$$;

-- 9.7 Leave game
CREATE OR REPLACE FUNCTION public.leave_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_game record;
    v_player record;
    v_next_wait record;
    v_new_player_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game not found');
    END IF;
    IF v_game.status IN ('cancelled', 'completed', 'started') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game is already over or in progress');
    END IF;

    SELECT * INTO v_player
    FROM public.game_players
    WHERE game_id = p_game_id AND user_id = v_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this game');
    END IF;
    IF v_player.status IN ('rejected', 'cancelled', 'removed') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Already left');
    END IF;

    UPDATE public.game_players
    SET status = 'cancelled', left_at = now()
    WHERE id = v_player.id;

    -- Promote next waitlisted player if applicable
    IF v_player.status IN ('joined', 'checked_in') THEN
        SELECT * INTO v_next_wait
        FROM public.game_waitlist
        WHERE game_id = p_game_id AND status = 'waiting'
        ORDER BY requested_at ASC
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO public.game_players (game_id, user_id, status, payment_status, joined_at)
            VALUES (p_game_id, v_next_wait.user_id,
                    'joined',
                    CASE WHEN v_game.price_per_player > 0 THEN 'pending' ELSE 'completed' END,
                    now())
            RETURNING id INTO v_new_player_id;

            UPDATE public.game_waitlist
            SET status = 'converted', converted_at = now()
            WHERE id = v_next_wait.id;

            RETURN jsonb_build_object('ok', true, 'message', 'Left game. Waitlist player promoted.', 'promoted_player_id', v_new_player_id);
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'message', 'Left game');
END;
$$;

-- 9.8 Cancel game (host only)
CREATE OR REPLACE FUNCTION public.cancel_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_host_id uuid := auth.uid();
    v_game record;
    v_booking_id text;
BEGIN
    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Authentication required');
    END IF;

    SELECT * INTO v_game FROM public.games WHERE id = p_game_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Game not found');
    END IF;
    IF v_game.host_id != v_host_id THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Only host can cancel');
    END IF;

    v_booking_id := v_game.booking_id;

    -- Cancel all players
    UPDATE public.game_players
    SET status = 'cancelled', left_at = now()
    WHERE game_id = p_game_id
      AND status NOT IN ('cancelled', 'rejected', 'removed');

    -- Cancel booking
    UPDATE public.bookings SET status = 'cancelled' WHERE id = v_booking_id;

    -- Cancel game (status is handled by trigger or manual update)
    UPDATE public.games SET status = 'cancelled', updated_at = now() WHERE id = p_game_id;

    RETURN jsonb_build_object('ok', true, 'message', 'Game cancelled');
END;
$$;

-- ====================================================================
-- 10. SEED DATA (optional: keep existing seed data)
-- ====================================================================

-- Seed data for turfs, offers, banners, tournaments is preserved
-- from the original supabase_schema.sql. Re-run that section if needed.
-- NOTE: old open_games / open_game_players tables are already dropped in Section 0 above.
