"use server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { withUser, j } from "@/lib/db";

const list = (v: FormDataEntryValue | null) => {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, 20).map((s: string) => s.slice(0, 60)) : [];
  } catch {
    return [];
  }
};
const level = (v: FormDataEntryValue | null) => Math.min(4, Math.max(0, Math.round(Number(v ?? 2)) || 0));

export async function savePreferences(form: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const budget = Number(form.get("typical_budget"));
  const name = String(form.get("full_name") ?? "").trim().slice(0, 80);
  await withUser(user.id, async (q) => {
    await q(
      `update user_preferences set home_city = $2, preferred_destinations = $3::jsonb, typical_budget = $4, vacation_styles = $5::jsonb, hotel_category = $6,
         food_preferences = $7::jsonb, nightlife_interest = $8, adventure_interest = $9, relaxation_interest = $10, activities = $11::jsonb where user_id = $1`,
      [user.id, String(form.get("home_city") ?? "").trim().slice(0, 120) || null, j(String(form.get("preferred_destinations") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12)), Number.isFinite(budget) && budget > 0 ? budget : null, j(list(form.get("vacation_styles"))), list(form.get("hotel_category"))[0] ?? null, j(list(form.get("food_preferences"))), level(form.get("nightlife_interest")), level(form.get("adventure_interest")), level(form.get("relaxation_interest")), j(list(form.get("activities")))],
    );
    await q("update users set onboarded_at = coalesce(onboarded_at, now()), full_name = coalesce(nullif($2, ''), full_name) where id = $1", [user.id, name]);
  });
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : form.get("from") === "profile" ? "/profile?saved=1" : "/home");
}

export async function skipOnboarding(form: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await withUser(user.id, (q) => q("update users set onboarded_at = coalesce(onboarded_at, now()) where id = $1", [user.id]));
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/home");
}
