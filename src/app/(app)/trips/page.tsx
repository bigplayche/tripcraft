import { Luggage } from "lucide-react";
import { TripCard } from "@/components/trip-card";
import { EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listTrips } from "@/lib/data";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { todayISO } from "@/lib/utils";

export const metadata = { title: "My Trips" };

export default async function Trips() {
  const user = await requireUser();
  const [trips, ent] = await Promise.all([listTrips(user.id), getEntitlements(user.id)]);
  const today = todayISO();
  const groups = [
    { title: "Happening now", items: trips.filter((t) => t.start_date <= today && t.end_date >= today && t.status !== "archived") },
    { title: "Upcoming", items: trips.filter((t) => t.start_date > today && t.status !== "archived") },
    { title: "Past & archived", items: trips.filter((t) => t.end_date < today || t.status === "archived") },
  ];
  return (
    <>
      <PageHeader eyebrow="My Trips" title="Every trip, in one place" subtitle={`${PLANS[ent.plan].name}: ${ent.limits.activeTrips === 1 ? "one active trip" : `up to ${ent.limits.activeTrips} active trips`}.`} actions={<LinkButton href="/home">Plan a new trip</LinkButton>} />
      {trips.length === 0 && <EmptyState icon={<Luggage className="h-5 w-5" />} title="No trips yet" body="Tell TripCraft where and when, and get a full itinerary in minutes." action={<LinkButton href="/home">Build my vacation</LinkButton>} />}
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.title} className="mb-12">
          <SectionTitle title={g.title} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{g.items.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </section>
      ))}
    </>
  );
}
