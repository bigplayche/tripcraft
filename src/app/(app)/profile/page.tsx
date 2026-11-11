import Link from "next/link";
import { Bookmark, CheckCircle2, CircleDashed, Trash2 } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { savePreferences } from "@/app/actions/profile";
import { BasicsFields, TasteFields } from "@/components/preferences-fields";
import { SubmitButton } from "@/components/client-ui";
import { RemoveSaved } from "@/components/remove-saved";
import { Button, LinkButton, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { getPrefs } from "@/lib/data";
import { getEntitlements, usageThisMonth } from "@/lib/entitlements";
import { integrations, isDemoMode } from "@/lib/env";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Profile" };

export default async function Profile({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();
  const sp = (await searchParams) as { saved?: string };
  const [prefs, ent, usage, saved] = await Promise.all([
    getPrefs(user.id), getEntitlements(user.id), usageThisMonth(user.id),
    withUser(user.id, (q) => q<{ id: string; name: string; kind: string | null; note: string | null }>("select id, name, kind, note from saved_places where user_id = $1 order by created_at desc limit 30", [user.id])),
  ]);
  const i = integrations();
  const rows: [string, boolean, string][] = [
    ["Supabase (auth, database, storage)", i.supabase, "Local embedded database and email/password sign-in"],
    ["OpenAI (itineraries, concierge, discovery)", i.openai, "Sample planner from the curated catalogue; rule-based concierge"],
    ["Google Places & Routes (verified places, travel times)", i.googleServer, "Unverified locations; driving times via OSRM where reachable"],
    ["Google Maps display", i.googleBrowser, "OpenStreetMap map"],
    ["Stripe (subscriptions)", i.stripe, "Checkout disabled; development plan switcher"],
  ];
  return (
    <>
      <PageHeader eyebrow="Profile" title={user.full_name || "Your profile"} subtitle={user.email} actions={<form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form>} />
      {sp.saved && <div className="mb-6"><Notice tone="accent" title="Preferences saved">TripCraft will use them for your next itinerary.</Notice></div>}

      <section className="card mb-10 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-ink-soft">Your plan</p>
          <p className="display text-2xl">{PLANS[ent.plan].name}{ent.via === "trip_pass" && " (Trip Pass)"}</p>
          <p className="mt-1 text-sm text-ink-soft">This month: {usage.generations} of {ent.limits.generationsPerMonth} itinerary generations · {usage.concierge} of {ent.limits.conciergePerMonth} concierge messages</p>
        </div>
        <LinkButton href="/profile/billing" variant={ent.plan === "free" ? "primary" : "outline"}>{ent.plan === "free" ? "Upgrade" : "Manage plan"}</LinkButton>
      </section>

      <form action={savePreferences} className="grid gap-10">
        <input type="hidden" name="from" value="profile" />
        <section><SectionTitle title="Travel preferences" hint="Used to personalise every itinerary and concierge answer." /><div className="card p-5 sm:p-7"><BasicsFields prefs={prefs} name={user.full_name} /></div></section>
        <section><SectionTitle title="Tastes & interests" /><div className="card p-5 sm:p-7"><TasteFields prefs={prefs} /></div></section>
        <div><SubmitButton>Save preferences</SubmitButton></div>
      </form>

      <section className="mt-14">
        <SectionTitle title="Saved places" hint="Places you bookmarked from recommendations and the concierge." />
        {saved.length === 0 ? <p className="rounded-[1.25rem] border border-dashed border-line px-5 py-6 text-sm text-ink-soft">Nothing saved yet. Use the bookmark icon on any recommendation.</p> : (
          <ul className="card divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-4"><Bookmark className="h-4 w-4 shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.name}</p><p className="truncate text-xs capitalize text-ink-soft">{s.kind}{s.note ? ` · ${s.note}` : ""}</p></div><RemoveSaved id={s.id}><Trash2 className="h-4 w-4" /></RemoveSaved></li>
            ))}
          </ul>
        )}
      </section>

      <section id="integrations" className="mt-14 scroll-mt-24">
        <SectionTitle title="Integration status" hint={isDemoMode() ? "This deployment is running in demo mode." : "Live services connected to this deployment."} />
        <ul className="card divide-y divide-line">
          {rows.map(([name, on, fallback]) => (
            <li key={name} className="flex items-start gap-3 p-4 text-sm">{on ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}<div><p className="font-medium">{name}</p><p className="text-ink-soft">{on ? "Connected" : `Not configured. Fallback: ${fallback}.`}</p></div></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-faint">Configure these with environment variables. See the README. <Link href="/api/health" className="underline">Health check</Link></p>
      </section>
    </>
  );
}
