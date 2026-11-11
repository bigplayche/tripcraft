/**
 * Data access. One SQL code path, two drivers:
 *   - DATABASE_URL set  -> postgres.js (Supabase Postgres in production)
 *   - otherwise         -> PGlite, an embedded Postgres persisted in ./.data (development fallback)
 *
 * Every user-scoped query runs inside a transaction as the `authenticated` role with
 * `request.jwt.claims` set, exactly like a Supabase client request, so the Row Level
 * Security policies in supabase/migrations are enforced for all app queries.
 */
import fs from "node:fs";
import path from "node:path";

export type Row = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Q = <T = any>(text: string, params?: unknown[]) => Promise<T[]>;

interface Driver {
  tx<T>(setup: string[] | null, claims: string | null, fn: (q: Q) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
}

const g = globalThis as unknown as { __tcDriver?: Promise<Driver> };

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function listMigrations(includeSupabaseOnly: boolean) {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && (includeSupabaseOnly || !f.endsWith(".supabase.sql")))
    .sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8") }));
}

export function devShimSql() {
  return fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "dev-shim.sql"), "utf8");
}

export async function applyMigrations(d: Pick<Driver, "exec" | "tx">, opts: { shim: boolean; supabaseOnly: boolean }) {
  await d.exec(
    "create schema if not exists tripcraft_meta; create table if not exists tripcraft_meta.migrations (name text primary key, applied_at timestamptz not null default now());",
  );
  const done = new Set((await d.tx(null, null, (q) => q<{ name: string }>("select name from tripcraft_meta.migrations"))).map((r) => r.name));
  if (opts.shim) await d.exec(devShimSql());
  const applied: string[] = [];
  for (const m of listMigrations(opts.supabaseOnly)) {
    if (done.has(m.name)) continue;
    await d.exec(`begin; ${m.sql}; insert into tripcraft_meta.migrations (name) values ('${m.name}'); commit;`);
    applied.push(m.name);
  }
  return applied;
}

async function pgliteDriver(): Promise<Driver> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const parsers = { [types.NUMERIC]: (v: string) => parseFloat(v), [types.DATE]: (v: string) => v };
  const db = new PGlite(dir === "memory" ? undefined : dir);
  await db.waitReady;
  const driver: Driver = {
    exec: async (sql) => {
      await db.exec(sql);
    },
    tx: (setup, claims, fn) =>
      db.transaction(async (tx) => {
        for (const s of setup ?? []) await tx.exec(s);
        if (claims) await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
        return fn(async (text, params) => (await tx.query(text, params as unknown[], { parsers })).rows as never[]);
      }) as Promise<never>,
  };
  await applyMigrations(driver, { shim: true, supabaseOnly: false });
  return driver;
}

async function postgresDriver(url: string): Promise<Driver> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    prepare: false, // required for Supabase's transaction pooler
    onnotice: () => {},
    types: {
      numeric: { to: 1700, from: [1700], serialize: (v: number) => String(v), parse: (v: string) => parseFloat(v) },
      date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v },
    },
  });
  return {
    exec: async (text) => {
      await sql.unsafe(text);
    },
    tx: (setup, claims, fn) =>
      sql.begin(async (tx) => {
        for (const s of setup ?? []) await tx.unsafe(s);
        if (claims) await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [claims]);
        return fn(async (text, params) => (await tx.unsafe(text, (params ?? []) as never[])) as never);
      }) as Promise<never>,
  };
}

export function driver(): Promise<Driver> {
  if (!g.__tcDriver) {
    const url = process.env.DATABASE_URL;
    g.__tcDriver = (url ? postgresDriver(url) : pgliteDriver()).catch((e) => {
      g.__tcDriver = undefined;
      throw e;
    });
  }
  return g.__tcDriver;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Run queries as a signed-in user. RLS applies. */
export async function withUser<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  if (!isUuid(userId)) throw new Error("withUser: invalid user id");
  const d = await driver();
  return d.tx(["set local role authenticated"], JSON.stringify({ sub: userId, role: "authenticated" }), fn);
}

/** Run queries with the server's own privileges (bypasses RLS). Webhooks, metering, auth only. */
export async function asService<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const d = await driver();
  return d.tx(null, null, fn);
}

export const j = (v: unknown) => JSON.stringify(v ?? null);
