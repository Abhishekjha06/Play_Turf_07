-- ====================================================================
-- PLAY_TURF SUPABASE DATABASE SETUP (FULL SCHEMA)
-- Paste this script into the Supabase SQL Editor (https://supabase.com)
-- to create all tables, set up RLS policies, and seed mock data.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Create Tables
-- --------------------------------------------------------------------

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    phone varchar(10) not null,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    constraint phone_length check (phone ~ '^[0-9]{10}$')
);

-- Table: turfs
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

-- Table: offers
CREATE TABLE IF NOT EXISTS public.offers (
    id text PRIMARY KEY,
    title text NOT NULL,
    subtitle text NOT NULL,
    badge text NOT NULL,
    image text NOT NULL,
    discount text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: banners
CREATE TABLE IF NOT EXISTS public.banners (
    id text PRIMARY KEY,
    title text NOT NULL,
    highlight text NOT NULL,
    subtitle text NOT NULL,
    image text NOT NULL,
    badge text NOT NULL,
    cta_text text NOT NULL,
    cta_link text NOT NULL,
    "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
    id text PRIMARY KEY,
    name text NOT NULL,
    sport text NOT NULL,
    location text NOT NULL,
    image text NOT NULL,
    date text NOT NULL,
    prize_pool text NOT NULL,
    teams integer NOT NULL,
    entry_fee double precision NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id text PRIMARY KEY,
    turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    user_name text NOT NULL,
    rating double precision NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_turf UNIQUE (user_id, turf_id)
);

-- Table: bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    turf_id text NOT NULL REFERENCES public.turfs(id) ON DELETE CASCADE,
    turf_name text NOT NULL,
    turf_image text NOT NULL,
    date text NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    hours double precision NOT NULL,
    amount double precision NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    payment_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --------------------------------------------------------------------
-- 2. Configure Row Level Security (RLS)
-- --------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they already exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access on turfs" ON public.turfs;
DROP POLICY IF EXISTS "Allow public read access on offers" ON public.offers;
DROP POLICY IF EXISTS "Allow public read access on banners" ON public.banners;
DROP POLICY IF EXISTS "Allow public read access on tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Allow public read access on reviews" ON public.reviews;

DROP POLICY IF EXISTS "Allow users to add reviews" ON public.reviews;

DROP POLICY IF EXISTS "Allow users to select their own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Allow users to manage their own favorites" ON public.favorites;

DROP POLICY IF EXISTS "Allow users to select their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow users to manage their own bookings" ON public.bookings;

DROP POLICY IF EXISTS "Allow service_role full access on turfs" ON public.turfs;
DROP POLICY IF EXISTS "Allow service_role full access on offers" ON public.offers;
DROP POLICY IF EXISTS "Allow service_role full access on banners" ON public.banners;
DROP POLICY IF EXISTS "Allow service_role full access on tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Allow service_role full access on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow service_role full access on favorites" ON public.favorites;
DROP POLICY IF EXISTS "Allow service_role full access on bookings" ON public.bookings;

-- 2.1 Public Read Access Policies (Anyone can view)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow public read access on turfs" ON public.turfs FOR SELECT USING (true);
CREATE POLICY "Allow public read access on offers" ON public.offers FOR SELECT USING (true);
CREATE POLICY "Allow public read access on banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Allow public read access on tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Allow public read access on reviews" ON public.reviews FOR SELECT USING (true);

-- 2.2 Public Write Access for Reviews (Users can submit reviews)
CREATE POLICY "Allow users to add reviews" ON public.reviews
    FOR INSERT WITH CHECK (true);

-- 2.3 Authenticated User Specific Policies (Users manage their own items)
-- Favorites
CREATE POLICY "Allow users to select their own favorites" ON public.favorites
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'mock_user');
CREATE POLICY "Allow users to manage their own favorites" ON public.favorites
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'mock_user')
    WITH CHECK (auth.uid()::text = user_id OR user_id = 'mock_user');

-- Bookings
CREATE POLICY "Allow users to select their own bookings" ON public.bookings
    FOR SELECT USING (auth.uid()::text = user_id OR user_id = 'mock_user');
CREATE POLICY "Allow users to manage their own bookings" ON public.bookings
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'mock_user')
    WITH CHECK (auth.uid()::text = user_id OR user_id = 'mock_user');

-- 2.4 Service Role / Dashboard Admin Full Access
CREATE POLICY "Allow service_role full access on turfs" ON public.turfs FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on offers" ON public.offers FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on banners" ON public.banners FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on tournaments" ON public.tournaments FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on reviews" ON public.reviews FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on favorites" ON public.favorites FOR ALL USING (true);
CREATE POLICY "Allow service_role full access on bookings" ON public.bookings FOR ALL USING (true);

