import Link from "next/link";
import { Luggage } from "lucide-react";
import { TripForm } from "@/components/trip-form";
import { DestinationCard } from "@/components/destination-card";
import { TripCard } from "@/components/trip-card";
import { EmptyState, SectionTitle, LinkButton } from "@/components/ui";
import { displayName, requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { getPrefs, listTrips } from "@/lib/data";
import { DESTINATIONS, type Destination } from "@/lib/catalog";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "Home" };

function Row({ title, hint, items }: { title: string; hint?: string; items: Destination[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <SectionTitle title={title} hint={hint} action={<Link href="/discover" className="shrink-0 text-sm font-medium text-accent hover:underline">See all</Link>} />
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {items.slice(0, 4).map((d) => (
          <DestinationCard key={d.slug} d={d} className="w-64 snap-start lg:w-auto" />
        ))}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: PageProps<"/home">) {
  const user = await requireUser();
  const sp = (await searchParams) as { destination?: string };
  const [prefs, trips, views] = await Promise.all([
    getPrefs(user.id),
    listTrips(user.id),
    withUser(user.id, (q) => q<{ slug: string }>("select slug from destination_views where user_id = $1 order by viewed_at desc limit 4", [user.id])),
  ]);
  const today = todayISO();
  const upcoming = trips.filter((t) => t.end_date >= today && t.status !== "archived");
  const saved = trips.filter((t) => t.is_favorite);
  const styles = new Set(prefs?.vacation_styles ?? []);
  const recommended = [...DESTINATIONS].map((d) => ({ d, s: d.styles.filter((x) => styles.has(x)).length })).sort((a, b) => b.s - a.s).map((x) => x.d);
  const recent = views.map((v) => DESTINATIONS.find((d) => d.slug === v.slug)).filter(Boolean) as Destination[];

  return (
    <>
      <section>
        <p className="eyebrow mb-2">Hi {displayName(user).split(" ")[0]}</p>
        <h1 className="display text-4xl sm:text-5xl">Where would you like to go next?</h1>
        <div className="mt-7">
          <TripForm authed defaults={{ origin: prefs?.home_city, budget: prefs?.typical_budget, destination: sp.destination?.slice(0, 120) }} />
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Not sure where to go?{" "}
          <Link href="/discover#surprise" className="font-semibold text-accent hover:underline">Let TripCraft surprise you</Link>
        </p>
      </section>

      <section className="mt-14">
        <SectionTitle title="Upcoming trips" action={trips.length > 0 && <Link href="/trips" className="text-sm font-medium text-accent hover:underline">All trips</Link>} />
        {upcoming.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.slice(0, 3).map((t) => <TripCard key={t.id} trip={t} />)}</div>
        ) : (
          <EmptyState icon={<Luggage className="h-5 w-5" />} title="No trips yet" body="Fill in the form above and TripCraft will build your first itinerary." />
        )}
      </section>

      {saved.length > 0 && (
        <section className="mt-14">
          <SectionTitle title="Saved trips" hint="Trips you've starred" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{saved.slice(0, 3).map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </section>
      )}

      <Row title="Recommended for you" hint={styles.size ? "Based on the travel styles in your profile" : "Add travel styles in your profile to personalise these"} items={recommended} />
      <Row title="Popular destinations" items={DESTINATIONS.filter((d) => d.popular)} />
      <Row title="Trending vacation ideas" items={DESTINATIONS.filter((d) => d.trending)} />
      <Row title="Recently viewed" items={recent} />

      <div className="mt-14 flex justify-center">
        <LinkButton href="/discover" variant="outline">Explore all destinations</LinkButton>
      </div>
    </>
  );
}
