-- ============================================================================
-- PlayTurf — Admin RBAC & Control Center migration (run in Supabase Dashboard)
-- Generated 2026-10-31 by the Super Admin Control Center implementation.
--
-- ⚠️  REVIEW BEFORE RUNNING. Run supabase_security_fixes.sql FIRST — this
--  file assumes the corrected base policies from that file. Every statement
--  here is idempotent. Nothing destructive: no columns are dropped, no data
--  is deleted.
--
-- Sections:
--   A. Admin role-guard (blocks self-elevation of profiles.role / is_admin)
--   B. profiles.is_suspended / suspension_reason + policies
--   C. Venue lifecycle: turfs.status + turfs.ownership + extended admin roles
--   D. admin_audit_log (append-only privileged-action record)
--   E. site_settings (platform configuration)
--   F. seo_pages (landing-page SEO overrides)
--   G. admin_cancel_game RPC (server-validated game moderation)
--   H. Super-admin read grants for security telemetry tables
--   I. AAL2 (MFA) enforcement template
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 0 — Preflight: who is currently an administrator?
-- ---------------------------------------------------------------------------
SELECT id, full_name, role, is_admin FROM public.profiles
WHERE role IN ('admin','super_admin','finance_admin','content_admin','support_admin') OR is_admin = true;

-- ---------------------------------------------------------------------------
-- SECTION A — Role guard: only super admins (or the SQL editor) change roles
-- Idempotent re-application of the fix from supabase_security_fixes.sql.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR COALESCE(NEW.is_admin, false) IS DISTINCT FROM COALESCE(OLD.is_admin, false) THEN
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'
      ) THEN
        RAISE EXCEPTION 'Only super administrators can change role or admin flags';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ---------------------------------------------------------------------------
-- SECTION B — Account suspension
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Admins (full role list) may suspend/reactivate; users can never touch the
-- flag themselves (the base "update own profile" policy is column-blind, so
-- this trigger blocks non-admin writes to is_suspended explicitly).
CREATE OR REPLACE FUNCTION public.prevent_self_suspension_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason THEN
    IF auth.uid() IS NULL OR auth.uid() = NEW.id THEN
      -- allow only when the caller is another admin
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('super_admin','admin','finance_admin','content_admin','support_admin')
      ) THEN
        RAISE EXCEPTION 'Only administrators can change suspension status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_suspension_guard ON public.profiles;
CREATE TRIGGER profiles_suspension_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_suspension_change();

-- ---------------------------------------------------------------------------
-- SECTION C — Venue lifecycle & ownership + extended admin roles
-- ---------------------------------------------------------------------------

ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE public.turfs ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'partner';

-- Existing rows: keep everything live unless told otherwise
UPDATE public.turfs SET status = 'published' WHERE status IS NULL OR status = '';
UPDATE public.turfs SET ownership = 'partner' WHERE ownership IS NULL OR ownership = '';

-- Extended admin predicate used across admin-managed tables.
-- Replaces the (is_admin OR role IN ('admin','super_admin')) predicate from
-- supabase_security_fixes.sql with the full Control Center role list.
CREATE OR REPLACE FUNCTION public.is_playturf_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid
      AND (p.is_admin = true OR p.role IN ('admin','super_admin','finance_admin','content_admin','support_admin'))
  );
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['turfs','offers','banners','tournaments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %I" ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY "Admins can manage %I"
        ON public.%I FOR ALL
        USING (public.is_playturf_admin(auth.uid()))
        WITH CHECK (public.is_playturf_admin(auth.uid()))
    $f$, t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- SECTION D — admin_audit_log (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log (actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can append audit entries" ON public.admin_audit_log;
CREATE POLICY "Admins can append audit entries"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_playturf_admin(auth.uid()));

-- Only super admins read the log; NOBODY updates or deletes (no policy =
-- denied under RLS). History is immutable by construction.
DROP POLICY IF EXISTS "Super admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Super admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- SECTION E — site_settings (platform configuration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public read (the customer app may read public flags like maintenance_mode
-- once wired); admin-only writes.
DROP POLICY IF EXISTS "Public can read site settings" ON public.site_settings;
CREATE POLICY "Public can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.is_playturf_admin(auth.uid()))
  WITH CHECK (public.is_playturf_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- SECTION F — seo_pages (landing-page SEO overrides)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seo_pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_type text NOT NULL,           -- location | sport | location_sport
  slug text NOT NULL,                -- e.g. bangalore | football | football-bangalore
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  h1 text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  robots text NOT NULL DEFAULT 'index',  -- index | noindex
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (page_type, slug)
);

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;

-- Public read: the customer SEO system consumes these overrides.
DROP POLICY IF EXISTS "Public can read enabled seo pages" ON public.seo_pages;
CREATE POLICY "Public can read enabled seo pages"
  ON public.seo_pages FOR SELECT
  USING (enabled = true);

DROP POLICY IF EXISTS "Admins can manage seo pages" ON public.seo_pages;
CREATE POLICY "Admins can manage seo pages"
  ON public.seo_pages FOR ALL
  TO authenticated
  USING (public.is_playturf_admin(auth.uid()))
  WITH CHECK (public.is_playturf_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- SECTION G — admin_cancel_game RPC (server-validated moderation)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_cancel_game(p_game_id text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_playturf_admin(v_actor) THEN
    RAISE EXCEPTION 'Only PlayTurf administrators can moderate games';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A moderation reason is required';
  END IF;

  UPDATE public.games
  SET status = 'cancelled'
  WHERE id = p_game_id AND status IN ('open','full');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'game_not_found_or_not_active');
  END IF;

  -- Release the venue slots held by this game's bookings (case-insensitive,
  -- matching the platform's lowercase status convention).
  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE open_game_id = p_game_id
    AND lower(status) NOT IN ('cancelled');

  RETURN jsonb_build_object('ok', true, 'cancelled_by', v_actor, 'reason', p_reason);
END;
$$;

-- ---------------------------------------------------------------------------
-- SECTION H — Super-admin read access to security telemetry
-- (rate_limits / admin_logs remain closed to ordinary users — see
--  supabase_security_fixes.sql Section 3.)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Super admins can read rate limits" ON public.rate_limits;
CREATE POLICY "Super admins can read rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admins can read admin logs" ON public.admin_logs;
CREATE POLICY "Super admins can read admin logs"
  ON public.admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- SECTION I — AAL2 (MFA) enforcement TEMPLATE (optional, enable deliberately)
-- Once admins enroll authenticators, uncomment to make privileged tables
-- require a second factor at the DATABASE level:
--
-- Example for admin_audit_log:
--   DROP POLICY IF EXISTS "Admins can append audit entries" ON public.admin_audit_log;
--   CREATE POLICY "Admins can append audit entries"
--     ON public.admin_audit_log FOR INSERT
--     TO authenticated
--     WITH CHECK (
--       public.is_playturf_admin(auth.uid())
--       AND (auth.jwt()->>'aal') = 'aal2'
--     );
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- POST-RUN VERIFICATION
-- ---------------------------------------------------------------------------
-- 1. Role guard active:
--      SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
-- 2. New columns present:
--      SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('is_suspended','suspension_reason');
-- 3. Tables created:
--      SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('admin_audit_log','site_settings','seo_pages');
-- 4. RPC callable (as an admin):
--      SELECT public.admin_cancel_game('nonexistent-id', 'test');  -- expect ok:false / game_not_found
-- ============================================================================
