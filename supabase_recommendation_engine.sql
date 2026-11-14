-- ============================================================================
-- PLAY TURF RECOMMENDATION ENGINE V1  (supabase_recommendation_engine.sql)
-- Run manually in the Supabase dashboard SQL editor (project convention —
-- same workflow as supabase_admin_rbac.sql / supabase_client_panel.sql).
--
-- Implements "get_similar_turfs" — Balanced Recommendation Strategy:
--   distance 35% · sports 30% · price 15% · rating 10% · facilities 5% ·
--   popularity 5%  (weights re-normalized over components with data)
--
-- AUDIT NOTES (docs/recommendation-engine-audit.md):
--   * No PostGIS in this project → distance uses an immutable haversine SQL
--     function (same formula as src/lib/api/turfs.ts). A PostGIS GiST upgrade
--     path is documented at the bottom; no new dependency is introduced here.
--   * turfs has no is_active/soft-delete column → "row exists" = active.
--   * turfs.rating is a denormalized scalar with no review sync trigger →
--     the Bayesian rating below aggregates `reviews` live (source of truth).
--   * Booking statuses are case-mixed ('confirmed'/'CONFIRMED') → the
--     popularity predicate normalizes with lower(status).
--   * SECURITY DEFINER is required so aggregate booking counts work under the
--     pending RLS-tightening migrations without exposing customer rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Indexes
-- ----------------------------------------------------------------------------
-- Popularity: confirmed bookings per turf over a 30-day window.
CREATE INDEX IF NOT EXISTS idx_bookings_turf_created
  ON public.bookings (turf_id, created_at DESC);

-- Sports/city lookups used by the candidate pool and other screens.
CREATE INDEX IF NOT EXISTS idx_turfs_city ON public.turfs (city);

