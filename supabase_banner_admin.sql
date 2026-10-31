-- ============================================================================
-- Banner slides: image storage bucket + admin-only write access
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
--
-- 1. Creates the public `banners` storage bucket used by uploadBannerImage().
-- 2. Storage policies: anyone can view banner images, only admins can
--    upload/replace/remove them.
-- 3. Fixes the banners table RLS: the old "Allow service_role full access on
--    banners" policy used USING (true), which let ANYONE (even anon) insert,
--    update and delete banners. Writes are now restricted to admin profiles;
--    public read access is unchanged.
-- ============================================================================

-- 1. Public storage bucket for banner images (5 MB, png/jpeg/webp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('banners', 'banners', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies for the `banners` bucket
DROP POLICY IF EXISTS "Public read banner images" ON storage.objects;
CREATE POLICY "Public read banner images" ON storage.objects
    FOR SELECT USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Admins can upload banner images" ON storage.objects;
CREATE POLICY "Admins can upload banner images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can update banner images" ON storage.objects;
CREATE POLICY "Admins can update banner images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

DROP POLICY IF EXISTS "Admins can delete banner images" ON storage.objects;
CREATE POLICY "Admins can delete banner images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'banners'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- 3. Banners table: keep public read, restrict writes to admins
-- (public SELECT policy "Allow public read access on banners" already exists)
DROP POLICY IF EXISTS "Allow service_role full access on banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Admins can manage banners" ON public.banners
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
