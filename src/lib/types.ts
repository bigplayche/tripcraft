export type Role = "owner" | "editor" | "viewer";
export type Trip = {
  id: string; owner_id: string; title: string; destination_name: string; destination_country: string | null;
  dest_lat: number | null; dest_lng: number | null; origin_city: string | null; start_date: string; end_date: string;
  travelers: number; budget: number; currency: string; vacation_style: string | null; status: string; is_favorite: boolean;
  cover_image: string | null; notes: string | null; emergency_contacts: { name: string; phone: string }[];
  packing_list: { id: string; label: string; done: boolean }[]; created_at: string; updated_at: string;
  role?: Role; member_count?: number;
};
export type Itinerary = { id: string; trip_id: string; summary: string | null; assumptions: string[]; savings_tips: string[]; generated_by: string; budget_at_generation: number | null; generated_at: string };
export type Travel = { minutes: number; meters: number; mode: string; source: string; fetched_at: string };
export type Item = {
  id: string; day_id: string; trip_id: string; position: number; slot: "morning" | "afternoon" | "evening"; kind: "activity" | "restaurant" | "transport" | "free";
  title: string; description: string | null; start_time: string | null; duration_min: number | null; est_cost_pp: number | null;
  address: string | null; lat: number | null; lng: number | null; transport_note: string | null; travel_from_prev: Travel | null;
  restaurant_id: string | null; activity_id: string | null; source: string;
};
export type Day = { id: string; itinerary_id: string; trip_id: string; day_number: number; date: string | null; title: string | null; summary: string | null; items: Item[] };
type Rec = { id: string; trip_id: string; name: string; description: string | null; address: string | null; lat: number | null; lng: number | null; rating: number | null; rating_count: number | null; image_url: string | null; source: string; verified_at: string | null };
export type Hotel = Rec & { area: string | null; hotel_type: string | null; tier: "budget" | "mid" | "luxury" | null; est_nightly: number | null; distance_note: string | null; booking_url: string | null; selected: boolean };
export type Restaurant = Rec & { cuisine: string | null; price_level: number | null; est_cost_pp: number | null; website_url: string | null; status: "recommended" | "suggested"; suggested_by: string | null };
export type Activity = Rec & { category: string | null; est_cost_pp: number | null; duration_min: number | null; indoor: boolean | null; website_url: string | null; status: "recommended" | "suggested"; suggested_by: string | null };
export type Expense = { id: string; trip_id: string; created_by: string | null; paid_by: string | null; category: string; description: string; amount: number; status: "estimated" | "booked" | "paid"; is_shared: boolean; incurred_on: string | null; source: string; created_at: string };
export type Split = { id: string; expense_id: string; user_id: string; amount: number; settled: boolean };
export type Member = { user_id: string; role: Role; email: string; full_name: string | null; joined_at: string };
export type Prefs = { home_city: string | null; preferred_destinations: string[]; typical_budget: number | null; vacation_styles: string[]; hotel_category: string | null; food_preferences: string[]; nightlife_interest: number; adventure_interest: number; relaxation_interest: number; activities: string[] };
export type MapPoint = { id: string; kind: "hotel" | "restaurant" | "activity" | "nightlife" | "shopping" | "transport" | "saved"; name: string; lat: number; lng: number; description?: string | null; address?: string | null; image?: string | null; url?: string | null; day?: number | null; order?: number | null; verified?: boolean };
