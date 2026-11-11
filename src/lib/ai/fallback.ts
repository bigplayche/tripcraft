/**
 * Development fallback planner, used ONLY when OPENAI_API_KEY is not configured.
 * It assembles a plan from the hand-curated catalogue with simple, transparent rules.
 * Its output is stored with generated_by = 'demo-catalog' and labelled as a sample in the UI.
 */
import { DESTINATIONS, findDestination, CATALOG_REVIEWED, type CatalogFood, type CatalogPlace, type Destination, type Tier } from "@/lib/catalog";
import { haversineKm, nightsBetween } from "@/lib/utils";
import type { BudgetAdvice, DiscoverResult, TripPlan } from "./schemas";
import type { Prefs } from "@/lib/types";

type TripInput = { destination_name: string; start_date: string; end_date: string; travelers: number; budget: number; vacation_style: string | null; origin_city: string | null };

const STYLE_CATS: Record<string, string[]> = {
  Nightlife: ["Nightlife", "Theatre"],
  Adventure: ["Hiking", "Outdoor adventure", "Day trip", "Nature"],
  "Beach vacation": ["Beach", "Boat tour", "Relaxation"],
  "Food and culture": ["Food market", "Museum", "Local experience", "Landmark", "Temple"],
  "Family vacation": ["Park", "Museum", "Beach", "Nature", "Boat tour"],
  Romantic: ["Viewpoint", "Boat tour", "Garden", "Relaxation", "Neighbourhood walk"],
  Luxury: ["Relaxation", "Boat tour", "Theatre", "Museum"],
  "City exploration": ["Neighbourhood walk", "Landmark", "Viewpoint", "Shopping"],
  "Budget-friendly": ["Neighbourhood walk", "Park", "Viewpoint", "Food market"],
  "Solo travel": ["Neighbourhood walk", "Local experience", "Museum", "Hiking"],
};
const EVENING = new Set(["Nightlife", "Theatre"]);
const PACKING: Record<string, string[]> = {
  tropical: ["Lightweight breathable clothing", "Swimwear", "Reef-safe sunscreen", "Insect repellent", "Light rain jacket", "Sandals"],
  warm: ["Light layers", "Comfortable walking shoes", "Sunscreen", "Sunglasses", "Hat", "Light jacket for evenings"],
  mild: ["Layers for changeable weather", "Comfortable walking shoes", "Compact umbrella", "Light jacket", "Smart-casual outfit"],
  cool: ["Waterproof jacket", "Warm mid-layer", "Thermal base layer", "Hat and gloves", "Waterproof walking shoes", "Swimwear for geothermal pools"],
};
const COMMON_PACK = ["Passport / ID and copies", "Travel insurance details", "Phone charger and power adapter", "Reusable water bottle", "Any prescription medication", "Day bag"];

export function pickTier(d: Destination, t: TripInput, prefs?: Prefs | null): Tier {
  const nights = Math.max(1, nightsBetween(t.start_date, t.end_date));
  const rooms = Math.ceil(t.travelers / 2);
  const affordable = (tier: Tier) => (d.stays.find((s) => s.tier === tier)?.nightly ?? Infinity) * nights * rooms <= t.budget * 0.4;
  if (t.vacation_style === "Budget-friendly") return "budget";
  if ((t.vacation_style === "Luxury" || prefs?.hotel_category === "Luxury") && affordable("luxury")) return "luxury";
  return affordable("mid") ? "mid" : "budget";
}