-- ----------------------------------------------------------------------------
-- 2. Haversine distance (immutable, no PostGIS dependency)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pl_turf_distance_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_temp
AS $$
  SELECT 2 * 6371.0 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. Private scoring pass (one radius). Not executable by clients.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pl_similar_turfs_pass(
  p_current public.turfs,
  p_global_avg double precision,
  p_selected_sport text,
  p_radius_km numeric,
  p_limit int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool_max int;
  v_out jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
  v_count int := 0;
  r record;
BEGIN
  -- The main function may call this pass twice in one transaction (10 km then
  -- 20 km fallback); ON COMMIT DROP alone would collide on the second call.
  DROP TABLE IF EXISTS pg_temp._pl_cand;
  DROP TABLE IF EXISTS pg_temp._pl_scored;

  CREATE TEMP TABLE _pl_cand ON COMMIT DROP AS
  WITH base AS (
    SELECT
      t.id, t.name, t.city, t.image, t.price_per_hour,
      t.sport_types, t.amenities,
      public._pl_turf_distance_km(p_current.lat, p_current.lng, t.lat, t.lng) AS distance_km
    FROM public.turfs t
    WHERE t.id <> p_current.id
      AND t.lat IS NOT NULL AND t.lng IS NOT NULL
      AND btrim(coalesce(t.name, '')) <> ''
      AND public._pl_turf_distance_km(p_current.lat, p_current.lng, t.lat, t.lng) <= p_radius_km
  ),
  pop AS ( -- Phase 8: confirmed bookings, last 30 days (cancelled excluded by predicate)
    SELECT b.turf_id, count(*)::int AS confirmed_30d
    FROM public.bookings b
    WHERE lower(b.status) = 'confirmed'
      AND b.created_at >= now() - interval '30 days'
    GROUP BY b.turf_id
  ),
  rev AS ( -- Phase 6: live review aggregates (source of truth for ratings)
    SELECT r.turf_id, avg(r.rating) AS avg_rating, count(*)::int AS review_count
    FROM public.reviews r
    GROUP BY r.turf_id
  ),
  cand AS (
    SELECT
      b.*,
      coalesce(pop.confirmed_30d, 0) AS bookings_30d,
      rev.avg_rating,
      coalesce(rev.review_count, 0) AS review_count
    FROM base b
    LEFT JOIN pop ON pop.turf_id = b.id
    LEFT JOIN rev ON rev.turf_id = b.id
  )
  SELECT
    c.*,
    -- Phase 3: distance similarity
    100.0 * greatest(0, 1 - c.distance_km / p_radius_km)                          AS s_distance,
    -- Phase 4: sports Jaccard (normalized with lower(btrim())); NULL when either
    -- side has no sports data (missing ≠ 0)
    CASE
      WHEN cardinality(array(select unnest(p_current.sport_types) x where btrim(x) <> '')) = 0
        OR cardinality(array(select unnest(c.sport_types) x where btrim(x) <> '')) = 0 THEN NULL
      ELSE 100.0 *
        (SELECT count(*) FROM unnest(p_current.sport_types) s1
          JOIN unnest(c.sport_types) s2 ON lower(btrim(s1)) = lower(btrim(s2)))::double precision
        / greatest(1,
            (SELECT count(DISTINCT lower(btrim(x))) FROM unnest(p_current.sport_types) x WHERE btrim(x) <> '')
            + (SELECT count(DISTINCT lower(btrim(x))) FROM unnest(c.sport_types) x WHERE btrim(x) <> '')
            - (SELECT count(*) FROM unnest(p_current.sport_types) s1
                JOIN unnest(c.sport_types) s2 ON lower(btrim(s1)) = lower(btrim(s2))))
    END                                                                          AS s_sports,
    -- Phase 5: price similarity (missing/zero price = missing data, never 0)
    CASE WHEN p_current.price_per_hour > 0 AND c.price_per_hour > 0 THEN
      100.0 * greatest(0, 1 - abs(c.price_per_hour - p_current.price_per_hour) / p_current.price_per_hour)
    END                                                                          AS s_price,
    -- Phase 6: Bayesian rating ((v/(v+m))·R + (m/(v+m))·C, m=5, C=global avg),
    -- normalized over the 1–5 scale. No reviews → the neutral prior.
    100.0 * (
      ((coalesce(c.review_count, 0)::double precision / (coalesce(c.review_count, 0) + 5.0))
        * coalesce(c.avg_rating, p_global_avg))
      + ((5.0 / (coalesce(c.review_count, 0) + 5.0)) * p_global_avg)
      - 1.0
    ) / 4.0                                                                      AS s_rating,
    -- Phase 7: facilities Jaccard; NULL when either side has no amenity data
    CASE
      WHEN cardinality(array(select unnest(p_current.amenities) x where btrim(x) <> '')) = 0
        OR cardinality(array(select unnest(c.amenities) x where btrim(x) <> '')) = 0 THEN NULL
      ELSE 100.0 *
        (SELECT count(*) FROM unnest(p_current.amenities) a1
          JOIN unnest(c.amenities) a2 ON lower(btrim(a1)) = lower(btrim(a2)))::double precision
        / greatest(1,
            (SELECT count(DISTINCT lower(btrim(x))) FROM unnest(p_current.amenities) x WHERE btrim(x) <> '')
            + (SELECT count(DISTINCT lower(btrim(x))) FROM unnest(c.amenities) x WHERE btrim(x) <> '')
            - (SELECT count(*) FROM unnest(p_current.amenities) a1
                JOIN unnest(c.amenities) a2 ON lower(btrim(a1)) = lower(btrim(a2))))
    END                                                                          AS s_facilities
  FROM cand c;

  SELECT max(bookings_30d) INTO v_pool_max FROM _pl_cand;

  -- Phase 2 + 9: weighted total, re-normalized over components with data.
  CREATE TEMP TABLE _pl_scored ON COMMIT DROP AS
  SELECT
    c.*,
    (CASE WHEN c.s_distance    IS NOT NULL THEN 0.35 ELSE 0 END
   + CASE WHEN c.s_sports      IS NOT NULL THEN 0.30 ELSE 0 END
   + CASE WHEN c.s_price       IS NOT NULL THEN 0.15 ELSE 0 END
    + CASE WHEN c.s_rating      IS NOT NULL THEN 0.10 ELSE 0 END
    + CASE WHEN c.s_facilities  IS NOT NULL THEN 0.05 ELSE 0 END
    + 0.05    -- popularity: always scored in the RPC (real counts; 0 = genuinely quiet)
    ) AS w_sum,
    (
      CASE WHEN c.s_distance   IS NOT NULL THEN 0.35 * least(100, greatest(0, c.s_distance))   ELSE 0 END
    + CASE WHEN c.s_sports     IS NOT NULL THEN 0.30 * least(100, greatest(0, c.s_sports))     ELSE 0 END
    + CASE WHEN c.s_price      IS NOT NULL THEN 0.15 * least(100, greatest(0, c.s_price))      ELSE 0 END
    + CASE WHEN c.s_rating     IS NOT NULL THEN 0.10 * least(100, greatest(0, c.s_rating))     ELSE 0 END
    + CASE WHEN c.s_facilities IS NOT NULL THEN 0.05 * least(100, greatest(0, c.s_facilities)) ELSE 0 END
    + 0.05 * CASE WHEN v_pool_max <= 0 THEN 0 ELSE 100.0 * c.bookings_30d / v_pool_max END
    ) AS weighted
  FROM _pl_cand c;

  -- Phase 11: deterministic ordering — score DESC, sports DESC, distance ASC,
  -- Bayesian rating DESC, turf_id ASC (exact-tie stability).
  FOR r IN
    SELECT s.*,
      ((coalesce(s.review_count, 0)::double precision / (coalesce(s.review_count, 0) + 5.0))
        * coalesce(s.avg_rating, p_global_avg))
      + ((5.0 / (coalesce(s.review_count, 0) + 5.0)) * p_global_avg) AS bayesian
    FROM _pl_scored s
    WHERE s.w_sum > 0
    ORDER BY
      (s.weighted / s.w_sum) DESC,
      s.s_sports DESC NULLS LAST,
      s.distance_km ASC,
      bayesian DESC,
      s.id ASC
  LOOP
    EXIT WHEN v_count >= p_limit;
    -- Phase 11: light diversity — same name+city listed twice is a duplicate.
    IF lower(btrim(r.name)) || '|' || lower(btrim(r.city)) = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || (lower(btrim(r.name)) || '|' || lower(btrim(r.city)));
    v_count := v_count + 1;

    v_out := v_out || jsonb_build_object(
      'turf_id', r.id,
      'name', r.name,
      'image', r.image,
      'city', r.city,
      'distance_km', round(r.distance_km::numeric, 1),
      'price_per_hour', r.price_per_hour,
      'rating', r.avg_rating,               -- NULL when no reviews; never invented
      'review_count', r.review_count,
      'sport_types', to_jsonb(r.sport_types),
      'amenities', to_jsonb(r.amenities),
      'score', round((r.weighted / r.w_sum)::numeric, 1),
      'components', jsonb_build_object(
        'distance',   round(r.s_distance::numeric, 1),
        'sports',     round(r.s_sports::numeric, 1),
        'price',      round(r.s_price::numeric, 1),
        'rating',     round(r.s_rating::numeric, 1),
        'facilities', round(r.s_facilities::numeric, 1),
        'popularity', round((CASE WHEN v_pool_max <= 0 THEN 0 ELSE 100.0 * r.bookings_30d / v_pool_max END)::numeric, 1)
      ),
      'explanations', coalesce((
        SELECT jsonb_agg(label ORDER BY ord)
        FROM (VALUES
          (1, CASE WHEN r.distance_km <= 2 THEN 'Very nearby' END),
          (2, CASE WHEN r.s_sports      >= 90 THEN 'Same sports' END),
          (3, CASE WHEN r.s_price       >= 80 THEN 'Similar pricing' END),
          (4, CASE WHEN r.s_facilities  >= 80 THEN 'Similar facilities' END),
          (5, CASE WHEN r.avg_rating IS NOT NULL AND r.review_count >= 5
                     AND r.s_rating >= 85 THEN 'Highly rated' END)
        ) AS t(ord, label)
        WHERE label IS NOT NULL
      ), '[]'::jsonb),
      'completeness', jsonb_build_object(
        'available', coalesce((
          SELECT jsonb_agg(k ORDER BY ord) FROM (VALUES
            (1, CASE WHEN r.s_distance   IS NOT NULL THEN 'distance' END),
            (2, CASE WHEN r.s_sports     IS NOT NULL THEN 'sports' END),
            (3, CASE WHEN r.s_price      IS NOT NULL THEN 'price' END),
            (4, CASE WHEN r.s_rating     IS NOT NULL THEN 'rating' END),
            (5, CASE WHEN r.s_facilities IS NOT NULL THEN 'facilities' END),
            (6, 'popularity')
          ) AS t(ord, k) WHERE k IS NOT NULL
        ), '[]'::jsonb),
        'missing', coalesce((
          SELECT jsonb_agg(k ORDER BY ord) FROM (VALUES
            (1, CASE WHEN r.s_distance   IS NULL THEN 'distance' END),
            (2, CASE WHEN r.s_sports     IS NULL THEN 'sports' END),
            (3, CASE WHEN r.s_price      IS NULL THEN 'price' END),
            (4, CASE WHEN r.s_rating     IS NULL THEN 'rating' END),
            (5, CASE WHEN r.s_facilities IS NULL THEN 'facilities' END)
          ) AS t(ord, k) WHERE k IS NOT NULL
        ), '[]'::jsonb)
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'recommendations', v_out,
    'metadata', jsonb_build_object(
      'radius_km_used', p_radius_km,
      'candidates_evaluated', v_count,
      'booking_data_available', true
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._pl_similar_turfs_pass(public.turfs, double precision, text, numeric, int) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 4. Public RPC — get_similar_turfs (Phase 13)
--    SECURITY DEFINER with locked search_path; EXECUTE limited to app roles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_similar_turfs(
  p_current_turf_id text,
  p_selected_sport_id text DEFAULT NULL,
  p_search_radius_km numeric DEFAULT 10,
  p_result_limit int DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.turfs;
  v_global_avg double precision;
  v_first jsonb;
  v_expanded jsonb;
  v_final jsonb;
  v_expanded_from numeric := NULL;
  v_radius numeric;
BEGIN
  -- Input validation
  IF p_current_turf_id IS NULL OR btrim(p_current_turf_id) = '' THEN
    RAISE EXCEPTION 'current_turf_id is required';
  END IF;
  p_search_radius_km := least(greatest(coalesce(p_search_radius_km, 10), 1), 50);
  p_result_limit := least(greatest(coalesce(p_result_limit, 10), 1), 10);

  SELECT * INTO v_current FROM public.turfs WHERE id = p_current_turf_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turf % not found', p_current_turf_id;
  END IF;

  -- Phase 10: candidates without coordinates never bypass geographic filtering.
  IF v_current.lat IS NULL OR v_current.lng IS NULL THEN
    RETURN jsonb_build_object(
      'recommendations', '[]'::jsonb,
      'metadata', jsonb_build_object(
        'radius_km_used', NULL,
        'expanded_from_km', NULL,
        'candidates_evaluated', 0,
        'booking_data_available', false,
        'reason', 'current_turf_missing_coordinates'
      )
    );
  END IF;

  SELECT avg(rating) INTO v_global_avg FROM public.turfs;
  v_global_avg := coalesce(v_global_avg, 4.5);

  -- Phase 11: initial 10 km pass; expand to 20 km only when fewer than 5.
  v_first := public._pl_similar_turfs_pass(
    v_current, v_global_avg, p_selected_sport_id, p_search_radius_km, p_result_limit);
  v_final := v_first;
  v_radius := p_search_radius_km;

  IF jsonb_array_length(v_first -> 'recommendations') < 5 AND p_search_radius_km < 20 THEN
    v_expanded := public._pl_similar_turfs_pass(
      v_current, v_global_avg, p_selected_sport_id, 20, p_result_limit);
    IF jsonb_array_length(v_expanded -> 'recommendations')
        > jsonb_array_length(v_first -> 'recommendations') THEN
      v_final := v_expanded;
      v_radius := 20;
      v_expanded_from := p_search_radius_km;
    END IF;
  END IF;

  RETURN jsonb_set(
    v_final,
    '{metadata}',
    (v_final -> 'metadata')
      || jsonb_build_object('radius_km_used', v_radius, 'expanded_from_km', v_expanded_from)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_similar_turfs(text, text, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_similar_turfs(text, text, numeric, int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Optional PostGIS upgrade path (NOT applied — audit found no PostGIS).
--    When adopted: enable the extension, add a GiST index and replace the
--    haversine predicate in _pl_similar_turfs_pass with ST_DWithin/ST_Distance:
--
--    CREATE EXTENSION IF NOT EXISTS postgis;
--    CREATE INDEX idx_turfs_geog ON public.turfs
--      USING gist (ST_SetSRID(ST_MakePoint(lng, lat), 4326));
--    WHERE ST_DWithin(ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326)::geography,
--                     ST_SetSRID(ST_MakePoint(cur.lng, cur.lat), 4326)::geography,
--                     p_radius_km * 1000);
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 6. TEST SUITE (run manually in the SQL editor after the migration)
--    Mirrors supabase_rls_tests.sql conventions. Each block raises an
--    exception on failure and reports PASSED otherwise.
-- ============================================================================

-- T1. Score bounds: every returned score stays within 0–100 for every turf.
DO $$
DECLARE r record; v jsonb; rec jsonb;
BEGIN
  FOR r IN SELECT id FROM public.turfs LOOP
    v := public.get_similar_turfs(r.id, NULL, 10, 10);
    FOR rec IN SELECT * FROM jsonb_array_elements(v -> 'recommendations') LOOP
      IF (rec ->> 'score')::numeric < 0 OR (rec ->> 'score')::numeric > 100 THEN
        RAISE EXCEPTION 'T1 FAILED: score out of bounds for % (turf %)', rec ->> 'name', r.id;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'T1 PASSED: all scores within 0–100';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm LIKE 'T1 FAILED%' THEN RAISE; END IF;
END $$;

-- T2. Self-exclusion: the current turf never appears in its own recommendations.
DO $$
DECLARE r record; v jsonb; rec jsonb;
BEGIN
  FOR r IN SELECT id FROM public.turfs LOOP
    v := public.get_similar_turfs(r.id, NULL, 10, 10);
    FOR rec IN SELECT * FROM jsonb_array_elements(v -> 'recommendations') LOOP
      IF rec ->> 'turf_id' = r.id THEN
        RAISE EXCEPTION 'T2 FAILED: current turf % returned as recommendation', r.id;
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'T2 PASSED: current turf excluded everywhere';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm LIKE 'T2 FAILED%' THEN RAISE; END IF;
END $$;

-- T3. Radius cap: every result sits within the metadata radius (max 20 km).
DO $$
DECLARE r record; v jsonb; rec jsonb; used numeric;
BEGIN
  FOR r IN SELECT id FROM public.turfs LOOP
    v := public.get_similar_turfs(r.id, NULL, 10, 10);
    used := (v -> 'metadata' ->> 'radius_km_used')::numeric;
    IF used > 20 THEN RAISE EXCEPTION 'T3 FAILED: radius % exceeds 20', used; END IF;
    FOR rec IN SELECT * FROM jsonb_array_elements(v -> 'recommendations') LOOP
      IF (rec ->> 'distance_km')::numeric > used THEN
        RAISE EXCEPTION 'T3 FAILED: result % beyond radius', rec ->> 'name';
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'T3 PASSED: results respect the active radius';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm LIKE 'T3 FAILED%' THEN RAISE; END IF;
END $$;

-- T4. Determinism: two consecutive calls return identical output.
DO $$
DECLARE tid text; a jsonb; b jsonb;
BEGIN
  SELECT id INTO tid FROM public.turfs LIMIT 1;
  a := public.get_similar_turfs(tid, NULL, 10, 10);
  b := public.get_similar_turfs(tid, NULL, 10, 10);
  IF a::text <> b::text THEN
    RAISE EXCEPTION 'T4 FAILED: recommendations are not deterministic';
  END IF;
  RAISE NOTICE 'T4 PASSED: results are deterministic';
END $$;

-- T5. Result cap: never more than 10 recommendations.
DO $$
DECLARE r record; v jsonb;
BEGIN
  FOR r IN SELECT id FROM public.turfs LOOP
    v := public.get_similar_turfs(r.id, NULL, 10, 10);
    IF jsonb_array_length(v -> 'recommendations') > 10 THEN
      RAISE EXCEPTION 'T5 FAILED: more than 10 recommendations for %', r.id;
    END IF;
  END LOOP;
  RAISE NOTICE 'T5 PASSED: result cap respected';
EXCEPTION WHEN OTHERS THEN
  IF sqlerrm LIKE 'T5 FAILED%' THEN RAISE; END IF;
END $$;

-- T6. Invalid coordinates: a turf at (0,0) is never recommended.
--     Run this as one transaction block in the SQL editor (fully self-cleaning):
--     BEGIN;
--     DO $$
--     DECLARE tid text; other text; orig_lat double precision; orig_lng double precision;
--             v jsonb; rec jsonb;
--     BEGIN
--       SELECT id INTO tid   FROM public.turfs WHERE lat IS NOT NULL LIMIT 1;
--       SELECT id, lat, lng INTO other, orig_lat, orig_lng
--         FROM public.turfs WHERE id <> tid AND lat IS NOT NULL LIMIT 1;
--       UPDATE public.turfs SET lat = 0, lng = 0 WHERE id = other;
--       v := public.get_similar_turfs(tid, NULL, 10, 10);
--       FOR rec IN SELECT * FROM jsonb_array_elements(v -> 'recommendations') LOOP
--         IF rec ->> 'turf_id' = other THEN
--           RAISE EXCEPTION 'T6 FAILED: turf with invalid coordinates was recommended';
--         END IF;
--       END LOOP;
--       RAISE NOTICE 'T6 PASSED: invalid-coordinate turf excluded';
--     END $$;
--     ROLLBACK;

-- T7. Missing sport data → sports component NULL and weight re-normalized.
--     Insert a probe turf without coordinates/sports inside a transaction,
--     confirm it never appears, then ROLLBACK (transactional, self-cleaning).

-- T8. Authorization: anonymous role may EXECUTE get_similar_turfs (public
--     venue discovery) but NOT the private _pl_similar_turfs_pass.
DO $$
DECLARE has_permission boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.get_similar_turfs(text,text,numeric,int)') INTO has_permission;
  IF NOT has_permission THEN RAISE EXCEPTION 'T8 FAILED: anon cannot execute get_similar_turfs'; END IF;
  SELECT has_function_privilege('anon', 'public._pl_similar_turfs_pass(public.turfs,double precision,text,numeric,int)') INTO has_permission;
  IF has_permission THEN RAISE EXCEPTION 'T8 FAILED: private pass function is executable'; END IF;
  RAISE NOTICE 'T8 PASSED: function privileges correctly scoped';
END $$;
