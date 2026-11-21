-- ============================================================================
-- Play Turf — Migration 004: ATOMIC SLUG EDIT RPC (owner round-3 item 2)
-- File: supabase_seo_004_slug_rpc.sql                        (idempotent)
-- Down:  supabase_seo_004_slug_rpc_down.sql
--
-- ONE RPC performs, in a single transaction:
--   1. admin/super_admin authorization (migration 003 rule)
--   2. slug validation (format + uniqueness across turfs + metadata scope)
--   3. version snapshot of the current metadata row (rollback surface)
--   4. slug write + locked_fields append (admin edits win over regeneration)
--   5. 301 redirect row: old /turf/{old-slug} → /turf/{new-slug}
--   6. chain collapse: any redirect pointing at the old path is re-pointed at
--      the new path at write time (request-time resolver still defends).
--
-- Pooler-safe: every write happens inside THIS function call = one transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seo_admin_set_slug(
  p_metadata_id bigint,
  p_new_slug    text,
  p_actor       text DEFAULT 'admin'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row        public.seo_metadata;
  v_old_slug   text;
  v_entity_id  text;
  v_old_path   text;
  v_new_path   text;
  v_new_version integer;
BEGIN
  -- 1. Authorization: admin/super_admin only (migration 003).
  IF NOT public.is_seo_write_admin() THEN
    RAISE EXCEPTION 'seo_admin_set_slug: admin or super_admin only';
  END IF;

  -- 2. Validate format.
  IF p_new_slug IS NULL OR p_new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_new_slug) > 80 THEN
    RAISE EXCEPTION 'seo_admin_set_slug: invalid slug "%" (lowercase-hyphen ASCII, ≤80 chars)', p_new_slug;
  END IF;

  SELECT * INTO v_row FROM public.seo_metadata WHERE id = p_metadata_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'seo_admin_set_slug: metadata id % not found', p_metadata_id;
  END IF;
  IF v_row.entity_type <> 'turf' THEN
    RAISE EXCEPTION 'seo_admin_set_slug: only turf metadata slugs are editable via this RPC';
  END IF;

  v_old_slug  := v_row.slug;
  v_entity_id := v_row.entity_id;
  v_old_path  := '/turf/' || v_old_slug;
  v_new_path  := '/turf/' || p_new_slug;

  IF p_new_slug = v_old_slug THEN
    RETURN jsonb_build_object('changed', false, 'slug', p_new_slug, 'version', v_row.version);
  END IF;

  -- Uniqueness: the slug must not belong to ANOTHER turf row.
  IF EXISTS (SELECT 1 FROM public.turfs WHERE slug = p_new_slug AND id <> v_entity_id) THEN
    RAISE EXCEPTION 'seo_admin_set_slug: slug "%" is already taken by another turf', p_new_slug;
  END IF;

  -- 3. Snapshot current state (rollback surface).
  INSERT INTO public.seo_metadata_versions (seo_metadata_id, version, snapshot, changed_by, change_reason)
  VALUES (p_metadata_id, v_row.version, to_jsonb(v_row), p_actor, 'slug-change');

  -- 4. Write the new slug (locked, version bumped).
  v_new_version := v_row.version + 1;
  UPDATE public.seo_metadata
  SET slug = p_new_slug,
      locked_fields = locked_fields || '["slug"]'::jsonb,
      version = v_new_version,
      updated_at = now()
  WHERE id = p_metadata_id;

  UPDATE public.turfs SET slug = p_new_slug WHERE id = v_entity_id;

  -- 5. 301: old URL → new URL (upsert; never break an existing tombstone).
  INSERT INTO public.seo_redirects (from_path, to_path, status_code, reason, target_robots)
  VALUES (v_old_path, v_new_path, 301, 'admin_slug_change', 'index')
  ON CONFLICT (from_path) DO UPDATE
    SET to_path = v_new_path, status_code = 301, reason = 'admin_slug_change', target_robots = 'index'
  WHERE seo_redirects.status_code = 301 OR seo_redirects.from_path = v_old_path;

  -- 6. Chain collapse at write time: anything that pointed at the OLD path
  --    now points at the NEW path (no growing chains).
  UPDATE public.seo_redirects
  SET to_path = v_new_path
  WHERE to_path = v_old_path AND status_code = 301 AND from_path <> v_old_path;

  RETURN jsonb_build_object(
    'changed', true,
    'slug', p_new_slug,
    'version', v_new_version,
    'redirect_from', v_old_path,
    'redirect_to', v_new_path
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seo_admin_set_slug(bigint, text, text) TO authenticated;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.seo_admin_set_slug(bigint, text, text);
