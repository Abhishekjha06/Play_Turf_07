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

-- ============================================================================
-- TEST 8 — Blocked slots (supabase_client_panel.sql)
-- Prerequisites: supabase_client_panel.sql run; OWNER_A owns TURF_X
-- (assign via Admin → Venue Management). PLAYER_A is a separate profile.
-- ============================================================================

-- 8.1 Owner blocks ONE hour — expect INSERT 1
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time, reason)
--   VALUES (:'TURF_X', CURRENT_DATE + 1, '10:00', '11:00', 'test 8.1');
-- ROLLBACK;

-- 8.2 Owner blocks MULTIPLE hours (two rows) — expect INSERT 2
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 1, '14:00', '15:00'),
--          (:'TURF_X', CURRENT_DATE + 1, '15:00', '16:00');
-- ROLLBACK;

-- 8.3 Date range — app-level blockSlots() expands one row per day/hour;
--     verify N days × H hours rows exist after using the Venue Panel form.

-- 8.4 Unblock — owner deletes their own row; expect DELETE 1
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   DELETE FROM public.blocked_slots WHERE turf_id = :'TURF_X' AND date = CURRENT_DATE + 1 AND start_time = '10:00';
-- ROLLBACK;

-- 8.5 Booking a BLOCKED slot must FAIL (trigger guard)
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 2, '18:00', '19:00');
--   CALL test_as_user(:'PLAYER_A');
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_blk_test', :'PLAYER_A', :'TURF_X', 'Test', CURRENT_DATE + 2, '18:00', '19:00', 1, 100, 'confirmed');
--   -- expect ERROR: 'This time range is blocked by the venue and cannot be booked.'
-- ROLLBACK;

-- 8.6 Booking an AVAILABLE slot still works — expect INSERT 1
-- BEGIN;
--   CALL test_as_user(:'PLAYER_A');
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_ok_test', :'PLAYER_A', :'TURF_X', 'Test', CURRENT_DATE + 3, '09:00', '10:00', 1, 100, 'confirmed');
-- ROLLBACK;

-- 8.7 Multi-hour booking where ONE hour is blocked — must FAIL entirely
-- (multi-hour = one row per hour in one INSERT; a single blocked hour
--  rejects the WHOLE statement → no partial booking)
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 4, '20:00', '21:00');
--   CALL test_as_user(:'PLAYER_A');
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_mh_a', :'PLAYER_A', :'TURF_X', 'Test', CURRENT_DATE + 4, '19:00', '20:00', 1, 100, 'confirmed'),
--          ('bkg_mh_b', :'PLAYER_A', :'TURF_X', 'Test', CURRENT_DATE + 4, '20:00', '21:00', 1, 100, 'confirmed');
--   -- expect ERROR on the blocked hour; verify NO bkg_mh_a row persisted (transaction rolled back)
-- ROLLBACK;

-- 8.8 Overlapping blocked records — duplicate exact block hits
--     unique_blocked_slot → expect unique violation
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 5, '08:00', '09:00');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 5, '08:00', '09:00');   -- expect ERROR 23505
-- ROLLBACK;

-- 8.9 Time boundaries — adjacent hours must NOT conflict
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 6, '12:00', '13:00');
--   CALL test_as_user(:'PLAYER_A');
--   INSERT INTO public.bookings (id, user_id, turf_id, turf_name, date, start_time, end_time, hours, amount, status)
--   VALUES ('bkg_edge', :'PLAYER_A', :'TURF_X', 'Test', CURRENT_DATE + 6, '13:00', '14:00', 1, 100, 'confirmed');
--   -- expect INSERT 1 (13:00 starts exactly when the block ends — no overlap)
-- ROLLBACK;

-- 8.10 Owner isolation — Owner B cannot touch Owner A's blocks
-- BEGIN;
--   CALL test_as_user(:'OWNER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 7, '10:00', '11:00', 'A block');
--   CALL test_as_user(:'OWNER_B');   -- owns a DIFFERENT turf
--   UPDATE public.blocked_slots SET reason = 'hacked' WHERE turf_id = :'TURF_X';  -- expect UPDATE 0 (RLS)
--   DELETE FROM public.blocked_slots WHERE turf_id = :'TURF_X';                    -- expect DELETE 0 (RLS)
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 7, '11:00', '12:00');                        -- expect ERROR (WITH CHECK)
--   CALL test_as_user(:'PLAYER_A');
--   INSERT INTO public.blocked_slots (turf_id, date, start_time, end_time)
--   VALUES (:'TURF_X', CURRENT_DATE + 7, '12:00', '13:00');                        -- expect ERROR (players cannot block)
-- ROLLBACK;

-- 8.11 Concurrent booking requests — two sessions booking the same slot
-- simultaneously: the unique_active_booking index lets exactly one commit;
-- the other receives a duplicate-key error. Verify by running 8.6's INSERT
-- from two SQL-editor tabs at the same moment — expect one success, one
-- 'duplicate key value violates unique constraint "unique_active_booking"'.
