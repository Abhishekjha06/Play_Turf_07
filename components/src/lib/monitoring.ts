import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

export function initMonitoring() {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }

  if (import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
      },
      loaded: (posthog) => {
        // In actual beta testing we want capturing, so don't opt out unconditionally in DEV
        // if (import.meta.env.DEV) posthog.opt_out_capturing();
      },
    });
  }
}
