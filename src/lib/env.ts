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

/** Demo mode = no Supabase project: local embedded Postgres + local email/password auth. */
export function isDemoMode() {
  return !integrations().supabase;
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
