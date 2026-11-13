/**
 * Unit tests for pure security-adjacent logic: the admin RBAC permission
 * matrix and the admin-login role/suspension rules. These verify the client
 * guards — backend RLS is tested separately (supabase_rls_tests.sql).
 */
import { describe, it, expect } from "vitest";
import {
  ADMIN_ROLES, hasPermission, isAdminRole, PERMISSIONS, ROLE_LABELS,
} from "@/admin/admin-rbac";

describe("admin RBAC matrix", () => {
  it("recognises exactly the five admin roles", () => {
    expect(ADMIN_ROLES).toEqual([
      "super_admin", "admin", "finance_admin", "content_admin", "support_admin",
    ]);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });

  it("gives super_admin every permission", () => {
    const all = Object.values(PERMISSIONS).flat();
    for (const p of all) {
      expect(hasPermission("super_admin", p as never)).toBe(true);
    }
  });

  it("gives finance_admin financial but not venue/CMS permissions", () => {
    expect(hasPermission("finance_admin", "finance.view")).toBe(true);
    expect(hasPermission("finance_admin", "finance.manage")).toBe(true);
    expect(hasPermission("finance_admin", "bookings.view")).toBe(true);
    expect(hasPermission("finance_admin", "venues.manage")).toBe(false);
    expect(hasPermission("finance_admin", "cms.manage")).toBe(false);
    expect(hasPermission("finance_admin", "users.moderate")).toBe(false);
    expect(hasPermission("finance_admin", "audit.view")).toBe(false);
  });

  it("gives operations admin (admin) venues/games/CMS but not finance or audit", () => {
    expect(hasPermission("admin", "venues.manage")).toBe(true);
    expect(hasPermission("admin", "games.moderate")).toBe(true);
    expect(hasPermission("admin", "cms.manage")).toBe(true);
    expect(hasPermission("admin", "finance.view")).toBe(false);
    expect(hasPermission("admin", "audit.view")).toBe(false);
    expect(hasPermission("admin", "settings.manage")).toBe(false);
  });

  it("gives content_admin SEO/CMS but not user or venue permissions", () => {
    expect(hasPermission("content_admin", "seo.manage")).toBe(true);
    expect(hasPermission("content_admin", "cms.manage")).toBe(true);
    expect(hasPermission("content_admin", "users.view")).toBe(false);
    expect(hasPermission("content_admin", "venues.manage")).toBe(false);
    expect(hasPermission("content_admin", "finance.view")).toBe(false);
  });

  it("gives support_admin user moderation and support but not finance/venues", () => {
    expect(hasPermission("support_admin", "support.manage")).toBe(true);
    expect(hasPermission("support_admin", "users.moderate")).toBe(true);
    expect(hasPermission("support_admin", "finance.view")).toBe(false);
    expect(hasPermission("support_admin", "venues.manage")).toBe(false);
    expect(hasPermission("support_admin", "security.manage")).toBe(false);
  });

  it("denies everything to non-admin roles", () => {
    for (const p of Object.keys(PERMISSIONS)) {
      expect(hasPermission("user", p as never)).toBe(false);
      expect(hasPermission("client", p as never)).toBe(false);
      expect(hasPermission(null, p as never)).toBe(false);
    }
  });

  it("labels every role", () => {
    for (const r of ADMIN_ROLES) {
      expect(ROLE_LABELS[r]).toBeTruthy();
    }
  });
});

describe("admin login role rules", () => {
  // Mirrors ADMIN_LOGIN_ROLES in lib/api/auth.ts — keep in sync.
  const ADMIN_LOGIN_ROLES = ["admin", "super_admin", "finance_admin", "content_admin", "support_admin"];

  it("admits every RBAC role at the login gate", () => {
    for (const r of ADMIN_ROLES) {
      expect(ADMIN_LOGIN_ROLES).toContain(r);
    }
  });

  it("rejects player and turf-owner roles at the login gate", () => {
    expect(ADMIN_LOGIN_ROLES).not.toContain("user");
    expect(ADMIN_LOGIN_ROLES).not.toContain("client");
  });
});
