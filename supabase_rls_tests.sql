-- ============================================================================
-- PlayTurf — RLS verification tests (run in Supabase Dashboard → SQL Editor)
-- Companion to supabase_security_fixes.sql + supabase_admin_rbac.sql.
--
-- HOW THIS WORKS: the SQL editor runs as `postgres` (bypasses RLS). To test
-- RLS we impersonate roles with `SET LOCAL ROLE` and forge JWT claims via
-- request.jwt.claims. Each test runs in its own transaction (BEGIN/COMMIT)
-- so impersonation never leaks. Run top-to-bottom; expected results are in
-- the comment of every block. Any ✗ = a policy is wrong.
--
-- ⚠️ Run BOTH migration files first. Replace the two test UUIDs with real
--    rows from your database (a player, a second player, a turf owner).
-- ============================================================================

-- Helper: act as a specific user (creates a temp JWT claim set)
CREATE OR REPLACE FUNCTION test_as_user(p_uid uuid) RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('role', 'authenticated', true);
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
$$;

CREATE OR REPLACE FUNCTION test_as_anon() RETURNS void
LANGUAGE sql AS $$
  SELECT set_config('role', 'anon', true);
  SELECT set_config('request.jwt.claims', '{}', true);
$$;

-- ============================================================================
-- TEST 1 — Anonymous access
-- ============================================================================
BEGIN;
  CALL test_as_anon();
  -- Public reads allowed:
  SELECT count(*) AS turfs_visible FROM public.turfs;                 -- expect ≥ 0
  -- Private reads BLOCKED (should raise or return 0 rows via RLS):
  SELECT count(*) AS bookings_visible FROM public.bookings;           -- expect 0 (own-rows policy with anon uid)
  SELECT count(*) AS profiles_visible FROM public.profiles;           -- expect 0
ROLLBACK;

-- ============================================================================
-- TEST 2 — Player sees only their own bookings/profile
-- Replace PLAYER_A / PLAYER_B with real profile ids.
-- ============================================================================
-- BEGIN;
--   \set PLAYER_A '00000000-0000-0000-0000-000000000001'
--   \set PLAYER_B '00000000-0000-0000-0000-000000000002'
--   CALL test_as_user(:'PLAYER_A');
--   SELECT count(*) AS my_bookings FROM public.bookings WHERE user_id = :'PLAYER_A';  -- expect > 0 (if data)
--   SELECT count(*) AS other_bookings FROM public.bookings WHERE user_id = :'PLAYER_B'; -- expect 0 (RLS hides)
-- ROLLBACK;

-- ============================================================================
-- TEST 3 — Profile self-service only
-- ============================================================================
-- BEGIN;
--   CALL test_as_user(:'PLAYER_A');
--   UPDATE public.profiles SET full_name = 'RLS Test' WHERE id = :'PLAYER_A';   -- expect UPDATE 1
--   UPDATE public.profiles SET full_name = 'Hacked' WHERE id = :'PLAYER_B';     -- expect UPDATE 0 (RLS)
--   -- Role self-elevation MUST FAIL (role-guard trigger) after migration:
--   UPDATE public.profiles SET role = 'super_admin' WHERE id = :'PLAYER_A';     -- expect ERROR
-- ROLLBACK;

-- ============================================================================
-- TEST 4 — Audit log is append-only and admin-attributed
-- ============================================================================
-- BEGIN;
--   CALL test_as_user(:'SUPER_ADMIN');
--   SELECT public.log_admin_action('test.action', 'test-record', NULL, '{"probe":true}'::jsonb, 'RLS test');
--   SELECT actor_id, action FROM public.admin_audit_log WHERE action = 'test.action' ORDER BY created_at DESC LIMIT 1;
--     -- actor_id MUST equal the super admin's id (server-side attribution)
--   -- Direct insert must FAIL (no insert policy):
--   INSERT INTO public.admin_audit_log (actor_id, action) VALUES (:'SUPER_ADMIN', 'spoofed'); -- expect ERROR
--   -- Update/delete must FAIL (no policy):
--   UPDATE public.admin_audit_log SET action = 'tampered' WHERE action = 'test.action';        -- expect ERROR or 0 rows
--   DELETE FROM public.admin_audit_log WHERE action = 'test.action';                            -- expect ERROR or 0 rows
-- ROLLBACK;

-- ============================================================================
-- TEST 5 — Non-admin cannot write audit entries (RPC guard)
-- ============================================================================
-- BEGIN;
--   CALL test_as_user(:'PLAYER_A');
--   SELECT public.log_admin_action('test.spoof');   -- expect ERROR: Only PlayTurf administrators...
-- ROLLBACK;

-- ============================================================================
-- TEST 6 — Admin role matrix against real tables
-- For each role value below, run as that user and verify:
--   role            | turfs write | site_settings write | seo_pages write | audit read
--   super_admin     |     YES     |        YES          |      YES        |   YES
--   admin           |     YES     |        no           |      YES        |   no
--   finance_admin   |     no      |        YES*         |      no         |   no
--   content_admin   |     no      |        no           |      YES        |   no
--   support_admin   |     no      |        no           |      no         |   no
--   * finance_admin can write settings (config keys) by design.
--   player/client  |     no      |        no           |      no         |   no
-- ============================================================================
-- BEGIN;
--   CALL test_as_user(:'FINANCE_ADMIN');
--   INSERT INTO public.turfs (name, city) VALUES ('RLS Probe', 'Test');  -- expect ERROR (policy)
--   SELECT count(*) FROM public.bookings;                                -- expect all rows (view policy)
-- ROLLBACK;

-- ============================================================================
-- TEST 7 — Booking integrity (double booking still impossible)
-- ============================================================================
-- BEGIN;
--   CALL test_as_user(:'PLAYER_A');
--   -- Insert two bookings for the same turf/date/start_time/pitch —
--   -- the second must fail via unique_active_booking or the overlap trigger.
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_rls_test1', :'PLAYER_A', '<REAL_TURF_ID>', 'Test', '2099-01-01', '10:00', '11:00', 1, 100, 'confirmed');
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_rls_test2', :'PLAYER_A', '<REAL_TURF_ID>', 'Test', '2099-01-01', '10:00', '11:00', 1, 100, 'confirmed');
--   -- expect second INSERT to raise: duplicate key OR overlap trigger
-- ROLLBACK;

-- ============================================================================
-- RESULT LOGGING
-- Every block above runs in its own transaction; anything that raised an
-- error where one was EXPECTED is a pass (the editor shows the error text —
-- match it against the expectation in the comment).
-- ============================================================================
