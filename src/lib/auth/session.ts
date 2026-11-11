import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usesBuiltInAuth } from "@/lib/env";
import { withUser } from "@/lib/db";
import { DEV_COOKIE, verifySessionToken } from "./dev";
import { supabaseServer } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string; full_name: string | null; onboarded: boolean };

/** The signed-in user for this request, verified server-side. Never trust client-supplied ids. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  let id: string | null = null;
  if (usesBuiltInAuth()) {
    id = verifySessionToken((await cookies()).get(DEV_COOKIE)?.value);
  } else {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    id = data.user?.id ?? null;
  }
  if (!id) return null;
  const rows = await withUser(id, (q) =>
    q<{ id: string; email: string; full_name: string | null; onboarded_at: Date | null }>(
      "select id, email, full_name, onboarded_at from users where id = $1",
      [id],
    ),
  );
  const u = rows[0];
  return u ? { id: u.id, email: u.email, full_name: u.full_name, onboarded: !!u.onboarded_at } : null;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export const displayName = (u: { full_name?: string | null; email: string }) => u.full_name?.trim() || u.email.split("@")[0];
