import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    "https://3c512ae7abd5e3c9cd7743c91569aaa7@o4511341988216832.ingest.us.sentry.io/4511341989462016",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  sendDefaultPii: false,

  integrations: [
    Sentry.dedupeIntegration(),
  ],

  // Free Tier Strategy for Server Performance Tracing (10,000 transactions/month limit):
  // 100% in development for debugging, prioritized quota allocation in production
  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV === "development") return 1.0;

    const name = samplingContext.transactionContext?.name || "";

    // Ignore frequent background polling, health probes, and crawler assets
    if (
      name.includes("/api/health") ||
      name.includes("/api/shipping/availability") ||
      name.includes("/poll-payment") ||
      name.includes("/robots.txt") ||
      name.includes("/sitemap.xml")
    ) {
      return 0.0;
    }

    // High priority: Critical e-commerce revenue and fulfillment routes
    if (
      name.includes("/api/checkout") ||
      name.includes("/api/webhooks") ||
      name.includes("/api/orders") ||
      name.includes("/api/shipping")
    ) {
      return 0.15; // 15%
    }

    return 0.02; // 2% for standard API and page loads
  },

  beforeSend(event) {
    // Sanitize sensitive request headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["set-cookie"];
      delete event.request.headers["x-payway-secret"];
      delete event.request.headers["x-cron-secret"];
      delete event.request.headers["x-couriersplease-webhook-secret"];
    }

    // Drop scanner/bot requests targeting non-existent PHP/admin endpoints to save error quota
    const url = event.request?.url || "";
    if (
      url.includes(".php") ||
      url.includes("wp-admin") ||
      url.includes("wp-login") ||
      url.includes("/.env") ||
      url.includes("cgi-bin")
    ) {
      return null;
    }

    // Redact credit cards if present in exception or log message
    if (event.message) {
      event.message = event.message.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[REDACTED_CARD]");
    }

    return event;
  },
});
