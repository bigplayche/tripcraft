import type Stripe from "stripe";
import { asService } from "@/lib/db";
import { integrations } from "@/lib/env";
import { stripe, syncSubscription } from "@/lib/stripe";
import { TRIP_PASS } from "@/lib/plans";

export const runtime = "nodejs";

/** Stripe is the source of truth for plans. Signature is verified against the raw body; events are idempotent. */
export async function POST(req: Request) {
  if (!integrations().stripe) return Response.json({ error: "Stripe is not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    console.warn(JSON.stringify({ evt: "stripe_webhook_bad_signature" }));
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const fresh = await asService((q) => q("insert into stripe_events (id, type) values ($1,$2) on conflict (id) do nothing returning id", [event.id, event.type]));
  if (!fresh.length) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.client_reference_id ?? s.metadata?.user_id;
        const customer = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (userId && customer) await asService((q) => q("update subscriptions set stripe_customer_id = $2 where user_id = $1 and stripe_customer_id is null", [userId, customer]));
        if (s.mode === "payment" && s.payment_status === "paid" && s.metadata?.price_key === "trip_pass" && userId) {
          await asService((q) => q(`update subscriptions set trip_pass_expires_at = greatest(coalesce(trip_pass_expires_at, now()), now()) + ($2 || ' days')::interval, updated_at = now() where user_id = $1`, [userId, String(TRIP_PASS.days)]));
        } else if (s.mode === "subscription" && s.subscription) {
          await syncSubscription(await stripe().subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    // Let Stripe retry: forget the event id so the retry is processed.
    await asService((q) => q("delete from stripe_events where id = $1", [event.id]));
    console.error(JSON.stringify({ evt: "stripe_webhook_error", type: event.type, message: String(e) }));
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return Response.json({ received: true });
}
