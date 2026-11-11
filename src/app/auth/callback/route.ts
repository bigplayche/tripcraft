import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { withUser } from "@/lib/db";

/** OAuth (Google / Apple) and email-confirmation return URL for Supabase Auth. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const dest = next?.startsWith("/") && !next.startsWith("//") ? next : "/home";
  if (isDemoMode() || !code) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  const [u] = await withUser(data.user.id, (q) => q("select onboarded_at from users where id = $1", [data.user!.id]));
  return NextResponse.redirect(new URL(u?.onboarded_at ? dest : `/onboarding?next=${encodeURIComponent(dest)}`, url.origin));
}
