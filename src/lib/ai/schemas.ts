/**
 * Structured-output contracts for every AI task. All fields are required (nullable where
 * optional) so the schemas are valid for OpenAI strict JSON-schema mode.
 */
import { z } from "zod";

const CATEGORY = z.enum(["flights", "hotel", "food", "transportation", "activities", "shopping", "nightlife", "misc", "emergency"]);
const SLOT = z.enum(["morning", "afternoon", "evening"]);

export const HotelRec = z.object({
  key: z.string().describe("Short unique key, e.g. h1"),
  name: z.string().describe("Real, currently operating property. Never invent a property."),
  area: z.string(),
  description: z.string(),
  hotel_type: z.string().describe("Hotel, Boutique hotel, Resort, Hostel, Apartment, Riad…"),
  tier: z.enum(["budget", "mid", "luxury"]),
  est_nightly_usd: z.number().describe("Typical nightly rate estimate for the travel season. An estimate, not a quote."),
  distance_note: z.string().describe("Qualitative position relative to key sights, e.g. 'Short walk to the old town'. No invented minutes."),
  lat: z.number(),
  lng: z.number(),
});

export const RestaurantRec = z.object({
  key: z.string(),
  name: z.string(),
  cuisine: z.string(),
  price_level: z.number().describe("1 (cheap) to 4 (fine dining)"),
  description: z.string(),
  address: z.string().nullable().describe("Street or neighbourhood if confident, else null"),
  est_cost_pp_usd: z.number(),
  lat: z.number(),
  lng: z.number(),
});

export const ActivityRec = z.object({
  key: z.string(),
  name: z.string(),
  category: z.string().describe("Beach, Museum, Nightlife, Shopping, Hiking, Boat tour, Theme park, Local experience, Food tour, Outdoor adventure, Landmark…"),
  description: z.string(),
  address: z.string().nullable(),
  est_cost_pp_usd: z.number().nullable().describe("null when you have no reliable basis for a cost"),
  duration_min: z.number(),
  indoor: z.boolean(),
  lat: z.number(),
  lng: z.number(),
});

export const PlanItem = z.object({
  slot: SLOT,
  kind: z.enum(["activity", "restaurant", "transport", "free"]),
  ref_key: z.string().nullable().describe("key of the restaurant/activity this item uses, or null"),
  title: z.string(),
  description: z.string(),
  start_time: z.string().describe("24h HH:MM, local time"),
  duration_min: z.number(),
  est_cost_pp_usd: z.number().nullable(),
  transport_note: z.string().nullable().describe("How to get here from the previous stop (mode only, e.g. 'Metro line 2' or 'Short walk'). Do not state minutes or distances."),
});

export const PlanDay = z.object({
  day_number: z.number(),
  title: z.string(),
  summary: z.string(),
  items: z.array(PlanItem),
});

export const BudgetLine = z.object({
  category: CATEGORY,
  amount_usd: z.number().describe("Total for the whole party, whole trip"),
  note: z.string().describe("What the figure is based on. Say 'allowance' when it is not based on a specific price."),
});

export const TripPlan = z.object({
  summary: z.string(),
  assumptions: z.array(z.string()).describe("Every assumption and everything the traveler must confirm with a provider"),
  hotels: z.array(HotelRec),
  restaurants: z.array(RestaurantRec),
  activities: z.array(ActivityRec),
  days: z.array(PlanDay),
  budget: z.array(BudgetLine),
  savings_tips: z.array(z.string()),
  packing_list: z.array(z.string()),
});
export type TripPlan = z.infer<typeof TripPlan>;

export const DayPlan = z.object({
  title: z.string(),
  summary: z.string(),
  items: z.array(PlanItem),
  new_restaurants: z.array(RestaurantRec),
  new_activities: z.array(ActivityRec),
});
export type DayPlan = z.infer<typeof DayPlan>;

export const DiscoverResult = z.object({
  destinations: z.array(
    z.object({
      name: z.string(),
      country: z.string(),
      why: z.string().describe("Why this fits this traveler specifically"),
      est_trip_budget_usd: z.number().describe("Rough total for the party incl. a flight allowance. An estimate."),
      suggested_nights: z.number(),
      attractions: z.array(z.string()),
      best_season: z.string().nullable(),
      weather_note: z.string().describe("Typical conditions for the requested month (climate, not a forecast)"),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
});
export type DiscoverResult = z.infer<typeof DiscoverResult>;

export const BudgetAdvice = z.object({
  summary: z.string(),
  savings: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      category: CATEGORY,
      est_saving_usd: z.number(),
      experience_impact: z.enum(["none", "low", "medium", "high"]),
    }),
  ),
  keep: z.array(z.string()).describe("Things worth NOT cutting, and why"),
});
export type BudgetAdvice = z.infer<typeof BudgetAdvice>;

export const ConciergePlace = z.object({
  name: z.string(),
  kind: z.string().describe("restaurant, bar, activity, hotel, shop, sight…"),
  why: z.string(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  est_cost_pp_usd: z.number().nullable(),
  from_lookup: z.boolean().describe("true only if this exact place came from a search_places tool result in this conversation"),
});
export const ConciergeAnswer = z.object({
  reply: z.string().describe("Concise, friendly answer in plain text with short paragraphs or '- ' bullets. No markdown tables."),
  places: z.array(ConciergePlace),
  follow_ups: z.array(z.string()).describe("Up to 3 short suggested follow-up questions"),
});
export type ConciergeAnswer = z.infer<typeof ConciergeAnswer>;
export type ConciergePlaceOut = z.infer<typeof ConciergePlace> & { verified: boolean; source: string | null; rating?: number | null; url?: string | null; fetched_at?: string | null };
