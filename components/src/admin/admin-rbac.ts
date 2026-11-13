/**
 * PlayTurf Admin RBAC.
 *
 * Roles are stored in profiles.role and validated SERVER-SIDE at login
 * (api.adminPasswordSignIn re-reads the profile and signs non-admins out).
 * This matrix drives UI visibility ONLY — every mutating API call is
 * additionally enforced by RLS policies in supabase_admin_rbac.sql.
 * Never trust this file as the security boundary.
 */

export const ADMIN_ROLES = [
  "super_admin",
  "admin", // operations admin (existing role value, kept for compatibility)
  "finance_admin",
  "content_admin",
  "support_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | "overview.view"
  | "users.view"
  | "users.moderate"
  | "venues.view"
  | "venues.manage"
  | "bookings.view"
  | "games.view"
  | "games.moderate"
  | "finance.view"
  | "finance.manage"
  | "seo.view"
  | "seo.manage"
  | "cms.view"
  | "cms.manage"
  | "support.view"
  | "support.manage"
  | "analytics.view"
  | "security.view"
  | "security.manage"
  | "settings.view"
  | "settings.manage"
  | "audit.view";

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Operations Admin",
  finance_admin: "Finance Admin",
  content_admin: "Content & SEO Admin",
  support_admin: "Support Admin",
};

const ALL: AdminPermission[] = [
  "overview.view", "users.view", "users.moderate",
  "venues.view", "venues.manage",
  "bookings.view",
  "games.view", "games.moderate",
  "finance.view", "finance.manage",
  "seo.view", "seo.manage",
  "cms.view", "cms.manage",
  "support.view", "support.manage",
  "analytics.view",
  "security.view", "security.manage",
  "settings.view", "settings.manage",
  "audit.view",
];

export const PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ALL,

  admin: [
    "overview.view",
    "users.view",
    "venues.view", "venues.manage",
    "bookings.view",
    "games.view", "games.moderate",
    "cms.view", "cms.manage",
    "support.view", "support.manage",
    "analytics.view",
  ],

  finance_admin: [
    "overview.view",
    "bookings.view",
    "finance.view", "finance.manage",
    "analytics.view",
  ],

  content_admin: [
    "overview.view",
    "seo.view", "seo.manage",
    "cms.view", "cms.manage",
    "analytics.view",
  ],

  support_admin: [
    "overview.view",
    "users.view", "users.moderate",
    "bookings.view",
    "games.view",
    "support.view", "support.manage",
    "analytics.view",
  ],
};

export function isAdminRole(role: string | undefined | null): role is AdminRole {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function hasPermission(role: string | undefined | null, permission: AdminPermission): boolean {
  if (!isAdminRole(role)) return false;
  return PERMISSIONS[role].includes(permission);
}

/** Sidebar navigation — filtered by permission at render time. */
export type AdminNavItem = {
  label: string;
  path: string;
  permission: AdminPermission;
  icon: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Overview", path: "/admin", permission: "overview.view", icon: "LayoutDashboard" },
  { label: "User Management", path: "/admin/users", permission: "users.view", icon: "Users" },
  { label: "Venue Management", path: "/admin/venues", permission: "venues.view", icon: "MapPin" },
  { label: "Bookings", path: "/admin/bookings", permission: "bookings.view", icon: "CalendarCheck" },
  { label: "Open Games", path: "/admin/open-games", permission: "games.view", icon: "Volleyball" },
  { label: "Payments & Finance", path: "/admin/finance", permission: "finance.view", icon: "IndianRupee" },
  { label: "SEO Management", path: "/admin/seo", permission: "seo.view", icon: "Search" },
  { label: "Content & Marketing", path: "/admin/cms", permission: "cms.view", icon: "Newspaper" },
  { label: "Tournaments", path: "/admin/tournaments", permission: "cms.manage", icon: "Trophy" },
  { label: "Offers", path: "/admin/offers", permission: "cms.manage", icon: "Tag" },
  { label: "Support & Feedback", path: "/admin/support", permission: "support.view", icon: "LifeBuoy" },
  { label: "Analytics", path: "/admin/analytics", permission: "analytics.view", icon: "BarChart3" },
  { label: "Security & Permissions", path: "/admin/security", permission: "security.view", icon: "ShieldCheck" },
  { label: "System Settings", path: "/admin/settings", permission: "settings.view", icon: "Settings" },
];
