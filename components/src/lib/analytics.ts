import posthog from "posthog-js";
import * as Sentry from "@sentry/react";

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties);
};

export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  posthog.identify(userId, properties);
  Sentry.setUser({ id: userId, ...properties });
};

export const resetAnalyticsUser = () => {
  posthog.reset();
  Sentry.setUser(null);
};

export const logError = (error: unknown, context?: Record<string, any>) => {
  console.error(error, context);
  Sentry.captureException(error, { extra: context });
};