export function demoPlan(t: TripInput, prefs?: Prefs | null): TripPlan {
  const d = findDestination(t.destination_name);
  const nights = Math.max(1, nightsBetween(t.start_date, t.end_date));
  const nDays = nightsBetween(t.start_date, t.end_date) + 1;
  const rooms = Math.ceil(t.travelers / 2);
  if (!d) return skeletonPlan(t, nDays);

  const tier = pickTier(d, t, prefs);
  const maxPrice = tier === "budget" ? 2 : tier === "mid" ? 3 : 4;
  const liked = new Set([...(STYLE_CATS[t.vacation_style ?? ""] ?? []), ...(prefs?.vacation_styles ?? []).flatMap((s) => STYLE_CATS[s] ?? [])]);
  const perDayActivityBudget = (t.budget / t.travelers / nDays) * 0.25;
  const score = (p: CatalogPlace) => (liked.has(p.category) ? 2 : 0) + ((p.cost ?? 0) <= perDayActivityBudget ? 1 : 0);
  const ranked = [...d.places].sort((a, b) => score(b) - score(a));
  const key = new Map<object, string>();
  d.places.forEach((p, i) => key.set(p, `a${i + 1}`));
  d.food.forEach((x, i) => key.set(x, `r${i + 1}`));

  const used = new Set<object>();
  const take = (pred: (p: CatalogPlace) => boolean, near?: CatalogPlace) => {
    const pool = ranked.filter((p) => !used.has(p) && pred(p));
    if (!pool.length) return null;
    const pick = near ? pool.slice(0, 4).sort((a, b) => haversineKm(a, near) - haversineKm(b, near))[0] : pool[0];
    used.add(pick);
    return pick;
  };
  const usedFood = new Set<object>();
  const eat = (near: { lat: number; lng: number }) => {
    let pool = d.food.filter((x) => !usedFood.has(x) && x.price <= maxPrice);
    if (!pool.length) {
      usedFood.clear();
      pool = d.food.filter((x) => x.price <= maxPrice);
    }
    const pick = pool.sort((a, b) => haversineKm(a, near) - haversineKm(b, near))[0];
    usedFood.add(pick);
    return pick;
  };
  const act = (p: CatalogPlace, slot: "morning" | "afternoon" | "evening", start: string) => ({
    slot, kind: "activity" as const, ref_key: key.get(p)!, title: p.name, description: p.description, start_time: start, duration_min: p.mins, est_cost_pp_usd: p.cost,
    transport_note: p.category === "Day trip" ? "Train, bus or an organised tour. Check schedules with the operator." : null,
  });
  const meal = (x: CatalogFood, slot: "afternoon" | "evening", start: string, label: string) => ({
    slot, kind: "restaurant" as const, ref_key: key.get(x)!, title: `${label} at ${x.name}`, description: x.description, start_time: start, duration_min: label === "Dinner" ? 90 : 60, est_cost_pp_usd: x.cost, transport_note: null,
  });
  const free = (slot: "morning" | "afternoon" | "evening", start: string, title: string, description: string) => ({ slot, kind: "free" as const, ref_key: null, title, description, start_time: start, duration_min: 120, est_cost_pp_usd: null, transport_note: null });
  const isShort = (p: CatalogPlace) => p.mins < 300 && !EVENING.has(p.category);
  const hotel = d.stays.find((s) => s.tier === tier) ?? d.stays[0];

  const days: TripPlan["days"] = [];
  let dayTrips = 0;
  for (let n = 1; n <= nDays; n++) {
    const items: TripPlan["days"][number]["items"] = [];
    const first = n === 1 && nDays > 1, last = n === nDays && nDays > 1;
    let title = "";
    if (first) {
      const a = take(isShort, hotel as never);
      items.push(free("morning", "10:00", "Arrive and settle in", "Travel day. Check in, unpack and get your bearings."));
      if (a) items.push(act(a, "afternoon", "15:30"));
      items.push(meal(eat(a ?? hotel), "evening", "19:30", "Dinner"));
      title = "Arrival";
    } else if (last) {
      const a = take((p) => isShort(p) && p.mins <= 120);
      if (a) items.push(act(a, "morning", "09:30"));
      else items.push(free("morning", "09:30", "A last wander", "Revisit a favourite spot or pick up souvenirs."));
      items.push(meal(eat(a ?? hotel), "afternoon", "12:30", "Lunch"));
      items.push(free("afternoon", "14:30", "Check out and depart", "Leave buffer time for the journey to the airport or station."));
      title = "Departure";
    } else {
      const trip = n % 3 === 0 && dayTrips < Math.floor(nDays / 3) ? take((p) => p.mins >= 300) : null;
      if (trip) {
        dayTrips++;
        items.push(act(trip, "morning", "08:30"));
        items.push(meal(eat(hotel), "evening", "19:30", "Dinner"));
        title = trip.name;
      } else {
        const m = take(isShort);
        const a = m ? take(isShort, m) : null;
        if (m) items.push(act(m, "morning", "09:30"));
        else items.push(free("morning", "09:30", "Slow morning", "No fixed plans. Explore the neighbourhood around your stay."));
        items.push(meal(eat(m ?? hotel), "afternoon", "12:30", "Lunch"));
        if (a) items.push(act(a, "afternoon", "14:30"));
        else items.push(free("afternoon", "14:30", "Free afternoon", "Time to relax or follow up on something you spotted earlier."));
        items.push(meal(eat(a ?? m ?? hotel), "evening", "19:30", "Dinner"));
        const night = t.vacation_style === "Nightlife" || n % 2 === 0 ? take((p) => EVENING.has(p.category)) : null;
        if (night) items.push(act(night, "evening", "21:30"));
        title = [m?.name, a?.name].filter(Boolean).join(" & ") || "At your own pace";
      }
    }
    days.push({ day_number: n, title, summary: `Day ${n} in ${d.name}`, items });
  }

  const sum = (kind: string) => days.flatMap((x) => x.items).filter((i) => i.kind === kind).reduce((a, i) => a + (i.est_cost_pp_usd ?? 0), 0) * t.travelers;
  const hotelCost = hotel.nightly * nights * rooms;
  const food = sum("restaurant") + 12 * t.travelers * nDays;
  const activities = sum("activity");
  const transport = 12 * t.travelers * nDays;
  const emergency = Math.round(t.budget * 0.07);
  const misc = Math.round(t.budget * 0.03);
  const ground = hotelCost + food + activities + transport + emergency + misc;
  const flights = Math.max(0, Math.min(t.budget * 0.35, t.budget - ground));
  const overBy = ground - t.budget;

  return {
    summary: `${nDays} days in ${d.name}: ${d.summary}`,
    assumptions: [
      "This is a sample plan assembled from TripCraft's curated catalogue because the AI planner is not connected. It is not personalised beyond your dates, budget, party size and style.",
      `Costs are rough planning estimates in USD (catalogue last reviewed ${CATALOG_REVIEWED}), not live prices. Confirm prices, opening hours and availability with each provider.`,
      `Accommodation assumes ${rooms} room${rooms > 1 ? "s" : ""} for ${t.travelers} traveler${t.travelers > 1 ? "s" : ""}.`,
      "The flight line is a budget allowance (what remains after ground costs), not a fare quote.",
      ...(overBy > 0 ? [`Estimated ground costs exceed your budget by about $${Math.round(overBy)}. Consider a cheaper stay, fewer paid activities or a shorter trip.`] : []),
    ],
    hotels: [hotel, ...d.stays.filter((s) => s !== hotel)].map((s, i) => ({ key: `h${i + 1}`, name: s.name, area: s.area, description: s.description, hotel_type: s.type, tier: s.tier, est_nightly_usd: s.nightly, distance_note: `${s.area} area`, lat: s.lat, lng: s.lng })),
    restaurants: d.food.map((x) => ({ key: key.get(x)!, name: x.name, cuisine: x.cuisine, price_level: x.price, description: x.description, address: null, est_cost_pp_usd: x.cost, lat: x.lat, lng: x.lng })),
    activities: d.places.map((x) => ({ key: key.get(x)!, name: x.name, category: x.category, description: x.description, address: null, est_cost_pp_usd: x.cost, duration_min: x.mins, indoor: x.indoor, lat: x.lat, lng: x.lng })),
    days,
    budget: [
      { category: "flights", amount_usd: Math.round(flights), note: "Allowance only, not a fare quote. Check a flight search for real prices." },
      { category: "hotel", amount_usd: Math.round(hotelCost), note: `${hotel.name}: about $${hotel.nightly}/night x ${nights} night${nights > 1 ? "s" : ""} x ${rooms} room${rooms > 1 ? "s" : ""} (estimate)` },
      { category: "food", amount_usd: Math.round(food), note: "Planned meals plus a $12 per person daily allowance for breakfast and snacks" },
      { category: "transportation", amount_usd: Math.round(transport), note: "Local transport allowance of $12 per person per day" },
      { category: "activities", amount_usd: Math.round(activities), note: "Estimated entry and tour costs for scheduled activities" },
      { category: "misc", amount_usd: misc, note: "Allowance for tips, SIM card and small extras" },
      { category: "emergency", amount_usd: emergency, note: "7% buffer for the unexpected" },
    ],
    savings_tips: [
      tier !== "budget" ? `Switching to ${d.stays.find((s) => s.tier === "budget")?.name ?? "a budget stay"} would save roughly $${Math.round((hotel.nightly - (d.stays.find((s) => s.tier === "budget")?.nightly ?? 0)) * nights * rooms)} on accommodation.` : "You're already on the most affordable stay option.",
      "Make lunch your main meal: set menus are usually cheaper than dinner.",
      "Many headline sights have free or discounted days. Check each venue's website.",
    ],
    packing_list: [...COMMON_PACK, ...PACKING[d.weather]],
  };
}

