import { withUser } from "@/lib/db";
import { loadItinerary, loadPools, tripRow } from "@/lib/data";
import { haversineKm, type ActionResult } from "@/lib/utils";
import type { Item } from "@/lib/types";

/**
 * Reorders a day's stops with a nearest-neighbour pass inside each part of the day
 * (morning / afternoon / evening), starting from the hotel. Uses straight-line distance only;
 * it never produces travel times. Clears stored provider travel times since the order changed.
 */
export async function optimizeDayOrder(userId: string, tripId: string, dayId: string): Promise<ActionResult<{ moved: number }>> {
  return withUser(userId, async (q) => {
    const trip = await tripRow(q, userId, tripId);
    if (!trip || trip.role === "viewer") return { ok: false as const, error: "You can't edit this itinerary." };
    const { days } = await loadItinerary(q, tripId);
    const day = days.find((d) => d.id === dayId);
    if (!day) return { ok: false as const, error: "Day not found." };
    const hotel = (await loadPools(q, tripId)).hotels.find((h) => h.selected);
    let cursor = hotel?.lat != null && hotel.lng != null ? { lat: hotel.lat, lng: hotel.lng } : null;
    const out: Item[] = [];
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      const pool = day.items.filter((i) => i.slot === slot);
      while (pool.length) {
        let best = 0;
        if (cursor) {
          let bestD = Infinity;
          pool.forEach((p, k) => {
            const d = p.lat != null && p.lng != null ? haversineKm(cursor!, { lat: p.lat, lng: p.lng }) : Infinity;
            if (d < bestD) { bestD = d; best = k; }
          });
        }
        const [next] = pool.splice(best, 1);
        out.push(next);
        if (next.lat != null && next.lng != null) cursor = { lat: next.lat, lng: next.lng };
      }
    }
    const moved = out.filter((it, i) => day.items[i]?.id !== it.id).length;
    for (let i = 0; i < out.length; i++) await q("update itinerary_items set position = $2, travel_from_prev = null where id = $1", [out[i].id, i]);
    return { ok: true as const, data: { moved } };
  });
}
