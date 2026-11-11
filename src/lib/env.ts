/** Which external integrations are configured. Read at call time so tests can toggle env. */
export function integrations() {
  const e = process.env;
  return {
    supabase: !!(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    database: !!e.DATABASE_URL,
    openai: !!e.OPENAI_API_KEY,
    googleServer: !!e.GOOGLE_MAPS_API_KEY,
    googleBrowser: !!e.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    stripe: !!(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET),
    osrm: e.OSRM_URL !== "off",
    weather: e.WEATHER_PROVIDER !== "off",
  };
}

/**
 * Without a Supabase project the app uses its own email/password sign-in and stores uploaded
 * files in the database. This is true both in local demo mode and when self-hosting on any
 * plain Postgres (for example Neon).
 */
export function usesBuiltInAuth() {
  return !integrations().supabase;
}

/** Demo mode = nothing configured at all: embedded database on local disk. Development only. */
export function isDemoMode() {
  return !integrations().supabase && !integrations().database;
}

export function appUrl() {
  // On Vercel the production domain is provided automatically, so NEXT_PUBLIC_APP_URL is optional there.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}
