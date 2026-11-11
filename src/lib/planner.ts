/**
 * Planning service: turns a trip into a stored, editable itinerary.
 * AI path (OpenAI structured output) when configured, curated fallback otherwise.
 * Both paths produce the same TripPlan shape and go through the same persistence code.
 */
import { withUser, j, type Q } from "@/lib/db";
import { integrations } from "@/lib/env";
import { assertAiQuota, getEntitlements, LimitError, recordUsage } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { budgetSummary, getPrefs, loadTripBundle, tripRow } from "@/lib/data";
import { addDays, haversineKm, nightsBetween, type ActionResult } from "@/lib/utils";
import type { Prefs, Trip } from "@/lib/types";
import { PROMPTS } from "@/lib/ai/prompts";
import { BudgetAdvice, DayPlan, DiscoverResult, TripPlan } from "@/lib/ai/schemas";
import { aiModel, AiError, structured } from "@/lib/ai/openai";
import { demoBudgetAdvice, demoDiscover, demoPlan, type SurpriseInput } from "@/lib/ai/fallback";
import { bookingSearchUrl, searchPlaces } from "@/lib/maps/places";

const num = (v: unknown, min = 0, max = 1e7) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const coord = (lat: unknown, lng: unknown) => {
  const a = num(lat, -90, 90), b = num(lng, -180, 180);
  return a == null || b == null || (a === 0 && b === 0) ? [null, null] : [a, b];
};
const time = (s: string | null) => (s && /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, "0") : null);

export function fail(e: unknown): ActionResult<never> {
  if (e instanceof LimitError) return { ok: false, error: e.message, code: "upgrade_required" };
  if (e instanceof AiError) return { ok: false, error: e.message };
  console.error(JSON.stringify({ evt: "error", message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4) : undefined }));
  return { ok: false, error: "Something went wrong on our side. Please try again." };
}

