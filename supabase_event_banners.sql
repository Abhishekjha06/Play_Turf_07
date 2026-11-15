-- ============================================================================
-- Event banners: dedicated table + storage for the home-header Events Banner
-- area. Run in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
--
-- Run order: AFTER supabase_admin_rbac.sql (the admin policies check
-- profiles.is_admin). Independent of supabase_banner_admin.sql.
--
-- 1. Creates the public `event-banners` storage bucket (PNG only, 10 MB).
-- 2. Storage policies: anyone can view banner images; only admins can
--    upload/replace/remove them (same pattern as supabase_banner_admin.sql).
-- 3. Creates the `event_banners` table: image URL, optional title, status
--    (active/inactive) and display order. RLS: public reads ACTIVE banners
--    only; admins read everything and manage rows.
--
-- Frontend contract (no code change needed to publish a banner):
--   GET active rows ordered by display_order  →  home Events Banner area
--   Admin uploads PNG → event-banners bucket → row in event_banners
-- ============================================================================

-- 1. Public storage bucket for event banner PNGs (10 MB, png)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-banners', 'event-banners', true, 10485760, ARRAY['image/png'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies for the `event-banners` bucket
DROP POLICY IF EXISTS "Public read event banner images" ON storage.objects;
CREATE POLICY "Public read event banner images" ON storage.objects
    FOR SELECT USING (bucket_id = 'event-banners');

DROP POLICY IF EXISTS "Admins can upload event banner images" ON storage.objects;
CREATE POLICY "Admins can upload event banner images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'event-banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can update event banner images" ON storage.objects;
CREATE POLICY "Admins can update event banner images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'event-banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can delete event banner images" ON storage.objects;
CREATE POLICY "Admins can delete event banner images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'event-banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- 3. Event banners table
CREATE TABLE IF NOT EXISTS public.event_banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    image_url text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.event_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active event banners" ON public.event_banners;
CREATE POLICY "Public read active event banners" ON public.event_banners
    FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Admins can read all event banners" ON public.event_banners;
CREATE POLICY "Admins can read all event banners" ON public.event_banners
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can manage event banners" ON public.event_banners;
CREATE POLICY "Admins can manage event banners" ON public.event_banners
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
