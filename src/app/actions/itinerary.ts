"use server";
import { z } from "zod";
import { act, changed, no, ok } from "@/lib/action";
import { withUser } from "@/lib/db";
import { getEntitlements, LimitError } from "@/lib/entitlements";
import { loadItinerary, loadPools, tripRow } from "@/lib/data";
import { optimizeDayOrder } from "@/lib/itinerary-ops";
import { computeRoute, type TravelMode } from "@/lib/maps/routes";
import { nightsBetween } from "@/lib/utils";

const Slot = z.enum(["morning", "afternoon", "evening"]);

export async function removeItem(itemId: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from itinerary_items where id = $1 returning id", [itemId]))));
}

/** Swap an item with its neighbour (dir -1 = earlier, 1 = later) within the day. */
export async function moveItem(itemId: string, dir: -1 | 1) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const [it] = await q<{ id: string; day_id: string }>("select id, day_id from itinerary_items where id = $1", [itemId]);
      if (!it) return no("Item not found.");
      const items = await q<{ id: string; slot: string }>("select id, slot from itinerary_items where day_id = $1 order by position, start_time", [it.day_id]);
      const i = items.findIndex((x) => x.id === itemId), k = i + dir;
      if (k < 0 || k >= items.length) return ok();
      // Crossing into another part of the day moves the item into that part; otherwise swap neighbours.
      if (items[i].slot !== items[k].slot) items[i].slot = items[k].slot;
      else [items[i], items[k]] = [items[k], items[i]];
      let n = 0;
      for (let p = 0; p < items.length; p++) n += (await q("update itinerary_items set position = $2, slot = $3, travel_from_prev = null where id = $1 returning id", [items[p].id, p, items[p].slot])).length;
      return n ? ok() : no("You don't have permission to edit this itinerary.");
    }),
  );
}

export async function moveItemToDay(itemId: string, dayId: string, slot?: string) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const s = slot ? Slot.parse(slot) : null;
      const rows = await q(
        `update itinerary_items i set day_id = d.id, slot = coalesce($3, i.slot), travel_from_prev = null,
           position = (select coalesce(max(position), -1) + 1 from itinerary_items where day_id = d.id)
         from itinerary_days d where i.id = $1 and d.id = $2 and d.trip_id = i.trip_id returning i.id`,
        [itemId, dayId, s],
      );
      return changed(rows);
    }),
  );
}

export async function addItem(input: { tripId: string; dayId: string; slot: string; activityId?: string; restaurantId?: string; title?: string; description?: string; cost?: number | null; startTime?: string }) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const slot = Slot.parse(input.slot);
      const [day] = await q("select id from itinerary_days where id = $1 and trip_id = $2", [input.dayId, input.tripId]);
      if (!day) return no("Day not found.");
      let row: Record<string, unknown> = { kind: "activity", title: input.title?.trim().slice(0, 200), description: input.description?.slice(0, 1000) ?? null, est_cost_pp: input.cost ?? null };
      if (input.activityId) {
        const [a] = await q("select * from activities where id = $1 and trip_id = $2", [input.activityId, input.tripId]);
        if (!a) return no("Activity not found.");
        row = { kind: "activity", title: a.name, description: a.description, est_cost_pp: a.est_cost_pp, duration_min: a.duration_min, lat: a.lat, lng: a.lng, address: a.address, activity_id: a.id };
      } else if (input.restaurantId) {
        const [r] = await q("select * from restaurants where id = $1 and trip_id = $2", [input.restaurantId, input.tripId]);
        if (!r) return no("Restaurant not found.");
        row = { kind: "restaurant", title: r.name, description: r.description, est_cost_pp: r.est_cost_pp, duration_min: 75, lat: r.lat, lng: r.lng, address: r.address, restaurant_id: r.id };
      }
      if (!row.title) return no("Give the activity a name.");
      const time = input.startTime && /^\d{2}:\d{2}$/.test(input.startTime) ? input.startTime : { morning: "10:00", afternoon: "15:00", evening: "20:00" }[slot];
      await q(
        `insert into itinerary_items (day_id, trip_id, position, slot, kind, title, description, start_time, duration_min, est_cost_pp, address, lat, lng, restaurant_id, activity_id, source)
         values ($1,$2,(select coalesce(max(position), -1) + 1 from itinerary_items where day_id = $1),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'user')`,
        [input.dayId, input.tripId, slot, row.kind, row.title, row.description, time, row.duration_min ?? 90, row.est_cost_pp, row.address ?? null, row.lat ?? null, row.lng ?? null, row.restaurant_id ?? null, row.activity_id ?? null],
      );
      return ok();
    }),
  );
}

export async function swapRestaurant(itemId: string, restaurantId: string) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const rows = await q(
        `update itinerary_items i set restaurant_id = r.id, title = (case when i.title ilike 'lunch at %' then 'Lunch at ' when i.title ilike 'dinner at %' then 'Dinner at ' when i.title ilike 'breakfast at %' then 'Breakfast at ' else '' end) || r.name,
           description = r.description, est_cost_pp = r.est_cost_pp, lat = r.lat, lng = r.lng, address = r.address, travel_from_prev = null
         from restaurants r where i.id = $1 and r.id = $2 and r.trip_id = i.trip_id returning i.id`,
        [itemId, restaurantId],
      );
      return changed(rows);
    }),
  );
}

