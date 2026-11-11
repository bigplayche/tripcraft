"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode, appUrl } from "@/lib/env";
import { createSessionToken, DEV_COOKIE, devSignIn, devSignUp } from "@/lib/auth/dev";
import { supabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string; notice?: string; email?: string; name?: string } | null;

const Creds = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(8).max(200) });
const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/home");

async function throttle() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  return rateLimit(`auth:${ip}`, 10, 60_000).ok;
}

async function setDevSession(userId: string) {
  const { token, maxAge } = createSessionToken(userId);
  (await cookies()).set(DEV_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && appUrl().startsWith("https"), path: "/", maxAge });
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!(await throttle())) return { error: "Too many attempts. Please wait a minute." };
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  // React resets the form after an action, so echo the non-secret fields back.
  const echo = { email: String(form.get("email") ?? "").slice(0, 200), name };
  if (!parsed.success) return { ...echo, error: "Enter a valid email and a password of at least 8 characters." };
  if (isDemoMode()) {
    const r = await devSignUp(parsed.data.email, parsed.data.password, name);
    if ("error" in r) return { ...echo, error: r.error };
    await setDevSession(r.userId);
  } else {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { data: { full_name: name }, emailRedirectTo: `${appUrl()}/auth/callback` } });
    if (error) return { ...echo, error: error.message };
    if (!data.session) return { notice: "Check your inbox to confirm your email, then sign in." };
  }
  redirect(safeNext(form.get("next")) === "/home" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(safeNext(form.get("next")))}`);
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  if (!(await throttle())) return { error: "Too many attempts. Please wait a minute." };
  const parsed = Creds.safeParse({ email: form.get("email"), password: form.get("password") });
  const echo = { email: String(form.get("email") ?? "").slice(0, 200) };
  if (!parsed.success) return { ...echo, error: "Incorrect email or password." };
  if (isDemoMode()) {
    const r = await devSignIn(parsed.data.email, parsed.data.password);
    if ("error" in r) return { ...echo, error: r.error };
    await setDevSession(r.userId);
  } else {
    const { error } = await (await supabaseServer()).auth.signInWithPassword(parsed.data);
    if (error) return { ...echo, error: "Incorrect email or password." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  if (isDemoMode()) (await cookies()).delete(DEV_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  redirect("/");
}
