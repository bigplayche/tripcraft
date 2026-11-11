import { Users } from "lucide-react";
import { TripCard } from "@/components/trip-card";
import { EmptyState, LinkButton, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { listTrips } from "@/lib/data";
import { getEntitlements } from "@/lib/entitlements";

export const metadata = { title: "Group Trips" };

export default async function GroupTrips() {
  const user = await requireUser();
  const [trips, ent] = await Promise.all([listTrips(user.id), getEntitlements(user.id)]);
  const active = trips.filter((t) => t.status !== "archived");
  const shared = active.filter((t) => (t.member_count ?? 1) > 1);
  const solo = active.filter((t) => (t.member_count ?? 1) === 1 && t.role === "owner");
  return (
    <>
      <PageHeader eyebrow="Group Trips" title="Plan together" subtitle="Invite friends and family to vote on plans, comment, suggest places and split expenses." />
      {ent.limits.groupTrips === 0 && (
        <div className="mb-8"><Notice tone="accent" title="Group planning is part of Traveler Plus" action={<LinkButton href="/profile/billing" size="sm">See plans</LinkButton>}>You can always join trips other people invite you to. Upgrade to invite people to your own.</Notice></div>
      )}
      <section className="mb-12">
        <SectionTitle title="Shared trips" />
        {shared.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shared.map((t) => <TripCard key={t.id} trip={t} href={`/trips/${t.id}/group`} />)}</div> : <EmptyState icon={<Users className="h-5 w-5" />} title="No shared trips yet" body="Open one of your trips below and invite people, or accept an invitation link someone sent you." />}
      </section>
      {solo.length > 0 && (
        <section>
          <SectionTitle title="Invite people to a trip" hint="Open a trip's group space to create an invite link." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{solo.map((t) => <TripCard key={t.id} trip={t} href={`/trips/${t.id}/group`} />)}</div>
        </section>
      )}
    </>
  );
}
