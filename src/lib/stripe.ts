import Stripe from "stripe";
import { asService } from "@/lib/db";
import type { PlanId } from "@/lib/plans";

let client: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export type PriceKey = "plus_month" | "plus_year" | "pro_month" | "pro_year" | "trip_pass";
export const PRICE_ENV: Record<PriceKey, string> = {
  plus_month: "STRIPE_PRICE_PLUS_MONTHLY", plus_year: "STRIPE_PRICE_PLUS_YEARLY",
  pro_month: "STRIPE_PRICE_PRO_MONTHLY", pro_year: "STRIPE_PRICE_PRO_YEARLY", trip_pass: "STRIPE_PRICE_TRIP_PASS",
};
export const priceId = (k: PriceKey) => process.env[PRICE_ENV[k]] || null;

function planForPrice(id: string | undefined): { plan: PlanId; interval: "month" | "year" } | null {
  for (const k of ["plus_month", "plus_year", "pro_month", "pro_year"] as const) {
    if (id && priceId(k) === id) return { plan: k.startsWith("plus") ? "plus" : "pro", interval: k.endsWith("year") ? "year" : "month" };
  }
  return null;
}

export async function ensureCustomer(userId: string, email: string) {
  const [s] = await asService((q) => q("select stripe_customer_id from subscriptions where user_id = $1", [userId]));
  if (s?.stripe_customer_id) return s.stripe_customer_id as string;
  const c = await stripe().customers.create({ email, metadata: { user_id: userId } });
  await asService((q) => q("insert into subscriptions (user_id, stripe_customer_id) values ($1,$2) on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id", [userId, c.id]));
  return c.id;
}

/** Mirrors a Stripe subscription into our subscriptions table. The only writer of plan state. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const mapped = planForPrice(item?.price.id);
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  // current_period_end lives on the item in recent API versions and on the subscription in older ones.
  const end = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const rows = await asService((q) =>
    q(
      `update subscriptions set plan = $2, billing_interval = $3, status = $4, stripe_subscription_id = $5,
         current_period_end = $6, cancel_at_period_end = $7, updated_at = now()
       where stripe_customer_id = $1 returning user_id`,
      [customer, live && mapped ? mapped.plan : "free", mapped?.interval ?? null, sub.status, sub.id, end ? new Date(end * 1000) : null, !!sub.cancel_at_period_end],
    ),
  );
  if (!rows.length) console.warn(JSON.stringify({ evt: "stripe_sync_no_customer", customer }));
  else console.info(JSON.stringify({ evt: "subscription_synced", userId: rows[0].user_id, status: sub.status, plan: mapped?.plan ?? "free" }));
}
