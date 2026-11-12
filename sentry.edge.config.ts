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

  tracesSampler: (samplingContext) => {
    if (process.env.NODE_ENV === "development") return 1.0;

    const name = samplingContext.transactionContext?.name || "";
    if (name.includes("/health") || name.includes("/robots.txt") || name.includes("/sitemap.xml")) {
      return 0.0;
    }
    return 0.02;
  },

  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }
    return event;
  },
});
