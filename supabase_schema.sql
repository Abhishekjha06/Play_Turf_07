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
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    constraint phone_length check (phone ~ '^[0-9]{10}$')
);

-- Ensure is_admin column exists if table was already created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false NOT NULL;

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

-- Prevent double bookings (race conditions) by enforcing uniqueness
-- on turf_id, date, and start_time, but ignore cancelled bookings.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking 
ON public.bookings (turf_id, date, start_time) 
WHERE status != 'CANCELLED';

-- Function to handle expired reservations (e.g. pending for > 15 mins)
CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.bookings
    SET status = 'CANCELLED'
    WHERE status = 'PENDING'
    AND created_at < timezone('utc'::text, now()) - interval '15 minutes';
END;
$$;

-- --------------------------------------------------------------------
-- 2. Indexes for Database Optimization
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_turf_id ON public.bookings(turf_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_reviews_turf_id ON public.reviews(turf_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);

-- --------------------------------------------------------------------
-- 3. Configure Row Level Security (RLS)
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

-- 2.2 Authenticated User Specific Policies (Users manage their own items)
-- Reviews
CREATE POLICY "Allow users to add reviews" ON public.reviews
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'mock_user');
CREATE POLICY "Allow users to update own reviews" ON public.reviews
    FOR UPDATE USING (auth.uid()::text = user_id OR user_id = 'mock_user');
CREATE POLICY "Allow users to delete own reviews" ON public.reviews
    FOR DELETE USING (auth.uid()::text = user_id OR user_id = 'mock_user');

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

-- Drop existing triggers (if re-running the script)
DROP TRIGGER IF EXISTS on_booking_change ON public.bookings;
DROP TRIGGER IF EXISTS trg_check_booking_overlap_and_expiry ON public.bookings;

-- Create the AFTER trigger on bookings (Realtime broadcasts)
CREATE TRIGGER on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_booking_change();

-- Create the BEFORE validation function
CREATE OR REPLACE FUNCTION public.check_booking_overlap_and_expiry()
RETURNS trigger AS $$
DECLARE
    existing_count integer;
    slot_timestamp timestamp;
    current_server_time timestamp;
BEGIN
    -- 1. Expiry Validation (using Asia/Kolkata timezone for Indian turf locations)
    IF NEW.date = to_char(timezone('Asia/Kolkata'::text, now()), 'YYYY-MM-DD') THEN
        slot_timestamp := (NEW.date || ' ' || NEW.start_time)::timestamp;
        current_server_time := timezone('Asia/Kolkata'::text, now())::timestamp;
        
        IF slot_timestamp <= current_server_time THEN
            RAISE EXCEPTION 'This slot has already expired and cannot be booked.';
        END IF;
    END IF;

    -- 2. Multi-hour Overlap Check
    SELECT COUNT(*) INTO existing_count
    FROM public.bookings
    WHERE turf_id = NEW.turf_id
      AND date = NEW.date
      AND status != 'CANCELLED'
      AND id != NEW.id
      AND (
        (NEW.start_time::time < end_time::time) AND 
        (NEW.end_time::time > start_time::time)
      );

    IF existing_count > 0 THEN
        RAISE EXCEPTION 'One or more slots in this time range are already booked.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the BEFORE trigger on bookings (Expiry and overlap checks)
CREATE TRIGGER trg_check_booking_overlap_and_expiry
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_booking_overlap_and_expiry();

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier text NOT NULL, -- email, phone, or IP
    action text NOT NULL, -- 'login', 'signup', 'otp', 'reset'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: admin_logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Feedbacks
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    name text,
    email text,
    category text NOT NULL,
    message text NOT NULL,
    screenshot_url text,
    priority text DEFAULT 'Low', -- Low, Medium, High, Critical
    status text DEFAULT 'Open', -- Open, In Progress, Resolved, Closed
    device_type text,
    browser text,
    os text,
    app_version text,
    screen_width integer,
    screen_height integer,
    page_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Feedback Activity
