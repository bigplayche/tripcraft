/**
 * Apply supabase/migrations/*.sql to DATABASE_URL.
 *   npm run db:migrate              -> Supabase / production Postgres (includes storage policies)
 *   npm run db:migrate -- --local   -> plain local Postgres (adds the auth shim, skips Supabase-only files)
 */
import postgres from "postgres";
import { applyMigrations } from "../src/lib/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = process.argv.includes("--local");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const applied = await applyMigrations(
    {
      exec: async (t) => void (await sql.unsafe(t)),
      tx: (_s, _c, fn) => fn(async (t, p) => (await sql.unsafe(t, (p ?? []) as never[])) as never),
    },
    { shim: local, supabaseOnly: !local },
  );
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
