import { notFound } from "next/navigation";
import { TripMap } from "@/components/trip/trip-map";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadTripBundle } from "@/lib/data";
import { integrations } from "@/lib/env";
import { mapsSearchUrl } from "@/lib/maps/places";
import type { MapPoint } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Trip map" };

export default async function MapPage({ params }: PageProps<"/trips/[id]/map">) {
  const { id } = await params;
  const user = await requireUser();
  const b = await loadTripBundle(user.id, id);
  if (!b) notFound();
  const saved = await withUser(user.id, (q) => q("select * from saved_places where user_id = $1 and trip_id = $2 and lat is not null", [user.id, id]));
  const dest = b.trip.destination_name;
  const acts = new Map(b.activities.map((a) => [a.id, a])), rests = new Map(b.restaurants.map((r) => [r.id, r]));
  const kindOf = (category?: string | null): MapPoint["kind"] => (/night|bar|club|theatre/i.test(category ?? "") ? "nightlife" : /shop|market/i.test(category ?? "") ? "shopping" : "activity");
  const points: MapPoint[] = [];
  for (const h of b.hotels.filter((x) => x.selected && x.lat != null))
    points.push({ id: h.id, kind: "hotel", name: h.name, lat: h.lat!, lng: h.lng!, description: h.description, address: h.address ?? h.area, image: h.image_url, url: h.booking_url, verified: !!h.verified_at });
  const used = new Set<string>();
  for (const d of b.days) {
    let order = 0;
    for (const i of d.items) {
      if (i.lat == null || i.lng == null) continue;
      const a = i.activity_id ? acts.get(i.activity_id) : null, r = i.restaurant_id ? rests.get(i.restaurant_id) : null;
      if (a) used.add(a.id);
      if (r) used.add(r.id);
      points.push({ id: i.id, kind: i.kind === "restaurant" ? "restaurant" : i.kind === "transport" ? "transport" : kindOf(a?.category), name: i.title, lat: i.lat, lng: i.lng, description: i.description, address: i.address, image: a?.image_url ?? r?.image_url, url: a?.website_url ?? r?.website_url ?? mapsSearchUrl(a?.name ?? r?.name ?? i.title, dest), day: d.day_number, order: ++order, verified: !!(a?.verified_at ?? r?.verified_at) });
    }
  }
  for (const a of b.activities.filter((x) => !used.has(x.id) && x.lat != null))
    points.push({ id: a.id, kind: kindOf(a.category), name: a.name, lat: a.lat!, lng: a.lng!, description: a.description, address: a.address, image: a.image_url, url: a.website_url ?? mapsSearchUrl(a.name, dest), verified: !!a.verified_at });
  for (const r of b.restaurants.filter((x) => !used.has(x.id) && x.lat != null))
    points.push({ id: r.id, kind: "restaurant", name: r.name, lat: r.lat!, lng: r.lng!, description: r.description, address: r.address, image: r.image_url, url: r.website_url ?? mapsSearchUrl(r.name, dest), verified: !!r.verified_at });
  for (const s of saved) points.push({ id: s.id, kind: "saved", name: s.name, lat: s.lat, lng: s.lng, description: s.note, address: s.address, url: s.url });

  return (
    <TripMap
      tripId={id}
      points={points}
      days={b.days.map((d) => ({ id: d.id, number: d.day_number, label: d.date ? fmtDate(d.date) : `Day ${d.day_number}` }))}
      center={b.trip.dest_lat != null && b.trip.dest_lng != null ? [b.trip.dest_lat, b.trip.dest_lng] : null}
      provider={integrations().googleBrowser ? "Google Maps" : "OpenStreetMap (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google Maps)"}
    />
  );
}
