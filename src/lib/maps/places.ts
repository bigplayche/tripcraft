/**
 * Google Places (New) text search. Server-side only; the key never reaches the browser.
 * Everything returned is stamped with its source and fetch time.
 */
export type PlaceResult = {
  id: string; name: string; address: string | null; lat: number | null; lng: number | null;
  rating: number | null; rating_count: number | null; price_level: number | null;
  website: string | null; maps_url: string | null; photo: string | null;
  source: "google_places"; fetched_at: string;
};

const PRICE: Record<string, number> = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const cache = new Map<string, { at: number; data: PlaceResult[] }>();
const TTL = 1000 * 60 * 60 * 12;

export const placesConfigured = () => !!process.env.GOOGLE_MAPS_API_KEY;

export async function searchPlaces(query: string, near?: { lat: number; lng: number } | null, max = 5): Promise<PlaceResult[] | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const ck = `${query}|${near?.lat.toFixed(2)},${near?.lng.toFixed(2)}|${max}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.googleMapsUri,places.photos",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: max, ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } } } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(JSON.stringify({ evt: "places_error", status: res.status }));
      return null;
    }
    const json = (await res.json()) as { places?: Record<string, never>[] };
    const fetched_at = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: PlaceResult[] = (json.places ?? []).map((p: any) => ({
      id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? null,
      lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
      rating: p.rating ?? null, rating_count: p.userRatingCount ?? null, price_level: PRICE[p.priceLevel] ?? null,
      website: p.websiteUri ?? null, maps_url: p.googleMapsUri ?? null,
      photo: p.photos?.[0]?.name ? `/api/place-photo?name=${encodeURIComponent(p.photos[0].name)}` : null,
      source: "google_places", fetched_at,
    }));
    cache.set(ck, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.warn(JSON.stringify({ evt: "places_error", message: String(e) }));
    return null;
  }
}

/** Geocode a free-text destination via Places. Returns null when unconfigured or not found. */
export async function geocodeDestination(name: string) {
  const r = await searchPlaces(name, null, 1);
  const p = r?.[0];
  return p?.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, name: p.name, address: p.address } : null;
}

/** A search link the traveler can use to confirm price and availability. Never a fabricated deep link. */
export function bookingSearchUrl(hotel: string, destination: string, checkin: string, checkout: string, adults: number) {
  const q = new URLSearchParams({ ss: `${hotel}, ${destination}`, checkin, checkout, group_adults: String(adults) });
  return `https://www.booking.com/searchresults.html?${q}`;
}
export const mapsSearchUrl = (name: string, near?: string | null) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(near ? `${name}, ${near}` : name)}`;
