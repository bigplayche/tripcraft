"use server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { asService } from "@/lib/db";
import { appUrl, integrations, isDemoMode } from "@/lib/env";
import { ensureCustomer, priceId, stripe, type PriceKey } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";

const KEYS = new Set<PriceKey>(["plus_month", "plus_year", "pro_month", "pro_year", "trip_pass"]);

export async function startCheckout(form: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/signup?next=/profile/billing");
  const key = String(form.get("price")) as PriceKey;
  if (!integrations().stripe || !KEYS.has(key) || !priceId(key)) redirect("/profile/billing?error=not_configured");
  if (!rateLimit(`checkout:${user.id}`, 8, 60_000).ok) redirect("/profile/billing?error=rate");
  const customer = await ensureCustomer(user.id, user.email);
  const [s] = await asService((q) => q("select stripe_subscription_id, status from subscriptions where user_id = $1", [user.id]));
  let url: string | null;
  if (key !== "trip_pass" && s?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(s.status)) {
    // Existing subscribers change plan (upgrade / downgrade / interval) in the billing portal.
    url = (await stripe().billingPortal.sessions.create({ customer, return_url: `${appUrl()}/profile/billing` })).url;
  } else {
    const session = await stripe().checkout.sessions.create({
      mode: key === "trip_pass" ? "payment" : "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: priceId(key)!, quantity: 1 }],
      metadata: { user_id: user.id, price_key: key },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/profile/billing?success=1`,
      cancel_url: `${appUrl()}/profile/billing?canceled=1`,
    });
    url = session.url;
  }
  redirect(url ?? "/profile/billing?error=stripe");
}

export async function openBillingPortal() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!integrations().stripe) redirect("/profile/billing?error=not_configured");
  const customer = await ensureCustomer(user.id, user.email);
  const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${appUrl()}/profile/billing` });
  redirect(portal.url);
}

/**
 * DEVELOPMENT ONLY. Lets you exercise plan gating without Stripe. Refused by the server whenever
 * Stripe is configured or a real Supabase project is in use, so it cannot grant paid access in production.
 */
export async function devSetPlan(form: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const plan = String(form.get("plan"));
  if (integrations().stripe || !isDemoMode() || !["free", "plus", "pro"].includes(plan)) redirect("/profile/billing?error=not_allowed");
  await asService((q) => q("update subscriptions set plan = $2, status = 'active', billing_interval = case when $2 = 'free' then null else 'month' end, current_period_end = null, updated_at = now() where user_id = $1", [user.id, plan]));
  redirect("/profile/billing?dev=1");
}