function skeletonPlan(t: TripInput, nDays: number): TripPlan {
  const share = (pct: number) => Math.round((t.budget * pct) / 100);
  return {
    summary: `A ${nDays}-day outline for ${t.destination_name}. Connect the AI planner to fill it with specific places.`,
    assumptions: [
      `${t.destination_name} is not in TripCraft's built-in catalogue and the AI planner is not connected, so this is an empty outline with no specific places.`,
      "Budget lines are simple percentage allowances of your total budget, not estimates of real prices.",
    ],
    hotels: [], restaurants: [], activities: [],
    days: Array.from({ length: nDays }, (_, i) => ({
      day_number: i + 1,
      title: i === 0 && nDays > 1 ? "Arrival" : i === nDays - 1 && nDays > 1 ? "Departure" : `Day ${i + 1}`,
      summary: "Add your own plans, or connect the AI planner to generate them.",
      items: (["morning", "afternoon", "evening"] as const).map((slot, k) => ({ slot, kind: "free" as const, ref_key: null, title: `Open ${slot}`, description: "Nothing scheduled yet.", start_time: ["09:30", "14:00", "19:00"][k], duration_min: 120, est_cost_pp_usd: null, transport_note: null })),
    })),
    budget: [
      { category: "flights", amount_usd: share(25), note: "Allowance: 25% of budget" },
      { category: "hotel", amount_usd: share(30), note: "Allowance: 30% of budget" },
      { category: "food", amount_usd: share(18), note: "Allowance: 18% of budget" },
      { category: "transportation", amount_usd: share(6), note: "Allowance: 6% of budget" },
      { category: "activities", amount_usd: share(12), note: "Allowance: 12% of budget" },
      { category: "misc", amount_usd: share(3), note: "Allowance: 3% of budget" },
      { category: "emergency", amount_usd: share(6), note: "Allowance: 6% of budget" },
    ],
    savings_tips: [],
    packing_list: COMMON_PACK,
  };
}

