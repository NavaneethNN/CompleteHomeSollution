import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://3c512ae7abd5e3c9cd7743c91569aaa7@o4511341988216832.ingest.us.sentry.io/4511341989462016",

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  integrations: [
    Sentry.replayIntegration({
      // Mask all input fields (passwords, payment cards, names, addresses) for privacy
      maskAllInputs: true,
      // Keep text visible so UI buttons and error notices are inspectable in replays
      maskAllText: false,
      // Block sensitive card and payment elements
      block: [".payway-card-frame", "[data-sentry-block]"],
    }),
    Sentry.dedupeIntegration(),
  ],

  // Free Tier Strategy for Session Replay (50 replays/month allowance):
  // 0% of normal error-free sessions sampled to protect quota
  // 100% of sessions where errors occur captured so you see exactly what caused the bug
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Free Tier Strategy for Performance Tracing (10,000 transactions/month allowance):
  // 100% in development for verification, smart sampling in production
  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV === "development") return 1.0;

    const name = samplingContext.transactionContext?.name || "";

    // Ignore noisy polling and static pings
    if (
      name.includes("/api/health") ||
      name.includes("/api/shipping/availability") ||
      name.includes("/poll-payment")
    ) {
      return 0.0;
    }

    // High priority: checkout and cart flows
    if (name.includes("/checkout") || name.includes("/api/checkout") || name.includes("/cart")) {
      return 0.15; // 15%
    }

    // General navigation
    return 0.02; // 2%
  },

  // Ignore noisy third-party and transient browser errors that burn the 5,000 monthly error quota
  ignoreErrors: [
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
    "Load failed",
    "AbortError",
    "Non-Error promise rejection captured",
    "Script error.",
    "cancel transition",
  ],

  // Deny errors originating from browser extensions
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
  ],

  beforeSend(event) {
    // Drop errors coming from browser extensions
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (
      frames &&
      frames.some(
        (f) =>
          f.filename &&
          (f.filename.includes("extension") ||
            f.filename.startsWith("chrome") ||
            f.filename.startsWith("safari-web-extension"))
      )
    ) {
      return null;
    }

    // Scrub credit card numbers if present in messages
    if (event.message) {
      event.message = event.message.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CARD]");
    }

    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
