/**
 * Centralized public business information — the ONLY place business identity
 * values live. Every field must be VERIFIED by the project owner before it
 * is filled in; null fields are deliberately unpublished everywhere (schema,
 * contact page, privacy page). Never invent or guess a value here.
 *
 * OWNER TODO (blocks Organization contactPoint/address + Contact page details):
 *   - supportEmail: a monitored support mailbox
 *   - supportPhone: a published support line (if any)
 *   - address lines: the registered business address, if PlayTurf operates one
 *   - legalEntityName: the registered business name, if applicable
 */
export const business = {
  /** Verified public brand name. */
  businessName: "PlayTurf",
  /** Canonical production origin (confirmed live deployment). */
  websiteUrl: "https://play-turf-git-main-abhishekjha06s-projects.vercel.app",
  /** Public logo (generated asset, served from the site itself). */
  logoUrl: "/playturf-logo.webp",

  // ── UNVERIFIED — publish only after owner confirmation ──────────────────
  supportEmail: null as string | null,
  supportPhone: null as string | null,
  legalEntityName: null as string | null,
  streetAddress: null as string | null,
  city: null as string | null,
  state: null as string | null,
  postalCode: null as string | null,
  country: "IN" as string | null,
};

/** True when every value needed for Organization contactPoint/address exists. */
export function hasVerifiedContactInfo(): boolean {
  return !!(business.supportEmail && business.supportPhone && business.streetAddress && business.city && business.state && business.postalCode);
}