/** Choose a different stay; keeps the estimated hotel budget line in step with it. */
export async function selectHotel(tripId: string, hotelId: string) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const trip = await tripRow(q, u.id, tripId);
      const [h] = await q("select * from hotels where id = $1 and trip_id = $2", [hotelId, tripId]);
      if (!trip || !h) return no("Stay not found.");
      const rows = await q("update hotels set selected = (id = $2) where trip_id = $1 returning id", [tripId, hotelId]);
      if (!rows.length) return no("You don't have permission to edit this trip.");
      if (h.est_nightly != null) {
        const nights = Math.max(1, nightsBetween(trip.start_date, trip.end_date)), rooms = Math.ceil(trip.travelers / 2);
        const note = `${h.name}: about $${h.est_nightly}/night x ${nights} night${nights > 1 ? "s" : ""} x ${rooms} room${rooms > 1 ? "s" : ""} (estimate)`;
        const upd = await q("update trip_expenses set amount = $2, description = $3 where trip_id = $1 and category = 'hotel' and source = 'ai' and status = 'estimated' returning id", [tripId, h.est_nightly * nights * rooms, note]);
        if (!upd.length) await q("insert into trip_expenses (trip_id, created_by, category, description, amount, status, source) values ($1,$2,'hotel',$3,$4,'estimated','ai')", [tripId, u.id, note, h.est_nightly * nights * rooms]);
      }
      return ok();
    }),
  );
}

export async function optimizeDay(tripId: string, dayId: string) {
  return act(async (u) => {
    if (!(await getEntitlements(u.id)).limits.routePlanning) throw new LimitError("Route planning is a Traveler Plus feature.");
    return optimizeDayOrder(u.id, tripId, dayId);
  });
}

/** Fetches real travel times for a day from the routing provider and stores them with source + timestamp. */
export async function planDayRoute(tripId: string, dayId: string, mode: TravelMode) {
  return act(async (u) => {
    if (!(await getEntitlements(u.id)).limits.routePlanning) throw new LimitError("Route planning with travel times is a Traveler Plus feature.");
    const data = await withUser(u.id, async (q) => {
      const trip = await tripRow(q, u.id, tripId);
      if (!trip) return null;
      const { days } = await loadItinerary(q, tripId);
      const hotel = (await loadPools(q, tripId)).hotels.find((h) => h.selected);
      return { trip, day: days.find((d) => d.id === dayId), hotel };
    });
    if (!data?.day) return no("Day not found.");
    const stops = data.day.items.filter((i) => i.lat != null && i.lng != null);
    const start = data.hotel?.lat != null && data.hotel.lng != null ? [{ lat: data.hotel.lat, lng: data.hotel.lng }] : [];
    const route = await computeRoute([...start, ...stops.map((s) => ({ lat: s.lat!, lng: s.lng! }))], z.enum(["walk", "drive", "transit"]).parse(mode));
    if ("error" in route) return no(route.error);
    if (data.trip.role !== "viewer") {
      await withUser(u.id, async (q) => {
        for (let i = 0; i < stops.length; i++) {
          const leg = route.legs[i - (start.length ? 0 : 1)];
          await q("update itinerary_items set travel_from_prev = $2::jsonb where id = $1", [stops[i].id, leg ? JSON.stringify({ ...leg, mode: route.mode, source: route.source, fetched_at: route.fetched_at }) : null]);
        }
      });
    }
    return ok({ path: route.path, source: route.source, mode: route.mode, fetched_at: route.fetched_at, totalMinutes: route.legs.reduce((a, l) => a + l.minutes, 0), totalKm: route.legs.reduce((a, l) => a + l.meters, 0) / 1000 });
  });
}

export async function suggestPlace(input: { tripId: string; type: "activity" | "restaurant"; name: string; note: string }) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const name = input.name.trim().slice(0, 200);
      if (!name) return no("Give your suggestion a name.");
      const table = input.type === "restaurant" ? "restaurants" : "activities";
      await q(`insert into ${table} (trip_id, name, description, status, suggested_by, source) values ($1,$2,$3,'suggested',$4,'user')`, [input.tripId, name, input.note.trim().slice(0, 500) || null, u.id]);
      await q("select notify_trip_members($1, 'suggestion', $2, '/group')", [input.tripId, `${u.full_name || u.email.split("@")[0]} suggested ${name}`]);
      return ok();
    }),
  );
}

export async function resolveSuggestion(input: { type: "activity" | "restaurant"; id: string; accept: boolean }) {
  return act((u) =>
    withUser(u.id, async (q) => {
      const table = input.type === "restaurant" ? "restaurants" : "activities";
      return changed(input.accept ? await q(`update ${table} set status = 'recommended' where id = $1 returning id`, [input.id]) : await q(`delete from ${table} where id = $1 and status = 'suggested' returning id`, [input.id]));
    }),
  );
}
