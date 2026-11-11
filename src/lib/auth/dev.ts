/**
 * Demo-mode authentication (used only when Supabase is not configured).
 * Email + password, scrypt hashes in the local auth.users shim table, HMAC-signed session cookie.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { asService } from "@/lib/db";

export const DEV_COOKIE = "tc_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Hosted without Supabase: derive a stable secret from the database URL (which contains the
  // database password), so every serverless instance signs sessions identically.
  if (process.env.DATABASE_URL) return crypto.createHash("sha256").update(`tripcraft-session:${process.env.DATABASE_URL}`).digest("hex");
  const file = path.join(process.cwd(), ".data", "session-secret");
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    const s = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

const sign = (payload: string) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(userId: string) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: MAX_AGE };
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig) return null;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return userId;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return candidate.length === known.length && crypto.timingSafeEqual(candidate, known);
}

export async function devSignUp(email: string, password: string, fullName: string) {
  return asService(async (q) => {
    const existing = await q("select 1 from auth.users where email = $1", [email]);
    if (existing.length) return { error: "An account with this email already exists." as const };
    const [u] = await q<{ id: string }>(
      "insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3::jsonb) returning id",
      [email, hashPassword(password), JSON.stringify({ full_name: fullName })],
    );
    return { userId: u.id };
  });
}

export async function devSignIn(email: string, password: string) {
  const rows = await asService((q) =>
    q<{ id: string; encrypted_password: string }>("select id, encrypted_password from auth.users where email = $1", [email]),
  );
  const u = rows[0];
  // Hash even when the user is unknown so timing doesn't reveal which emails exist.
  const ok = checkPassword(password, u?.encrypted_password ?? hashPassword("x"));
  return u && ok ? { userId: u.id } : { error: "Incorrect email or password." as const };
}