-- --------------------------------------------------------------------
-- 4. Configure Supabase Realtime & Broadcast
-- --------------------------------------------------------------------

-- 4.1 Enable Realtime replication for the bookings table
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- Ensure the default supabase_realtime publication exists and includes bookings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
  END IF;
END
$$;

-- Add bookings to the realtime publication (safe to run even if already added)
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bookings;

-- 4.2 Realtime Authorization (RLS on realtime.messages for private channels)
-- These policies control who can receive/send on Realtime broadcast channels.
-- Channel topics used in this app:
--   turf:<turf_id>:slots   — live slot availability
--   booking:<booking_id>:status — booking status changes
--   user:<user_id>:notifications — general user notifications

DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send broadcasts" ON realtime.messages;

-- Allow authenticated users to RECEIVE broadcasts on relevant channel topics
CREATE POLICY "Authenticated users can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic LIKE 'turf:%' OR
  topic LIKE 'booking:%' OR
  topic LIKE 'user:%'
);

-- Allow authenticated users to SEND broadcasts on any channel
-- (In production, tighten this to match your app's authorization rules)
CREATE POLICY "Authenticated users can send broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4.3 Database trigger: broadcast booking changes to Realtime channels
-- This function fires on INSERT / UPDATE / DELETE of bookings rows and
-- calls realtime.broadcast_changes() to push events to the appropriate
-- Realtime broadcast channels.
CREATE OR REPLACE FUNCTION public.broadcast_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload jsonb;
  turf_channel text;
  event_name text;
BEGIN
  -- Determine channel and payload based on operation type
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    turf_channel := 'turf:' || NEW.turf_id || ':slots';
    payload := json_build_object(
      'id', NEW.id,
      'turf_id', NEW.turf_id,
      'date', NEW.date,
      'start_time', NEW.start_time,
      'hours', NEW.hours,
      'amount', NEW.amount,
      'status', NEW.status,
      'turf_name', NEW.turf_name
    )::jsonb;
  ELSE
    -- DELETE operation
    turf_channel := 'turf:' || OLD.turf_id || ':slots';
    payload := json_build_object(
      'id', OLD.id,
      'turf_id', OLD.turf_id,
      'date', OLD.date,
      'start_time', OLD.start_time,
      'status', 'DELETED'
    )::jsonb;
  END IF;

  -- Broadcast to the turf slot availability channel
  PERFORM realtime.broadcast_changes(
    TG_TABLE_NAME,
    turf_channel,
    lower(TG_OP),
    payload
  );

  -- For status changes, also broadcast to the booking-specific channel
  -- so the user who made the booking gets a real-time notification
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM realtime.broadcast_changes(
      TG_TABLE_NAME,
      'booking:' || NEW.id || ':status',
      'booking_status_changed',
      json_build_object(
        'id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'turf_id', NEW.turf_id,
        'turf_name', NEW.turf_name,
        'date', NEW.date,
        'start_time', NEW.start_time
      )::jsonb
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger (if re-running the script)
DROP TRIGGER IF EXISTS on_booking_change ON public.bookings;

-- Create the trigger on bookings
CREATE TRIGGER on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_booking_change();

-- --------------------------------------------------------------------
-- 5. Populate Seed Data
-- --------------------------------------------------------------------

-- Clear any existing data
TRUNCATE TABLE public.bookings CASCADE;
TRUNCATE TABLE public.favorites CASCADE;
TRUNCATE TABLE public.reviews CASCADE;
TRUNCATE TABLE public.tournaments CASCADE;
TRUNCATE TABLE public.banners CASCADE;
TRUNCATE TABLE public.offers CASCADE;
TRUNCATE TABLE public.turfs CASCADE;

-- Insert Banners
INSERT INTO public.banners (id, title, highlight, subtitle, image, badge, cta_text, cta_link, "order") VALUES
(
    'ban_1', 
    'Play Anytime', 
    'Anytime', 
    'Book premium turfs in under a minute.', 
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1200', 
    'FEATURED', 
    'Book Now', 
    '/turf/turf_1', 
    1
),
(
    'ban_2', 
    'Floodlit Nights', 
    'Nights', 
    'Stadium lights. Rooftop turfs. Pure vibe.', 
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1200', 
    'NIGHT MODE', 
    'Explore', 
    '/turf/turf_3', 
    2
),
(
    'ban_3', 
    'Tournaments are LIVE', 
    'LIVE', 
    'Compete with squads. Win prize pools.', 
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200', 
    'TOURNAMENT', 
    'Join', 
    '/tournaments', 
    3
);

-- Insert Turfs
INSERT INTO public.turfs (
    id, name, city, address, lat, lng, image, gallery, rating, timing, price_per_hour, sport_types, amenities, description, is_popular, is_nearby
) VALUES 
(
    'turf_1', 
    'Greenfield Arena', 
    'Bangalore', 
    'Indiranagar, Bangalore', 
    12.9784, 
    77.6408, 
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=800'], 
    4.8, 
    '06:00 AM – 11:00 PM', 
    1200, 
    ARRAY['Football', 'Futsal'], 
    ARRAY['Floodlights', 'Parking', 'Washroom', 'Drinking water'], 
    'Premium 5-a-side floodlit turf in the heart of Indiranagar.', 
    true, 
    true
),
(
    'turf_2', 
    'Skyline Rooftop Turf', 
    'Mumbai', 
    'Lower Parel, Mumbai', 
    18.9936, 
    72.8258, 
    'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800'], 
    4.7, 
    '06:00 AM – 12:00 AM', 
    1500, 
    ARRAY['Football'], 
    ARRAY['Floodlights', 'Cafe', 'Locker', 'Parking'], 
    'Rooftop turf with skyline views and cafe lounge.', 
    true, 
    false
),
(
    'turf_3', 
    'BoxCric Cage', 
    'Hyderabad', 
    'Gachibowli, Hyderabad', 
    17.4401, 
    78.3489, 
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=800'], 
    4.6, 
    '06:00 AM – 11:00 PM', 
    900, 
    ARRAY['Cricket'], 
    ARRAY['Nets', 'Floodlights', 'Washroom'], 
    'Box cricket arena with pro-grade matting and nets.', 
    true, 
    true
),
(
    'turf_4', 
    'Futsal Hub', 
    'Delhi', 
    'Saket, New Delhi', 
    28.5245, 
    77.2066, 
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=80&w=800'], 
    4.5, 
    '07:00 AM – 11:00 PM', 
    1100, 
    ARRAY['Futsal', 'Football'], 
    ARRAY['AC', 'Locker', 'Cafe'], 
    'Indoor futsal arena, AC, FIFA-grade flooring.', 
    true, 
    false
),
(
    'turf_5', 
    'Hilltop Grounds', 
    'Bangalore', 
    'Whitefield, Bangalore', 
    12.9698, 
    77.75, 
    'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=800'], 
    4.9, 
    '05:30 AM – 10:00 PM', 
    1800, 
    ARRAY['Football'], 
    ARRAY['7-a-side', 'Parking', 'Washroom'], 
    'Scenic 7-a-side ground with mountain backdrop.', 
    false, 
    true
),
(
    'turf_6', 
    'Arena 360', 
    'Mumbai', 
    'Andheri West, Mumbai', 
    19.1364, 
    72.8296, 
    'https://images.unsplash.com/photo-1505666287802-931dc83948e9?auto=format&fit=crop&q=80&w=1200', 
    ARRAY['https://images.unsplash.com/photo-1505666287802-931dc83948e9?auto=format&fit=crop&q=80&w=800', 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800'], 
    4.7, 
    '06:00 AM – 12:00 AM', 
    1400, 
    ARRAY['Football', 'Basketball'], 
    ARRAY['AC', 'LED', 'Locker'], 
    'Hybrid indoor arena for football and basketball.', 
    false, 
    true
);

-- Insert Offers
INSERT INTO public.offers (
    id, title, subtitle, badge, image, discount, is_active
) VALUES 
(
    'off_1', 
    'Weekend Smash', 
    '20% off on Sat & Sun bookings', 
    '20% OFF', 
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=600', 
    '20%', 
    true
),
(
    'off_2', 
    'Happy Hours', 
    '50% off slots before 8AM', 
    '50% OFF', 
    'https://images.unsplash.com/photo-1510566339476-60400d51ee97?auto=format&fit=crop&q=80&w=600', 
    '50%', 
    true
),
(
    'off_3', 
    'Squad Up', 
    'Book 5, get 1 hour free', 
    'BOOK 5 GET 1', 
    'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&q=80&w=600', 
    '1 free', 
    true
);

-- Insert Tournaments
INSERT INTO public.tournaments (id, name, sport, location, image, date, prize_pool, teams, entry_fee, description) VALUES
(
    'tnt_1', 
    'City Champions Cup', 
    'Football', 
    'Bangalore', 
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200', 
    '2026-05-24', 
    '₹50,000', 
    16, 
    2500, 
    '16-team knockout. Glory and prize pool await.'
),
(
    'tnt_2', 
    'Box Cricket Showdown', 
    'Cricket', 
    'Hyderabad', 
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=1200', 
    '2026-06-08', 
    '₹30,000', 
    12, 
    1500, 
    'Floodlit box cricket. T6 format. Fast & furious.'
),
(
    'tnt_3', 
    'Weekend League', 
    'Futsal', 
    'Mumbai', 
    'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1200', 
    '2026-05-30', 
    '₹20,000', 
    8, 
    1200, 
    'Round-robin futsal league across two Sundays.'
);
