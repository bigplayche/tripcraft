"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, TRIP_PASS, type PlanId } from "@/lib/plans";
import { startCheckout } from "@/app/actions/billing";
import { buttonClass, Badge } from "./ui";
import { SubmitButton } from "./client-ui";
import { cn } from "@/lib/utils";

/** mode "marketing": CTAs lead to signup. mode "billing": CTAs start Stripe Checkout (server-verified). */
export function Pricing({ mode, current, stripeReady = true }: { mode: "marketing" | "billing"; current?: PlanId; stripeReady?: boolean }) {
  const [yearly, setYearly] = useState(true);
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm" role="tablist" aria-label="Billing interval">
          {[false, true].map((y) => (
            <button key={String(y)} role="tab" aria-selected={yearly === y} onClick={() => setYearly(y)} className={cn("rounded-full px-4 py-1.5 font-medium transition-colors", yearly === y ? "bg-ink text-bg" : "text-ink-soft")}>
              {y ? "Annual" : "Monthly"}
              {y && <span className={cn("ml-1.5 text-xs", yearly ? "text-bg/70" : "text-accent")}>save ~37%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id], featured = id === "plus", isCurrent = current === id;
          const price = id === "free" ? "$0" : yearly ? `$${(p.yearly / 12).toFixed(2)}` : `$${p.monthly}`;
          return (
            <div key={id} className={cn("card relative flex flex-col p-7", featured && "border-accent shadow-float ring-1 ring-accent")}>
              {featured && <Badge tone="accent" className="absolute -top-3 left-7 bg-accent text-on-accent">Most popular</Badge>}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="text-sm text-ink-soft">{p.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="display text-4xl">{price}</span>
                <span className="text-sm text-ink-soft">{id === "free" ? "forever" : "/ month"}</span>
              </p>
              <p className="mt-1 h-5 text-xs text-ink-faint">{id !== "free" && (yearly ? `$${p.yearly} billed annually` : "Billed monthly, cancel any time")}</p>
              <ul className="my-6 grid flex-1 content-start gap-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              {mode === "marketing" ? (
                <Link href="/signup" className={buttonClass({ variant: featured ? "primary" : "outline" }, "w-full")}>{id === "free" ? "Start free" : `Get ${p.name}`}</Link>
              ) : isCurrent ? (
                <span className={buttonClass({ variant: "outline" }, "pointer-events-none w-full opacity-70")}>Current plan</span>
              ) : id === "free" ? (
                <span className="text-center text-xs text-ink-faint">Downgrade or cancel from “Manage billing”.</span>
              ) : (
                <form action={startCheckout}>
                  <input type="hidden" name="price" value={`${id}_${yearly ? "year" : "month"}`} />
                  <SubmitButton variant={featured ? "primary" : "outline"} className={cn("w-full", !stripeReady && "pointer-events-none opacity-50")}>
                    {current && current !== "free" ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <div className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h3 className="font-semibold">{TRIP_PASS.name} · ${TRIP_PASS.price} one-time</h3>
          <p className="text-sm text-ink-soft">Not a frequent traveler? Get every Traveler Plus feature for {TRIP_PASS.days} days. No subscription.</p>
        </div>
        {mode === "marketing" ? (
          <Link href="/signup" className={buttonClass({ variant: "outline" })}>Get a Trip Pass</Link>
        ) : (
          <form action={startCheckout}>
            <input type="hidden" name="price" value="trip_pass" />
            <SubmitButton variant="outline" className={cn(!stripeReady && "pointer-events-none opacity-50")}>Buy Trip Pass</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
