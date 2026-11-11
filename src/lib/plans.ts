/** Plan catalogue. Safe to import on the client for display; enforcement lives in lib/entitlements.ts. */
export type PlanId = "free" | "plus" | "pro";

export type PlanLimits = {
  activeTrips: number;
  generationsPerMonth: number;
  conciergePerMonth: number;
  groupTrips: number;
  dayRegeneration: boolean;
  routePlanning: boolean;
  documents: boolean;
  budgetAdvice: boolean;
  budgetComparison: boolean;
};

export const PLANS: Record<PlanId, { name: string; tagline: string; monthly: number; yearly: number; limits: PlanLimits; features: string[] }> = {
  free: {
    name: "Free Explorer",
    tagline: "Plan your first trip",
    monthly: 0,
    yearly: 0,
    limits: { activeTrips: 1, generationsPerMonth: 3, conciergePerMonth: 15, groupTrips: 0, dayRegeneration: false, routePlanning: false, documents: false, budgetAdvice: false, budgetComparison: false },
    features: ["One active trip", "Basic AI itinerary generation", "Destination discovery", "15 concierge messages / month", "Basic budget planner", "Save places you like"],
  },
  plus: {
    name: "Traveler Plus",
    tagline: "Everything for frequent travelers",
    monthly: 7.99,
    yearly: 59.99,
    limits: { activeTrips: 50, generationsPerMonth: 30, conciergePerMonth: 300, groupTrips: 1, dayRegeneration: true, routePlanning: true, documents: true, budgetAdvice: true, budgetComparison: false },
    features: ["Unlimited saved trips (fair use: 50)", "Full itinerary builder with day regeneration", "AI concierge: 300 messages / month", "Route planning with real travel times", "Budget management with AI savings advice", "Group trip planning (one group trip)", "Packing lists & private travel documents"],
  },
  pro: {
    name: "TripCraft Pro",
    tagline: "For planners, hosts and big groups",
    monthly: 14.99,
    yearly: 119.99,
    limits: { activeTrips: 200, generationsPerMonth: 100, conciergePerMonth: 1500, groupTrips: 50, dayRegeneration: true, routePlanning: true, documents: true, budgetAdvice: true, budgetComparison: true },
    features: ["Everything in Traveler Plus", "Highest AI limits: 1,500 messages / month", "Advanced itinerary optimization", "Multiple group trips", "Budget comparisons across stay options", "Priority access to new features"],
  },
};

export const TRIP_PASS = { price: 14.99, days: 30, name: "Trip Pass" };

export const VACATION_STYLES = ["Luxury", "Budget-friendly", "Romantic", "Family vacation", "Adventure", "Beach vacation", "City exploration", "Nightlife", "Food and culture", "Solo travel"] as const;

export const EXPENSE_CATEGORIES = [
  { id: "flights", label: "Flights" },
  { id: "hotel", label: "Hotel" },
  { id: "food", label: "Restaurants & food" },
  { id: "transportation", label: "Transportation" },
  { id: "activities", label: "Activities" },
  { id: "shopping", label: "Shopping" },
  { id: "nightlife", label: "Nightlife" },
  { id: "misc", label: "Miscellaneous" },
  { id: "emergency", label: "Emergency buffer" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export const HOTEL_CATEGORIES = ["Budget", "Mid-range", "Boutique", "Luxury", "Resort", "Apartment"] as const;
export const FOOD_PREFERENCES = ["Local cuisine", "Street food", "Fine dining", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "Seafood", "Coffee & bakeries"] as const;
export const ACTIVITY_TYPES = ["Beaches", "Museums", "Nightlife", "Shopping", "Hiking", "Boat tours", "Theme parks", "Local experiences", "Food tours", "Outdoor adventures", "Wellness & spas", "Live music"] as const;