export type SurpriseInput = { origin: string; month: number; budget: number; travelers: number; weather: string; style: string; exclude: string[] };

export function demoDiscover(i: SurpriseInput): DiscoverResult {
  const scored = DESTINATIONS.filter((d) => !i.exclude.includes(d.name)).map((d) => {
    const nights = d.suggestedNights;
    const tier: Tier = i.style === "Luxury" ? "luxury" : i.style === "Budget-friendly" ? "budget" : "mid";
    const ground = (d.dailyCost[tier] * (nights + 1) + ((d.stays.find((s) => s.tier === tier)?.nightly ?? 0) * nights) / 2) * i.travelers;
    const reasons: string[] = [];
    let score = 0;
    if (d.styles.includes(i.style)) { score += 3; reasons.push(`a strong match for ${i.style.toLowerCase()} trips`); }
    if (i.weather === "any" || d.weather === i.weather) { score += 2; if (i.weather !== "any") reasons.push(`typically ${d.weather} weather`); }
    if (d.bestMonths.includes(i.month)) { score += 2; reasons.push("your month falls in its best season"); }
    if (ground <= i.budget * 0.7) { score += 2; reasons.push("ground costs sit comfortably inside your budget"); }
    else if (ground > i.budget) score -= 3;
    return { d, score, ground, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  return {
    destinations: scored.slice(0, 4).map(({ d, ground, reasons }) => ({
      name: d.name, country: d.country,
      why: reasons.length ? `Picked because it is ${reasons.join(", ")}.` : "A flexible all-rounder from our catalogue.",
      est_trip_budget_usd: Math.round(ground / 50) * 50,
      suggested_nights: d.suggestedNights,
      attractions: d.places.slice(0, 4).map((p) => p.name),
      best_season: d.bestSeason,
      weather_note: `Generally ${d.weather} climate. Check a forecast closer to your dates.`,
      lat: d.lat, lng: d.lng,
    })),
  };
}

export function demoBudgetAdvice(budget: number, byCategory: Record<string, number>, total: number): BudgetAdvice {
  const over = total - budget;
  const top = Object.entries(byCategory).filter(([c]) => c !== "emergency").sort((a, b) => b[1] - a[1]);
  const TIPS: Record<string, [string, string, number, BudgetAdvice["savings"][number]["experience_impact"]]> = {
    hotel: ["Choose a lower-tier stay", "Compare the stay options on the Places tab; location matters more than star rating for most itineraries.", 0.25, "low"],
    flights: ["Flex your flight dates", "Mid-week departures and nearby airports are often cheaper. Compare on a flight search engine.", 0.15, "none"],
    food: ["Make lunch the main meal", "Lunch menus are typically cheaper than dinner; mix in markets and bakeries.", 0.2, "low"],
    activities: ["Trim paid activities", "Keep the two or three you care most about and swap the rest for free walks and viewpoints.", 0.3, "medium"],
    transportation: ["Use transit passes", "Multi-day passes usually beat single tickets and taxis.", 0.25, "none"],
    shopping: ["Set a souvenir cap", "Decide a fixed amount before you go.", 0.4, "low"],
    nightlife: ["Pick your big night", "Choose one or two nights out rather than every evening.", 0.4, "low"],
    misc: ["Review small extras", "Roaming, airport transfers and tips add up; pre-book where it is cheaper.", 0.2, "none"],
  };
  return {
    summary: over > 0 ? `Your plan is about $${Math.round(over)} over your $${Math.round(budget)} budget. These rule-based suggestions use your category totals; connect the AI planner for advice specific to your itinerary.` : `Your plan is about $${Math.round(-over)} under budget. Here is where you could still trim if you want more headroom (rule-based suggestions).`,
    savings: top.slice(0, 4).filter(([c]) => TIPS[c]).map(([c, amt]) => ({ title: TIPS[c][0], detail: TIPS[c][1], category: c as never, est_saving_usd: Math.round(amt * TIPS[c][2]), experience_impact: TIPS[c][3] })),
    keep: ["Keep your emergency buffer. It is what makes a disrupted day a non-event."],
  };
}
