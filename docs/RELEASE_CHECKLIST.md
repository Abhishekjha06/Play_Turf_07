# PlayTurf Production Release Checklist

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Status:** Template

---

## Build & Type Safety

- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run build` completes successfully
- [ ] `npm run lint` passes (0 errors in changed files)
- [ ] No console errors in development build
- [ ] No console warnings (or documented exceptions)

## Tests

- [ ] Unit tests pass (`npm run test` or `vitest`)
- [ ] Component tests pass (if applicable)
- [ ] No test coverage regression > 5%

## Performance

- [ ] Lighthouse Performance score >= 75
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Total Blocking Time (TBT) < 200ms
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] Time to Interactive (TTI) < 3.8s
- [ ] Bundle size checked (no unexpected growth)

## Accessibility

- [ ] Lighthouse Accessibility score >= 90
- [ ] axe-core scan (0 violations)
- [ ] All forms have `<label>` elements
- [ ] All icon-only buttons have `aria-label`
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Keyboard navigation works on all pages
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader labels tested (VoiceOver / NVDA)
- [ ] Dialogs have `aria-labelledby`
- [ ] Touch targets >= 44x44px

## Responsive

- [ ] Tested at 320px (iPhone SE)
- [ ] Tested at 375px (iPhone X)
- [ ] Tested at 430px (iPhone 14 Pro Max)
- [ ] Tested at 768px (iPad)
- [ ] Tested at 1024px (iPad landscape / small laptop)
- [ ] No horizontal scroll on any page
- [ ] No text clipping or overflow
- [ ] Touch targets still usable at all widths

## Typography

- [ ] No text smaller than 12px (`text-xs`)
- [ ] No inline `style={{ fontSize: "..." }}` (outside PDF/invoice)
- [ ] No arbitrary `text-[...px]` values
- [ ] Headings use semantic hierarchy (h1 > h2 > h3)
- [ ] `text-balance` applied to all headings

## SEO

- [ ] `<title>` tags on all pages
- [ ] `<meta name="description">` present
- [ ] Open Graph tags for shareable pages
- [ ] Canonical URLs set
- [ ] robots.txt configured
- [ ] Sitemap generated

## PWA

- [ ] Web App Manifest present
- [ ] Service Worker registered
- [ ] Icons for all platforms (192px, 512px)
- [ ] Splash screen configured
- [ ] Works offline (basic shell)
- [ ] Install prompt works on Android

## Security

- [ ] No secrets in client bundle
- [ ] Supabase keys are public-safe (anon key only)
- [ ] No `eval()` or `new Function()` usage
- [ ] CSP headers configured (if applicable)
- [ ] HTTPS enforced in production

## Bundle Analysis

- [ ] `npm run build` output reviewed
- [ ] No duplicate dependencies
- [ ] Tree-shaking verified (no dead code)
- [ ] Images optimized (WebP where possible)
- [ ] CSS purged (no unused Tailwind classes)
- [ ] Vendor chunk separated from app code

## Images

- [ ] All images have `width` and `height` attributes (or aspect-ratio)
- [ ] Images lazy-loaded below fold
- [ ] Hero images have `priority` or `preload`
- [ ] Image formats: WebP primary, JPEG fallback
- [ ] No images > 200KB without optimization

## Caching

- [ ] Static assets cached (JS, CSS, fonts)
- [ ] API responses cached appropriately
- [ ] Cache busting strategy (hash in filename)
- [ ] `Cache-Control` headers configured

## Analytics & Monitoring

- [ ] Error monitoring configured (Sentry / LogRocket)
- [ ] Analytics configured (Google Analytics / Mixpanel)
- [ ] Core Web Vitals monitored
- [ ] User session recording (optional)

## Manual QA

- [ ] Login flow tested
- [ ] Signup flow tested
- [ ] Password reset flow tested
- [ ] Booking flow tested end-to-end
- [ ] Payment flow tested (test mode)
- [ ] Booking cancellation tested
- [ ] Notification system tested
- [ ] Theme toggle tested (both themes)
- [ ] Search functionality tested
- [ ] Filter functionality tested
- [ ] Admin dashboard tested
- [ ] Receipt generation tested

## Store Readiness (if applicable)

- [ ] App Store / Play Store screenshots
- [ ] App description updated
- [ ] Privacy policy link
- [ ] Terms of service link
- [ ] Support contact information

## Production Deployment

- [ ] Deployed to staging first
- [ ] Staging tested by team
- [ ] Database migrations run (if applicable)
- [ ] Environment variables configured
- [ ] CDN assets uploaded
- [ ] DNS / routing configured
- [ ] SSL certificate valid

## Rollback Plan

- [ ] Previous release tagged in Git
- [ ] Rollback procedure documented
- [ ] Database rollback plan (if applicable)
- [ ] CDN purge procedure
- [ ] Communication plan for users (if downtime)

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| QA Engineer | | | |
| Product Manager | | | |
| Designer | | | |

---

## Post-Release (24h)

- [ ] Error rates monitored (should be < 0.1%)
- [ ] Core Web Vitals stable
- [ ] User feedback reviewed
- [ ] Hotfix branch ready if needed
- [ ] Retrospective scheduled