CREATE TABLE IF NOT EXISTS public.feedback_activity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id uuid REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    action text NOT NULL,
    old_status text,
    new_status text,
    performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Beta Users
CREATE TABLE IF NOT EXISTS public.beta_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text UNIQUE NOT NULL,
    status text DEFAULT 'Invited', -- Invited, Approved, Active, Rejected
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure storage bucket exists for feedback screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback_screenshots', 'feedback_screenshots', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS for feedback
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own feedbacks" ON public.feedbacks FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can view all feedbacks" ON public.feedbacks FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update feedbacks" ON public.feedbacks FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can view feedback activity" ON public.feedback_activity FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can insert feedback activity" ON public.feedback_activity FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

ALTER TABLE public.beta_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage beta_users" ON public.beta_users FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on rate_limits" ON public.rate_limits FOR ALL USING (true);
CREATE POLICY "Service role full access on admin_logs" ON public.admin_logs FOR ALL USING (true);
CREATE POLICY "Allow public insert on rate_limits" ON public.rate_limits FOR INSERT WITH CHECK (true);

-- --------------------------------------------------------------------
-- 6. Populate Seed Data
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
    'Round-robin futsal league across two Sundays.'
);

-- ====================================================================
-- OPEN GAMES & PARTICIPATION SCHEMA EXTENSION
-- ====================================================================

-- Table: open_games
CREATE TABLE IF NOT EXISTS public.open_games (
    id text PRIMARY KEY,
    sport text NOT NULL,
    venue text NOT NULL,
    date text NOT NULL,
    time text NOT NULL,
    price_per_slot double precision NOT NULL,
    total_amount double precision NOT NULL,
    slots_total integer NOT NULL,
    slots_filled integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'open',
    distance double precision NOT NULL,
    host_name text NOT NULL,
    host_avatar text,
    host_user_id text NOT NULL,
    cancellation_policy text,
    is_private boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: open_game_players
CREATE TABLE IF NOT EXISTS public.open_game_players (
    id text PRIMARY KEY,
    open_game_id text NOT NULL REFERENCES public.open_games(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    name text NOT NULL,
    avatar text,
    payment_status text NOT NULL DEFAULT 'unpaid',
    payment_method text,
    booking_id text REFERENCES public.bookings(id) ON DELETE SET NULL,
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_open_game UNIQUE (open_game_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_open_game_players_game ON public.open_game_players(open_game_id);
CREATE INDEX IF NOT EXISTS idx_open_game_players_user ON public.open_game_players(user_id);

-- Enable RLS
ALTER TABLE public.open_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_game_players ENABLE ROW LEVEL SECURITY;

-- Policies for open_games
DROP POLICY IF EXISTS "Allow public read access on open_games" ON public.open_games;
DROP POLICY IF EXISTS "Allow users to host open games" ON public.open_games;
DROP POLICY IF EXISTS "Allow service_role full access on open_games" ON public.open_games;

CREATE POLICY "Allow public read access on open_games" ON public.open_games FOR SELECT USING (true);
CREATE POLICY "Allow users to host open games" ON public.open_games FOR INSERT WITH CHECK (auth.uid()::text = host_user_id OR host_user_id = 'mock_user');
CREATE POLICY "Allow service_role full access on open_games" ON public.open_games FOR ALL USING (true);

-- Policies for open_game_players
DROP POLICY IF EXISTS "Allow public read access on open_game_players" ON public.open_game_players;
DROP POLICY IF EXISTS "Allow users to join open games" ON public.open_game_players;
DROP POLICY IF EXISTS "Allow service_role full access on open_game_players" ON public.open_game_players;

CREATE POLICY "Allow public read access on open_game_players" ON public.open_game_players FOR SELECT USING (true);
CREATE POLICY "Allow users to join open games" ON public.open_game_players FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id = 'mock_user');
CREATE POLICY "Allow service_role full access on open_game_players" ON public.open_game_players FOR ALL USING (true);

