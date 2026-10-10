type ReleaseEnv = Record<string, string | undefined>;

function httpsOrigin(value: string | undefined): string | null {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin;
}

export function releaseConfigErrors(env: ReleaseEnv): string[] {
  const required = ["DATABASE_URL", "NEXT_PUBLIC_APP_URL", "AUTH_SECRET", "CRON_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "BREVO_API_KEY", "SENTRY_DSN"];
  const gateway = env.PAYMENT_GATEWAY;
  if (gateway === "onlinepay") required.push("ONLINEPAY_USER_UID", "ONLINEPAY_API_KEY", "ONLINEPAY_ENTITY_ID", "ONLINEPAY_PPC_ID", "ONLINEPAY_3DS_ID", "ONLINEPAY_WEBHOOK_SECRET", "ONLINEPAY_RETURN_BASE_URL", "ONLINEPAY_MODE");
  else if (gateway === "payway") required.push("PAYWAY_SECRET_KEY", "PAYWAY_MERCHANT_ID", "NEXT_PUBLIC_PAYWAY_PUBLISHABLE_KEY");
  else required.push("PAYMENT_GATEWAY (onlinepay or payway)");

  const missing = required.filter(name => !env[name]);
  const errors = missing.length ? [`missing ${missing.join(", ")}`] : [];
  if (env.SENTRY_DSN) {
    const dsn = URL.canParse(env.SENTRY_DSN) ? new URL(env.SENTRY_DSN) : null;
    if (!dsn || dsn.protocol !== "https:" || !dsn.username || dsn.password || !/\/\d+$/.test(dsn.pathname)) {
      errors.push("SENTRY_DSN must be a valid HTTPS project DSN with a public key");
    }
  }
  if (env.UPSTASH_REDIS_REST_URL && !httpsOrigin(env.UPSTASH_REDIS_REST_URL)) {
    errors.push("UPSTASH_REDIS_REST_URL must be an HTTPS origin");
  }
  const appOrigin = httpsOrigin(env.NEXT_PUBLIC_APP_URL);
  if (!appOrigin) errors.push("NEXT_PUBLIC_APP_URL must be an HTTPS origin without credentials, path, or query");
  else if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(appOrigin).hostname) || new URL(appOrigin).hostname.endsWith(".localhost")) {
    errors.push("NEXT_PUBLIC_APP_URL must be a deployed origin reachable by payment providers");
  }
  for (const name of ["AUTH_URL", "NEXTAUTH_URL"]) {
    if (env[name] && httpsOrigin(env[name]) !== appOrigin) errors.push(`${name} must match NEXT_PUBLIC_APP_URL`);
  }
  for (const name of ["AUTH_SECRET", "CRON_SECRET"]) {
    if (env[name] && env[name]!.length < 32) errors.push(`${name} must have at least 32 characters`);
  }
  if (gateway === "onlinepay") {
    if (env.ONLINEPAY_RETURN_BASE_URL && httpsOrigin(env.ONLINEPAY_RETURN_BASE_URL) !== appOrigin) errors.push("ONLINEPAY_RETURN_BASE_URL must match the HTTPS app origin");
    if (env.ONLINEPAY_WEBHOOK_SECRET && env.ONLINEPAY_WEBHOOK_SECRET.length < 32) errors.push("ONLINEPAY_WEBHOOK_SECRET must have at least 32 characters");
    if (env.ONLINEPAY_MODE && !["test", "live"].includes(env.ONLINEPAY_MODE)) errors.push("ONLINEPAY_MODE must be test or live");
  }
  if (!env.NEXT_PUBLIC_PAYMENT_GATEWAY || gateway !== env.NEXT_PUBLIC_PAYMENT_GATEWAY) errors.push("PAYMENT_GATEWAY and NEXT_PUBLIC_PAYMENT_GATEWAY must both be set to the same gateway");
  return errors;
}