export function tripBrief(t: Trip, prefs: Prefs | null) {
  const nights = nightsBetween(t.start_date, t.end_date);
  return [
    `Destination: ${t.destination_name}${t.destination_country ? `, ${t.destination_country}` : ""}`,
    `Departing from: ${t.origin_city || "not specified"}`,
    `Dates: ${t.start_date} to ${t.end_date} (${nights} nights, ${nights + 1} calendar days)`,
    `Travelers: ${t.travelers}`,
    `Total budget for the whole party: $${t.budget} ${t.currency}`,
    `Vacation style: ${t.vacation_style || "not specified"}`,
    prefs
      ? `Saved preferences: styles=${prefs.vacation_styles.join(", ") || "none"}; hotel category=${prefs.hotel_category || "any"}; food=${prefs.food_preferences.join(", ") || "no restrictions stated"}; activities=${prefs.activities.join(", ") || "none"}; interest (0-4) nightlife=${prefs.nightlife_interest}, adventure=${prefs.adventure_interest}, relaxation=${prefs.relaxation_interest}`
      : "",
  ].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ persistence */

type Ref = { id: string; name: string; lat: number | null; lng: number | null; address: string | null };

async function insertRestaurant(q: Q, tripId: string, r: TripPlan["restaurants"][number], source: string): Promise<Ref> {
  const [lat, lng] = coord(r.lat, r.lng);
  const [row] = await q<Ref>(
    `insert into restaurants (trip_id, name, cuisine, price_level, description, address, lat, lng, est_cost_pp, source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, name, lat, lng, address`,
    [tripId, r.name.slice(0, 200), r.cuisine, Math.round(num(r.price_level, 1, 4) ?? 2), r.description, r.address, lat, lng, num(r.est_cost_pp_usd), source],
  );
  return row;
}
async function insertActivity(q: Q, tripId: string, a: TripPlan["activities"][number], source: string): Promise<Ref> {
  const [lat, lng] = coord(a.lat, a.lng);
  const [row] = await q<Ref>(
    `insert into activities (trip_id, name, category, description, address, lat, lng, est_cost_pp, duration_min, indoor, source)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, name, lat, lng, address`,
    [tripId, a.name.slice(0, 200), a.category, a.description, a.address, lat, lng, num(a.est_cost_pp_usd), Math.round(num(a.duration_min, 0, 1440) ?? 90), a.indoor, source],
  );
  return row;
}

async function insertItems(q: Q, tripId: string, dayId: string, items: TripPlan["days"][number]["items"], rest: Map<string, Ref>, acts: Map<string, Ref>, source: string) {
  const order = { morning: 0, afternoon: 1, evening: 2 };
  const sorted = [...items].sort((a, b) => order[a.slot] - order[b.slot] || (time(a.start_time) ?? "").localeCompare(time(b.start_time) ?? ""));
  let pos = 0;
  for (const it of sorted) {
    const r = it.ref_key ? rest.get(it.ref_key) : undefined;
    const a = it.ref_key ? acts.get(it.ref_key) : undefined;
    const ref = r ?? a;
    const kind = r ? "restaurant" : a ? "activity" : it.kind === "restaurant" || it.kind === "activity" ? it.kind : it.kind;
    await q(
      `insert into itinerary_items (day_id, trip_id, position, slot, kind, title, description, start_time, duration_min, est_cost_pp, address, lat, lng, transport_note, restaurant_id, activity_id, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [dayId, tripId, pos++, it.slot, kind, it.title.slice(0, 200), it.description, time(it.start_time), Math.round(num(it.duration_min, 0, 1440) ?? 60), num(it.est_cost_pp_usd), ref?.address ?? null, ref?.lat ?? null, ref?.lng ?? null, it.transport_note, r?.id ?? null, a?.id ?? null, source],
    );
  }
}

async function persistPlan(q: Q, userId: string, trip: Trip, plan: TripPlan, generatedBy: string) {
  const source = generatedBy.startsWith("openai") ? "ai" : "catalog";
  await q("delete from itineraries where trip_id = $1", [trip.id]);
  await q("delete from hotels where trip_id = $1 and source in ('ai','catalog')", [trip.id]);
  await q("delete from restaurants where trip_id = $1 and source in ('ai','catalog')", [trip.id]);
  await q("delete from activities where trip_id = $1 and source in ('ai','catalog')", [trip.id]);
  await q("delete from trip_expenses where trip_id = $1 and source = 'ai' and status = 'estimated'", [trip.id]);

  const [it] = await q<{ id: string }>(
    "insert into itineraries (trip_id, summary, assumptions, savings_tips, generated_by, budget_at_generation) values ($1,$2,$3::jsonb,$4::jsonb,$5,$6) returning id",
    [trip.id, plan.summary, j(plan.assumptions), j(plan.savings_tips), generatedBy, trip.budget],
  );

  let i = 0;
  for (const h of plan.hotels.slice(0, 8)) {
    const [lat, lng] = coord(h.lat, h.lng);
    await q(
      `insert into hotels (trip_id, name, area, description, lat, lng, hotel_type, tier, est_nightly, distance_note, booking_url, selected, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [trip.id, h.name.slice(0, 200), h.area, h.description, lat, lng, h.hotel_type, h.tier, num(h.est_nightly_usd), h.distance_note, bookingSearchUrl(h.name, trip.destination_name, trip.start_date, trip.end_date, trip.travelers), i++ === 0, source],
    );
  }
  const rest = new Map<string, Ref>(), acts = new Map<string, Ref>();
  for (const r of plan.restaurants.slice(0, 40)) rest.set(r.key, await insertRestaurant(q, trip.id, r, source));
  for (const a of plan.activities.slice(0, 50)) acts.set(a.key, await insertActivity(q, trip.id, a, source));

  const total = nightsBetween(trip.start_date, trip.end_date) + 1;
  const byNumber = new Map(plan.days.map((d) => [Math.round(d.day_number), d]));
  for (let n = 1; n <= total; n++) {
    const d = byNumber.get(n);
    const [day] = await q<{ id: string }>(
      "insert into itinerary_days (itinerary_id, trip_id, day_number, date, title, summary) values ($1,$2,$3,$4,$5,$6) returning id",
      [it.id, trip.id, n, addDays(trip.start_date, n - 1), d?.title ?? `Day ${n}`, d?.summary ?? null],
    );
    if (d) await insertItems(q, trip.id, day.id, d.items, rest, acts, source);
  }

  for (const b of plan.budget) {
    const amount = num(b.amount_usd);
    if (amount == null || amount <= 0) continue;
    await q("insert into trip_expenses (trip_id, created_by, category, description, amount, status, source) values ($1,$2,$3,$4,$5,'estimated','ai')", [trip.id, userId, b.category, b.note.slice(0, 300), Math.round(amount)]);
  }
  if (!trip.packing_list?.length && plan.packing_list.length) {
    await q("update trips set packing_list = $2::jsonb where id = $1", [trip.id, j(plan.packing_list.slice(0, 30).map((label, k) => ({ id: `p${k}`, label, done: false })))]);
  }
  if (trip.dest_lat == null) {
    const located = plan.hotels.map((h) => coord(h.lat, h.lng)).filter(([a]) => a != null) as number[][];
    if (located.length) await q("update trips set dest_lat = $2, dest_lng = $3 where id = $1", [trip.id, located[0][0], located[0][1]]);
  }
}

/* ------------------------------------------------------------------ generation */

export async function generateItinerary(userId: string, tripId: string): Promise<ActionResult<{ mode: "ai" | "demo" }>> {
  try {
    const rl = rateLimit(`gen:${userId}`, 4, 60_000);
    if (!rl.ok) return { ok: false, error: `Please wait ${rl.retryAfter}s before generating again.`, code: "rate_limited" };
    const trip = await withUser(userId, (q) => tripRow(q, userId, tripId));
    if (!trip) return { ok: false, error: "Trip not found." };
    if (trip.role === "viewer") return { ok: false, error: "Viewers can't regenerate the itinerary." };
    await assertAiQuota(userId, "trip_generation");
    const prefs = await getPrefs(userId);

    let plan: TripPlan, generatedBy: string;
    if (integrations().openai) {
      plan = await structured({
        name: "trip_plan", schema: TripPlan, system: PROMPTS.tripGeneration, userId, kind: "trip_generation",
        user: `Plan this trip.\n\n${tripBrief(trip, prefs)}\n\nList your recommended default hotel first. Today's date is ${new Date().toISOString().slice(0, 10)}.`,
      });
      generatedBy = `openai:${aiModel()}`;
    } else {
      plan = demoPlan(trip, prefs);
      generatedBy = "demo-catalog";
      await recordUsage(userId, "trip_generation", "demo");
    }
    await withUser(userId, (q) => persistPlan(q, userId, trip, plan, generatedBy));
    await verifyTripPlaces(userId, tripId).catch((e) => console.warn("verify failed", e));
    return { ok: true, data: { mode: generatedBy === "demo-catalog" ? "demo" : "ai" } };
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateDay(userId: string, tripId: string, dayId: string, instruction: string): Promise<ActionResult> {
  try {
    const rl = rateLimit(`gen:${userId}`, 6, 60_000);
    if (!rl.ok) return { ok: false, error: `Please wait ${rl.retryAfter}s before trying again.`, code: "rate_limited" };
    const b = await loadTripBundle(userId, tripId);
    const day = b?.days.find((d) => d.id === dayId);
    if (!b || !day) return { ok: false, error: "Day not found." };
    if (b.trip.role === "viewer") return { ok: false, error: "Viewers can't edit the itinerary." };
    const ent = await assertAiQuota(userId, "day_regen");
    if (!ent.limits.dayRegeneration) throw new LimitError("Regenerating a single day is a Traveler Plus feature.");

    const others = b.days.filter((d) => d.id !== dayId).flatMap((d) => d.items);
    const usedR = new Set(others.map((i) => i.restaurant_id)), usedA = new Set(others.map((i) => i.activity_id));
    const freeR = b.restaurants.filter((r) => !usedR.has(r.id)), freeA = b.activities.filter((a) => !usedA.has(a.id));
    const rest = new Map<string, Ref>(freeR.map((r, i) => [`r${i + 1}`, r])), acts = new Map<string, Ref>(freeA.map((a, i) => [`a${i + 1}`, a]));
    const hotel = b.hotels.find((h) => h.selected);

    let plan: DayPlan, source = "ai";
    if (integrations().openai) {
      const list = (m: Map<string, Ref>, extra: (x: never) => string) => [...m].map(([k, v]) => `${k}: ${v.name}${extra(v as never)}`).join("\n") || "(none)";
      plan = await structured({
        name: "day_plan", schema: DayPlan, system: PROMPTS.itineraryModification, userId, kind: "day_regen", maxTokens: 6000,
        user: [
          tripBrief(b.trip, await getPrefs(userId)),
          `\nRebuild day ${day.day_number} (${day.date}) of ${b.days.length}. ${day.day_number === 1 ? "This is the arrival day." : day.day_number === b.days.length ? "This is the departure day." : ""}`,
          `Traveler's instruction for this day: ${instruction || "(none: just offer a fresh alternative)"}`,
          `Hotel: ${hotel ? `${hotel.name} (${hotel.area})` : "not chosen"}`,
          `Per-day budget guide per person for food and activities: about $${Math.round((b.trip.budget * 0.35) / b.trip.travelers / b.days.length)}`,
          `\nCurrent plan for this day (to be replaced):\n${day.items.map((i) => `- ${i.title}`).join("\n") || "(empty)"}`,
          `\nAlready scheduled on other days (do not reuse):\n${others.filter((i) => i.kind !== "free").map((i) => `- ${i.title}`).join("\n") || "(none)"}`,
          `\nUnscheduled restaurants you can reference by key:\n${list(rest, (r: { cuisine: string }) => ` (${r.cuisine})`)}`,
          `\nUnscheduled activities you can reference by key:\n${list(acts, (a: { category: string; indoor: boolean }) => ` (${a.category}${a.indoor ? ", indoor" : ""})`)}`,
        ].join("\n"),
      });
    } else {
      source = "catalog";
      const wantsIndoor = /rain|indoor|wet/i.test(instruction);
      const pool = [...freeA].filter((a) => (a.duration_min ?? 0) < 300 && a.category !== "Nightlife").sort((x, y) => Number(!!y.indoor === wantsIndoor) - Number(!!x.indoor === wantsIndoor) || Math.random() - 0.5);
      const m = pool[0], a = pool.slice(1).sort((x, y) => dist(x, m) - dist(y, m))[0];
      const meals = [...(freeR.length >= 2 ? freeR : b.restaurants)].sort(() => Math.random() - 0.5);
      const kOf = (m2: Map<string, Ref>, v?: Ref) => [...m2].find(([, x]) => x === v)?.[0] ?? null;
      if (!freeR.length) b.restaurants.forEach((r, i) => rest.set(`x${i}`, r));
      const mk = (slot: "morning" | "afternoon" | "evening", start: string, kind: "activity" | "restaurant", ref: Ref | undefined, m2: Map<string, Ref>, prefix = "") =>
        ref ? [{ slot, kind, ref_key: kOf(m2, ref), title: prefix + ref.name, description: (ref as { description?: string }).description ?? "", start_time: start, duration_min: (ref as { duration_min?: number }).duration_min ?? 75, est_cost_pp_usd: (ref as { est_cost_pp?: number }).est_cost_pp ?? null, transport_note: null }] : [];
      plan = {
        title: [m?.name, a?.name].filter(Boolean).join(" & ") || "At your own pace",
        summary: `A fresh alternative for day ${day.day_number}${wantsIndoor ? ", favouring indoor options" : ""} (sample planner).`,
        items: [...mk("morning", "09:30", "activity", m, acts), ...mk("afternoon", "12:30", "restaurant", meals[0], rest, "Lunch at "), ...mk("afternoon", "14:30", "activity", a, acts), ...mk("evening", "19:30", "restaurant", meals[1], rest, "Dinner at ")],
        new_restaurants: [], new_activities: [],
      };
      if (!plan.items.length) return { ok: false, error: "There are no unscheduled places left to build a different day from. Add some on the Places tab." };
      await recordUsage(userId, "day_regen", "demo");
    }

    await withUser(userId, async (q) => {
      for (const r of plan.new_restaurants.slice(0, 6)) rest.set(r.key, await insertRestaurant(q, tripId, r, "ai"));
      for (const a of plan.new_activities.slice(0, 6)) acts.set(a.key, await insertActivity(q, tripId, a, "ai"));
      await q("delete from itinerary_items where day_id = $1", [dayId]);
      await q("update itinerary_days set title = $2, summary = $3 where id = $1", [dayId, plan.title, plan.summary]);
      await insertItems(q, tripId, dayId, plan.items, rest, acts, source);
    });
    await verifyTripPlaces(userId, tripId).catch(() => {});
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const dist = (a?: { lat: number | null; lng: number | null }, b?: { lat: number | null; lng: number | null }) =>
  a?.lat != null && a.lng != null && b?.lat != null && b.lng != null ? haversineKm(a as never, b as never) : 9999;

/* ------------------------------------------------------------------ verification */

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 2);
const similar = (a: string, b: string) => {
  const x = new Set(norm(a)), y = norm(b);
  return y.filter((w) => x.has(w)).length >= Math.max(1, Math.ceil(Math.min(x.size, y.length) / 2));
};

/** Confirms unverified recommendations against Google Places and stamps source + time. No-op without a key. */
export async function verifyTripPlaces(userId: string, tripId: string) {
  if (!integrations().googleServer) return;
  const b = await loadTripBundle(userId, tripId);
  if (!b || b.trip.role === "viewer") return;
  const near = b.trip.dest_lat != null && b.trip.dest_lng != null ? { lat: b.trip.dest_lat, lng: b.trip.dest_lng } : null;
  const todo = [
    ...b.hotels.map((x) => ({ table: "hotels", x })),
    ...b.restaurants.map((x) => ({ table: "restaurants", x })),
    ...b.activities.map((x) => ({ table: "activities", x })),
  ].filter(({ x }) => !x.verified_at).slice(0, 45);
  const results: { table: string; id: string; p: NonNullable<Awaited<ReturnType<typeof searchPlaces>>>[number] }[] = [];
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(
      todo.slice(i, i + 6).map(async ({ table, x }) => {
        const p = (await searchPlaces(`${x.name}, ${b.trip.destination_name}`, near, 1))?.[0];
        if (p && similar(p.name, x.name)) results.push({ table, id: x.id, p });
      }),
    );
  }
  await withUser(userId, async (q) => {
    for (const { table, id, p } of results) {
      const web = table === "hotels" ? "" : ", website_url = coalesce($9, website_url)";
      await q(
        `update ${table} set address = coalesce($2, address), lat = coalesce($3, lat), lng = coalesce($4, lng), rating = $5, rating_count = $6, image_url = coalesce($7, image_url), verified_at = $8${web} where id = $1`,
        [id, p.address, p.lat, p.lng, p.rating, p.rating_count, p.photo, p.fetched_at, ...(table === "hotels" ? [] : [p.website ?? p.maps_url])],
      );
      const col = table === "restaurants" ? "restaurant_id" : table === "activities" ? "activity_id" : null;
      if (col) await q(`update itinerary_items set address = coalesce($2, address), lat = coalesce($3, lat), lng = coalesce($4, lng) where ${col} = $1`, [id, p.address, p.lat, p.lng]);
    }
  });
}

/* ------------------------------------------------------------------ budget + discovery */

export async function budgetAdvice(userId: string, tripId: string): Promise<ActionResult<BudgetAdvice & { mode: "ai" | "demo" }>> {
  try {
    const b = await loadTripBundle(userId, tripId);
    if (!b) return { ok: false, error: "Trip not found." };
    const ent = await assertAiQuota(userId, "budget");
    if (!ent.limits.budgetAdvice) throw new LimitError("AI savings advice is a Traveler Plus feature.");
    const s = budgetSummary(b);
    if (!integrations().openai) {
      await recordUsage(userId, "budget", "demo");
      return { ok: true, data: { ...demoBudgetAdvice(b.trip.budget, s.byCategory, s.total), mode: "demo" } };
    }
    const hotel = b.hotels.find((h) => h.selected);
    const advice = await structured({
      name: "budget_advice", schema: BudgetAdvice, system: PROMPTS.budgetOptimization, userId, kind: "budget", maxTokens: 5000,
      user: [
        tripBrief(b.trip, null),
        `\nPlanned total: $${Math.round(s.total)} (${Math.round(s.pct)}% of budget). Paid $${Math.round(s.paid)}, booked $${Math.round(s.booked)}, estimated $${Math.round(s.estimated)}.`,
        `Expense lines:\n${b.expenses.map((e) => `- [${e.category}/${e.status}] $${e.amount}: ${e.description}`).join("\n")}`,
        `Selected stay: ${hotel ? `${hotel.name}, about $${hotel.est_nightly}/night (estimate)` : "none"}. Other stay options: ${b.hotels.filter((h) => !h.selected).map((h) => `${h.name} ~$${h.est_nightly}`).join("; ") || "none"}`,
        `Itinerary:\n${b.days.map((d) => `Day ${d.day_number}: ${d.items.map((i) => `${i.title}${i.est_cost_pp ? ` (~$${i.est_cost_pp}pp)` : ""}`).join("; ")}`).join("\n")}`,
      ].join("\n"),
    });
    return { ok: true, data: { ...advice, mode: "ai" } };
  } catch (e) {
    return fail(e);
  }
}

export async function surpriseMe(userId: string, input: SurpriseInput): Promise<ActionResult<DiscoverResult & { mode: "ai" | "demo" }>> {
  try {
    const rl = rateLimit(`disc:${userId}`, 6, 60_000);
    if (!rl.ok) return { ok: false, error: `Please wait ${rl.retryAfter}s before trying again.`, code: "rate_limited" };
    await assertAiQuota(userId, "discover");
    if (!integrations().openai) {
      await recordUsage(userId, "discover", "demo");
      return { ok: true, data: { ...demoDiscover(input), mode: "demo" } };
    }
    const prefs = await getPrefs(userId);
    const month = new Date(2000, input.month - 1, 1).toLocaleString("en-US", { month: "long" });
    const out = await structured({
      name: "destinations", schema: DiscoverResult, system: PROMPTS.destinationDiscovery, userId, kind: "discover", maxTokens: 5000,
      user: `Departure city: ${input.origin}\nTravel month: ${month}\nTotal budget for the party: $${input.budget}\nTravelers: ${input.travelers}\nPreferred weather: ${input.weather}\nVacation style: ${input.style}\nSaved interests: ${prefs?.activities.join(", ") || "none"}\nAlready shown: ${input.exclude.join(", ") || "none"}`,
    });
    return { ok: true, data: { ...out, mode: "ai" } };
  } catch (e) {
    return fail(e);
  }
}

export { getEntitlements };
