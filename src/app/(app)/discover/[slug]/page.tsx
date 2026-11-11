import { notFound } from "next/navigation";
import { CalendarHeart, Sun, Wallet } from "lucide-react";
import { DestinationImage } from "@/components/destination-image";
import { TripForm } from "@/components/trip-form";
import { Badge, SectionTitle, SourceNote } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { getPrefs } from "@/lib/data";
import { CATALOG_REVIEWED, DESTINATIONS } from "@/lib/catalog";
import { money } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/discover/[slug]">) {
  const { slug } = await params;
  return { title: DESTINATIONS.find((d) => d.slug === slug)?.name ?? "Destination" };
}

export default async function DestinationPage({ params }: PageProps<"/discover/[slug]">) {
  const { slug } = await params;
  const d = DESTINATIONS.find((x) => x.slug === slug);
  if (!d) notFound();
  const user = await requireUser(`/discover/${slug}`);
  const [prefs] = await Promise.all([
    getPrefs(user.id),
    withUser(user.id, (q) => q("insert into destination_views (user_id, slug) values ($1,$2) on conflict (user_id, slug) do update set viewed_at = now()", [user.id, slug])),
  ]);
  return (
    <>
      <div className="relative -mx-4 -mt-6 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[1.5rem]">
        <DestinationImage src={`/destinations/${d.slug}.jpg`} name={d.name} art={d.art} className="h-64 sm:h-96" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <p className="text-sm text-white/80">{d.country}</p>
          <h1 className="display text-4xl sm:text-6xl">{d.name}</h1>
          <p className="mt-2 max-w-xl text-white/90">{d.tagline}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <p className="text-lg text-ink-soft">{d.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">{d.styles.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}</div>

          <section className="mt-10">
            <SectionTitle title="Popular attractions" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.places.map((p) => (
                <li key={p.name} className="card p-4">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-ink-soft">{p.category} · {p.cost == null ? "cost varies" : p.cost === 0 ? "free" : `~${money(p.cost)} pp`}</p>
                  <p className="mt-1.5 text-sm text-ink-soft">{p.description}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-10">
            <SectionTitle title="Where to eat" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.food.map((f) => (
                <li key={f.name} className="card p-4"><p className="font-semibold">{f.name}</p><p className="text-xs text-ink-soft">{f.cuisine} · {"$".repeat(f.price)}</p><p className="mt-1.5 text-sm text-ink-soft">{f.description}</p></li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <div className="card grid gap-4 p-5 text-sm">
            <div className="flex gap-3"><CalendarHeart className="h-5 w-5 shrink-0 text-accent" /><div><p className="font-semibold">Best time to go</p><p className="text-ink-soft">{d.bestSeason}</p></div></div>
            <div className="flex gap-3"><Sun className="h-5 w-5 shrink-0 text-accent" /><div><p className="font-semibold">Climate</p><p className="capitalize text-ink-soft">{d.weather} · suggested stay {d.suggestedNights} nights</p></div></div>
            <div className="flex gap-3"><Wallet className="h-5 w-5 shrink-0 text-accent" /><div><p className="font-semibold">Typical daily spend per person</p><p className="text-ink-soft">Budget ~{money(d.dailyCost.budget)} · Mid ~{money(d.dailyCost.mid)} · Luxury ~{money(d.dailyCost.luxury)}</p><p className="text-xs text-ink-faint">Food, transport and activities. Excludes stay and flights.</p></div></div>
          </div>
          <SourceNote>Editorial catalogue data, last reviewed {CATALOG_REVIEWED}. Estimates only: confirm prices, opening hours and availability with each provider.</SourceNote>
        </aside>
      </div>

      <section className="mt-12">
        <SectionTitle title={`Plan your trip to ${d.name.split(",")[0]}`} />
        <TripForm authed defaults={{ destination: d.name, origin: prefs?.home_city, budget: prefs?.typical_budget }} />
      </section>
    </>
  );
}
