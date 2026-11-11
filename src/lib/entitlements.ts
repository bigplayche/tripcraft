/** Server-side entitlement checks. The client never decides what a plan allows. */
import { asService } from "@/lib/db";
import { PLANS, type PlanId, type PlanLimits } from "@/lib/plans";
import { integrations } from "@/lib/env";

export type Entitlements = { plan: PlanId; limits: PlanLimits; via: "subscription" | "trip_pass" | "free"; periodEnd: Date | null; cancelAtPeriodEnd: boolean; interval: string | null; hasCustomer: boolean };

export class LimitError extends Error {
  code = "upgrade_required" as const;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const [s] = await asService((q) => q("select * from subscriptions where user_id = $1", [userId]));
  // While payments are switched off (no Stripe), the operator can choose what everyone gets,
  // e.g. FREE_ACCESS_PLAN=pro to run the whole app free of charge. Ignored once Stripe is configured.
  const gift = process.env.FREE_ACCESS_PLAN;
  let plan: PlanId = !integrations().stripe && (gift === "plus" || gift === "pro") ? gift : "free";
  let via: Entitlements["via"] = "free";
  if (s && s.plan !== "free" && ACTIVE.has(s.status) && (!s.current_period_end || new Date(s.current_period_end) > new Date())) {
    plan = s.plan;
    via = "subscription";
  } else if (s?.trip_pass_expires_at && new Date(s.trip_pass_expires_at) > new Date()) {
    plan = "plus";
    via = "trip_pass";
  }
  return {
    plan,
    via,
    limits: PLANS[plan].limits,
    periodEnd: via === "trip_pass" ? new Date(s.trip_pass_expires_at) : s?.current_period_end ? new Date(s.current_period_end) : null,
    cancelAtPeriodEnd: !!s?.cancel_at_period_end,
    interval: s?.billing_interval ?? null,
    hasCustomer: !!s?.stripe_customer_id,
  };
}

export type UsageKind = "trip_generation" | "day_regen" | "concierge" | "discover" | "budget";

export async function usageThisMonth(userId: string) {
  const rows = await asService((q) =>
    q<{ kind: string; n: number; cost: number }>(
      "select kind, count(*)::int as n, coalesce(sum(est_cost_usd), 0)::float8 as cost from ai_usage where user_id = $1 and created_at >= date_trunc('month', now()) group by kind",
      [userId],
    ),
  );
  const by = Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Record<string, number>;
  return {
    generations: (by.trip_generation ?? 0) + (by.day_regen ?? 0),
    concierge: by.concierge ?? 0,
    other: (by.discover ?? 0) + (by.budget ?? 0),
    estCostUsd: rows.reduce((a, r) => a + r.cost, 0),
  };
}

/** Throws LimitError when the user's plan has no AI quota left for this kind of request. */
export async function assertAiQuota(userId: string, kind: UsageKind) {
  const [ent, used] = await Promise.all([getEntitlements(userId), usageThisMonth(userId)]);
  const name = PLANS[ent.plan].name;
  if (kind === "concierge" && used.concierge >= ent.limits.conciergePerMonth)
    throw new LimitError(`You've used all ${ent.limits.conciergePerMonth} concierge messages on ${name} this month.`);
  if ((kind === "trip_generation" || kind === "day_regen") && used.generations >= ent.limits.generationsPerMonth)
    throw new LimitError(`You've used all ${ent.limits.generationsPerMonth} itinerary generations on ${name} this month.`);
  if ((kind === "discover" || kind === "budget") && used.other >= ent.limits.generationsPerMonth * 3)
    throw new LimitError(`You've reached this month's AI limit on ${name}.`);
  return ent;
}

// USD per 1M tokens; override to match your model. Used for cost monitoring only.
const PRICE_IN = Number(process.env.AI_PRICE_INPUT_PER_MTOK || 0.25);
const PRICE_OUT = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK || 2);

export async function recordUsage(userId: string, kind: UsageKind, model: string, inputTokens = 0, outputTokens = 0) {
  const cost = (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
  await asService((q) =>
    q("insert into ai_usage (user_id, kind, model, input_tokens, output_tokens, est_cost_usd) values ($1,$2,$3,$4,$5,$6)", [userId, kind, model, inputTokens, outputTokens, cost]),
  );
  console.info(JSON.stringify({ evt: "ai_usage", userId, kind, model, inputTokens, outputTokens, estCostUsd: Number(cost.toFixed(5)) }));
}
