import { devSetPlan, openBillingPortal } from "@/app/actions/billing";
import { SubmitButton } from "@/components/client-ui";
import { Pricing } from "@/components/pricing";
import { Notice, PageHeader, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/entitlements";
import { integrations, isDemoMode } from "@/lib/env";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata = { title: "Plans & billing" };

export default async function Billing({ searchParams }: PageProps<"/profile/billing">) {
  const user = await requireUser("/profile/billing");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const ent = await getEntitlements(user.id);
  const stripeReady = integrations().stripe;
  const devSwitch = !stripeReady && isDemoMode();
  const fmt = (d: Date | null) => d?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <>
      <PageHeader eyebrow="Plans & billing" title="Choose how you travel" subtitle={`You're on ${PLANS[ent.plan].name}${ent.via === "trip_pass" ? ` via a Trip Pass, valid until ${fmt(ent.periodEnd)}` : ent.via === "subscription" && ent.periodEnd ? ent.cancelAtPeriodEnd ? `. It ends on ${fmt(ent.periodEnd)}` : `, renewing ${fmt(ent.periodEnd)}` : ""}.`} actions={<LinkButton href="/profile" variant="ghost">Back to profile</LinkButton>} />
      <div className="mb-8 grid gap-3">
        {sp.success && <Notice tone="accent" title="Payment received">Your plan updates as soon as Stripe confirms it, usually within a few seconds. Refresh if it hasn&apos;t changed yet.</Notice>}
        {sp.canceled && <Notice title="Checkout canceled">No charge was made.</Notice>}
        {sp.dev && <Notice tone="warn" title="Plan changed with the development switcher">No payment took place.</Notice>}
        {sp.error && <Notice tone="warn" title="We couldn't start checkout">{sp.error === "not_configured" ? "Stripe isn't configured on this deployment." : sp.error === "not_allowed" ? "That action isn't available here." : "Please try again in a moment."}</Notice>}
        {!stripeReady && <Notice tone="warn" title="Stripe is not configured">Checkout buttons are disabled. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the price IDs to take payments.</Notice>}
        {stripeReady && ent.hasCustomer && (
          <Notice title="Manage your subscription" action={<form action={openBillingPortal}><SubmitButton variant="outline" size="sm">Manage billing</SubmitButton></form>}>Update your card, switch between monthly and annual, downgrade or cancel in the secure Stripe billing portal.</Notice>
        )}
      </div>
      <Pricing mode="billing" current={ent.plan} stripeReady={stripeReady} />
      {devSwitch && (
        <section className="mt-10 rounded-[1.25rem] border border-dashed border-warn p-5">
          <p className="text-sm font-semibold text-warn">Development only: plan switcher</p>
          <p className="mt-1 text-sm text-ink-soft">Stripe isn&apos;t connected, so use this to test what each plan unlocks. The server refuses this action whenever Stripe or Supabase is configured.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(PLANS) as PlanId[]).map((p) => (
              <form key={p} action={devSetPlan}><input type="hidden" name="plan" value={p} /><SubmitButton variant={ent.plan === p ? "dark" : "outline"} size="sm">{ent.plan === p ? "✓ " : ""}{PLANS[p].name}</SubmitButton></form>
            ))}
          </div>
        </section>
      )}
      <p className="mt-8 text-xs text-ink-faint">Payments are processed by Stripe. TripCraft never sees or stores your card details. Plan access is verified on the server for every request. If TripCraft ships as a native iOS or Android app, purchases there will follow the app stores&apos; in-app purchase rules.</p>
    </>
  );
}
