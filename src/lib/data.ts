/** Read queries. Everything runs through withUser(), so RLS decides what a user can see. */
import { withUser, isUuid, type Q } from "@/lib/db";
import type { Activity, Day, Expense, Hotel, Item, Itinerary, Member, Prefs, Restaurant, Split, Trip } from "@/lib/types";

export async function listTrips(userId: string): Promise<Trip[]> {
  return withUser(userId, (q) =>
    q<Trip>(
      `select t.*, m.role, (select count(*)::int from trip_members x where x.trip_id = t.id) as member_count
       from trips t join trip_members m on m.trip_id = t.id and m.user_id = $1
       order by (t.end_date < current_date), t.start_date`,
      [userId],
    ),
  );
}

export async function getTrip(userId: string, tripId: string): Promise<Trip | null> {
  if (!isUuid(tripId)) return null;
  const rows = await withUser(userId, (q) => tripRow(q, userId, tripId));
  return rows;
}

export async function tripRow(q: Q, userId: string, tripId: string): Promise<Trip | null> {
  const [t] = await q<Trip>(
    `select t.*, m.role, (select count(*)::int from trip_members x where x.trip_id = t.id) as member_count
     from trips t join trip_members m on m.trip_id = t.id and m.user_id = $1 where t.id = $2`,
    [userId, tripId],
  );
  return t ?? null;
}

export async function loadItinerary(q: Q, tripId: string): Promise<{ itinerary: Itinerary | null; days: Day[] }> {
  const [itinerary] = await q<Itinerary>("select * from itineraries where trip_id = $1", [tripId]);
  if (!itinerary) return { itinerary: null, days: [] };
  const days = await q<Day>("select * from itinerary_days where itinerary_id = $1 order by day_number", [itinerary.id]);
  const items = await q<Item>("select * from itinerary_items where trip_id = $1 order by position, start_time", [tripId]);
  for (const d of days) d.items = items.filter((i) => i.day_id === d.id);
  return { itinerary, days };
}

export async function loadPools(q: Q, tripId: string) {
  const [hotels, restaurants, activities] = await Promise.all([
    q<Hotel>("select * from hotels where trip_id = $1 order by selected desc, est_nightly", [tripId]),
    q<Restaurant>("select * from restaurants where trip_id = $1 order by status, created_at", [tripId]),
    q<Activity>("select * from activities where trip_id = $1 order by status, created_at", [tripId]),
  ]);
  return { hotels, restaurants, activities };
}

export async function loadMembers(q: Q, tripId: string): Promise<Member[]> {
  return q<Member>(
    `select m.user_id, m.role, m.joined_at, u.email, u.full_name from trip_members m join users u on u.id = m.user_id
     where m.trip_id = $1 order by (m.role = 'owner') desc, m.joined_at`,
    [tripId],
  );
}

export async function loadExpenses(q: Q, tripId: string) {
  const [expenses, splits] = await Promise.all([
    q<Expense>("select * from trip_expenses where trip_id = $1 order by created_at desc", [tripId]),
    q<Split>("select * from expense_splits where trip_id = $1", [tripId]),
  ]);
  return { expenses, splits };
}

export async function getPrefs(userId: string): Promise<Prefs> {
  const [p] = await withUser(userId, (q) => q<Prefs>("select * from user_preferences where user_id = $1", [userId]));
  return p;
}

/** Everything about a trip in one authorised read (used by trip pages and the concierge). */
export async function loadTripBundle(userId: string, tripId: string) {
  if (!isUuid(tripId)) return null;
  return withUser(userId, async (q) => {
    const trip = await tripRow(q, userId, tripId);
    if (!trip) return null;
    const [{ itinerary, days }, pools, { expenses, splits }, members] = await Promise.all([loadItinerary(q, tripId), loadPools(q, tripId), loadExpenses(q, tripId), loadMembers(q, tripId)]);
    return { trip, itinerary, days, ...pools, expenses, splits, members };
  });
}
export type TripBundle = NonNullable<Awaited<ReturnType<typeof loadTripBundle>>>;

export function budgetSummary(b: Pick<TripBundle, "trip" | "expenses">) {
  const total = b.expenses.reduce((a, e) => a + e.amount, 0);
  const by = (s: string) => b.expenses.filter((e) => e.status === s).reduce((a, e) => a + e.amount, 0);
  const days = Math.max(1, Math.round((Date.parse(b.trip.end_date) - Date.parse(b.trip.start_date)) / 86400000) + 1);
  const byCategory: Record<string, number> = {};
  for (const e of b.expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  return {
    total, estimated: by("estimated"), booked: by("booked"), paid: by("paid"), byCategory, days,
    remaining: b.trip.budget - total, perTraveler: total / b.trip.travelers, perDay: total / days,
    pct: b.trip.budget > 0 ? (total / b.trip.budget) * 100 : 0,
  };
}
