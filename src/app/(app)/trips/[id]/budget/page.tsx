import { notFound } from "next/navigation";
import { BudgetView } from "@/components/trip/budget-view";
import { requireUser } from "@/lib/auth/session";
import { budgetSummary, loadTripBundle } from "@/lib/data";
import { getEntitlements } from "@/lib/entitlements";
import { nightsBetween } from "@/lib/utils";

export const metadata = { title: "Budget" };
export const maxDuration = 120;

export default async function BudgetPage({ params }: PageProps<"/trips/[id]/budget">) {
  const { id } = await params;
  const user = await requireUser();
  const [b, ent] = await Promise.all([loadTripBundle(user.id, id), getEntitlements(user.id)]);
  if (!b) notFound();
  const p = JSON.parse(JSON.stringify(b)) as typeof b;
  return <BudgetView tripId={id} budget={b.trip.budget} travelers={b.trip.travelers} s={budgetSummary(b)} expenses={p.expenses} members={p.members} hotels={p.hotels} canEdit={b.trip.role !== "viewer"} canCompare={ent.limits.budgetComparison} me={user.id} nights={Math.max(1, nightsBetween(b.trip.start_date, b.trip.end_date))} budgetAtGeneration={b.itinerary?.budget_at_generation ?? null} />;
}
