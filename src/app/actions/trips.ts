"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { act, changed, no, ok } from "@/lib/action";
import { asService, withUser, j } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS, VACATION_STYLES } from "@/lib/plans";
import { findDestination } from "@/lib/catalog";
import { geocodeDestination } from "@/lib/maps/places";
import { generateItinerary, regenerateDay, surpriseMe, budgetAdvice } from "@/lib/planner";
import { sendConciergeMessage } from "@/lib/concierge";
import { nightsBetween, slugify, todayISO, type ActionResult } from "@/lib/utils";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TripInput = z.object({
  origin: z.string().trim().max(120),
  destination: z.string().trim().min(2).max(120),
  start: DateStr,
  end: DateStr,
  travelers: z.coerce.number().int().min(1).max(30),
  budget: z.coerce.number().min(50).max(5_000_000),
  style: z.enum(VACATION_STYLES).or(z.literal("")),
});

export type TripFormState = { error?: string; code?: "upgrade_required" | "auth"; values?: Record<string, string> } | null;

export async function createTrip(_: TripFormState, form: FormData): Promise<TripFormState> {
  const r = await createTripInner(form);
  // React resets the form after an action; echo the values so nothing the user typed is lost on error.
  return r ? { ...r, values: Object.fromEntries([...form].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v).slice(0, 200)])) } : r;
}

async function createTripInner(form: FormData): Promise<TripFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Create a free account to build your vacation.", code: "auth" };
  const p = TripInput.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Please fill in a destination, both dates, travelers and a budget." };
  const t = p.data;
  if (t.end < t.start) return { error: "Your return date is before your departure date." };
  if (nightsBetween(t.start, t.end) > 21) return { error: "Trips can be up to 21 nights for now." };

  // Plan limit is checked on the server against stored subscription state.
  const ent = await getEntitlements(user.id);
  const [{ n }] = await withUser(user.id, (q) => q<{ n: number }>("select count(*)::int as n from trips where owner_id = $1 and status <> 'archived' and end_date >= $2", [user.id, todayISO()]));
  if (n >= ent.limits.activeTrips)
    return { error: `${PLANS[ent.plan].name} includes ${ent.limits.activeTrips} active trip${ent.limits.activeTrips > 1 ? "s" : ""}. Archive or delete a trip, or upgrade for more.`, code: "upgrade_required" };

  const cat = findDestination(t.destination);
  const geo = cat ? null : await geocodeDestination(t.destination);
  const name = cat?.name ?? t.destination;
  const slug = cat?.slug ?? slugify(t.destination);
  const lat = cat?.lat ?? geo?.lat ?? null, lng = cat?.lng ?? geo?.lng ?? null;
  // Shared destination cache (service-written).
  const [dest] = await asService((q) =>
    q<{ id: string }>(
      `insert into destinations (slug, name, country, lat, lng, source, data) values ($1,$2,$3,$4,$5,$6,$7::jsonb)
       on conflict (slug) do update set fetched_at = case when excluded.lat is not null then now() else destinations.fetched_at end,
         lat = coalesce(excluded.lat, destinations.lat), lng = coalesce(excluded.lng, destinations.lng) returning id`,
      [slug, name, cat?.country ?? null, lat, lng, cat ? "catalog" : geo ? "google_places" : "user", j(geo ? { address: geo.address } : {})],
    ),
  );
  const [trip] = await withUser(user.id, (q) =>
    q<{ id: string }>(
      `insert into trips (owner_id, destination_id, title, destination_name, destination_country, dest_lat, dest_lng, origin_city, start_date, end_date, travelers, budget, vacation_style, cover_image)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [user.id, dest.id, `${name} getaway`, name, cat?.country ?? null, lat, lng, t.origin || null, t.start, t.end, t.travelers, t.budget, t.style || null, cat ? `/destinations/${cat.slug}.jpg` : null],
    ),
  );
  redirect(`/trips/${trip.id}?new=1`);
}

export const generateTrip = async (tripId: string) => act((u) => generateItinerary(u.id, tripId));
export const regenDay = async (tripId: string, dayId: string, instruction: string) => act((u) => regenerateDay(u.id, tripId, dayId, instruction.slice(0, 300)));
export const getBudgetAdvice = async (tripId: string) => act((u) => budgetAdvice(u.id, tripId));

export async function updateTrip(tripId: string, patch: { title?: string; budget?: number; travelers?: number; status?: string; is_favorite?: boolean }) {
  return act(async (u) => {
    const p = z.object({ title: z.string().trim().min(1).max(120).optional(), budget: z.number().min(50).max(5_000_000).optional(), travelers: z.number().int().min(1).max(30).optional(), status: z.enum(["planning", "booked", "completed", "archived"]).optional(), is_favorite: z.boolean().optional() }).parse(patch);
    const rows = await withUser(u.id, (q) =>
      q("update trips set title = coalesce($2, title), budget = coalesce($3, budget), travelers = coalesce($4, travelers), status = coalesce($5, status), is_favorite = coalesce($6, is_favorite) where id = $1 returning id", [tripId, p.title ?? null, p.budget ?? null, p.travelers ?? null, p.status ?? null, p.is_favorite ?? null]),
    );
    return changed(rows);
  });
}

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const r = await act(async (u) => changed(await withUser(u.id, (q) => q("delete from trips where id = $1 returning id", [tripId]))));
  if (r.ok) redirect("/trips");
  return r.ok ? r : no("Only the trip owner can delete a trip.");
}

export async function surprise(input: { origin: string; month: number; budget: number; travelers: number; weather: string; style: string; exclude: string[] }) {
  return act(async (u) => {
    const p = z.object({ origin: z.string().trim().min(2).max(120), month: z.number().int().min(1).max(12), budget: z.number().min(100).max(5_000_000), travelers: z.number().int().min(1).max(30), weather: z.enum(["any", "tropical", "warm", "mild", "cool"]), style: z.string().max(40), exclude: z.array(z.string().max(80)).max(40) }).parse(input);
    return surpriseMe(u.id, p);
  });
}

export async function sendMessage(input: { conversationId: string | null; tripId: string | null; message: string }) {
  return act(async (u) => {
    const message = input.message.trim().slice(0, 2000);
    if (!message) return no("Type a message first.");
    return sendConciergeMessage(u.id, { ...input, message });
  });
}

export async function deleteConversation(id: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from chat_conversations where id = $1 returning id", [id]))));
}

export async function savePlace(input: { tripId: string | null; name: string; kind: string; note?: string; address?: string | null; lat?: number | null; lng?: number | null; url?: string | null }) {
  return act(async (u) => {
    await withUser(u.id, (q) => q("insert into saved_places (user_id, trip_id, name, kind, note, address, lat, lng, url) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [u.id, input.tripId, input.name.slice(0, 200), input.kind.slice(0, 40), input.note?.slice(0, 500) ?? null, input.address ?? null, input.lat ?? null, input.lng ?? null, input.url ?? null]));
    return ok();
  });
}
export async function removeSavedPlace(id: string) {
  return act(async (u) => changed(await withUser(u.id, (q) => q("delete from saved_places where id = $1 returning id", [id]))));
}

export async function markNotificationsRead() {
  return act(async (u) => {
    await withUser(u.id, (q) => q("update notifications set read_at = now() where user_id = $1 and read_at is null", [u.id]));
    return ok();
  });
}
