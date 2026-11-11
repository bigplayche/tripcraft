// Builds supabase/standalone-setup.sql: one file to paste into any plain Postgres SQL editor
// (for example Neon) when hosting TripCraft without Supabase. Run: npm run db:standalone-sql
import fs from "node:fs";
const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.endsWith(".supabase.sql")).sort();
const out = [
  "-- TripCraft database setup for plain Postgres (Neon and similar). GENERATED FILE: do not edit.",
  "-- Paste the whole file into your provider's SQL editor and run it once on an empty database.",
  "-- Not for Supabase projects: use the files in supabase/migrations there.",
  "",
  fs.readFileSync("src/lib/db/dev-shim.sql", "utf8"),
  "create table if not exists tripcraft_meta.migrations (name text primary key, applied_at timestamptz not null default now());",
  ...files.flatMap((f) => [`\n-- ===== ${f} =====`, fs.readFileSync(`${dir}/${f}`, "utf8"), `insert into tripcraft_meta.migrations (name) values ('${f}') on conflict do nothing;`]),
  "",
];
fs.writeFileSync("supabase/standalone-setup.sql", out.join("\n"));
console.log(`Wrote supabase/standalone-setup.sql (${files.join(", ")})`);
