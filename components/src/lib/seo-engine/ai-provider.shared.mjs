/**
 * Phase 5 — AI provider interface with a STUB implementation (flag off).
 *
 * Master prompt Phase 5: "AI pipeline with a stub provider, flag off." No
 * real listing data reaches any provider until the owner chooses one and
 * sets `seo_ai_enabled=1` + provider credentials.
 *
 * Real providers (Claude API / OpenAI) implement the same interface:
 *   generateDescription(source, { signal }) -> { text, model, tokens }
 * plus cost accounting via `chargeUsd(amount)` against the monthly cap
 * (SEO_ENGINE_CONFIG.aiMonthlyCostCapUsd) and rate limiting via
 * aiRateLimitPerMin. The stub never performs network I/O and never charges.
 */

let monthlySpendUsd = 0;

export function monthlySpend() {
  return monthlySpendUsd;
}

export function resetSpend() {
  monthlySpendUsd = 0;
}

/**
 * The stub provider: returns null (meaning "no AI content available"), which
 * callers treat as "keep the deterministic template description".
 */
export const stubProvider = {
  name: "stub",
  async generateDescription() {
    return null;
  },
};

/** Guard: cost cap + rate limiting shared by every real provider. */
export function canCallAI(state, cfg, estimatedCostUsd = 0) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  if (state.minuteStartedAt !== minute) {
    state.minuteStartedAt = minute;
    state.callsThisMinute = 0;
  }
  if (state.callsThisMinute >= cfg.aiRateLimitPerMin) {
    return { ok: false, reason: "rate limit reached" };
  }
  if (monthlySpendUsd + estimatedCostUsd > cfg.aiMonthlyCostCapUsd) {
    return { ok: false, reason: "monthly cost cap reached" };
  }
  state.callsThisMinute += 1;
  monthlySpendUsd += estimatedCostUsd; // accumulate so consecutive calls hit the cap
  return { ok: true };
}
