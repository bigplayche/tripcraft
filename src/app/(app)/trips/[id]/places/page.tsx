import { notFound } from "next/navigation";
import { PlacesView } from "@/components/trip/places-view";
import { requireUser } from "@/lib/auth/session";
import { loadTripBundle } from "@/lib/data";
import { nightsBetween } from "@/lib/utils";

export const metadata = { title: "Places" };

export default async function PlacesPage({ params }: PageProps<"/trips/[id]/places">) {
  const { id } = await params;
  const user = await requireUser();
  const b = await loadTripBundle(user.id, id);
  if (!b) notFound();
  const p = JSON.parse(JSON.stringify(b)) as typeof b;
  return <PlacesView tripId={id} destination={b.trip.destination_name} hotels={p.hotels} restaurants={p.restaurants} activities={p.activities} canEdit={b.trip.role !== "viewer"} nights={Math.max(1, nightsBetween(b.trip.start_date, b.trip.end_date))} rooms={Math.ceil(b.trip.travelers / 2)} />;
}
