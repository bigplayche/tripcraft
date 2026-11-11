/**
 * Travel times between stops. These always come from a routing provider:
 *   1. Google Routes API when GOOGLE_MAPS_API_KEY is set (walk / drive / transit)
 *   2. OSRM (OpenStreetMap) public demo server as a development fallback (driving only)
 * If neither answers we return null and the UI shows straight-line distance only, labelled as such.
 */
export type LatLng = { lat: number; lng: number };
export type Leg = { minutes: number; meters: number };
export type RouteResult = { legs: Leg[]; path: [number, number][]; mode: TravelMode; source: string; fetched_at: string };
export type TravelMode = "walk" | "drive" | "transit";

export async function computeRoute(stops: LatLng[], mode: TravelMode): Promise<RouteResult | { error: string }> {
  if (stops.length < 2) return { error: "Add at least two stops with a location to plan a route." };
  const key = process.env.GOOGLE_MAPS_API_KEY;
  try {
    if (key) return await google(stops, mode, key);
    if (process.env.OSRM_URL === "off") return { error: "No routing provider is configured." };
    if (mode !== "drive") return { error: "Walking and transit times need Google Routes (set GOOGLE_MAPS_API_KEY). The development fallback only supports driving." };
    return await osrm(stops);
  } catch (e) {
    console.warn(JSON.stringify({ evt: "routing_error", message: String(e) }));
    return { error: "The routing provider could not be reached. Travel times are unavailable right now." };
  }
}

async function google(stops: LatLng[], mode: TravelMode, key: string): Promise<RouteResult> {
  const wp = (s: LatLng) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } });
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline" },
    body: JSON.stringify({
      origin: wp(stops[0]), destination: wp(stops[stops.length - 1]), intermediates: stops.slice(1, -1).map(wp),
      travelMode: mode === "walk" ? "WALK" : mode === "transit" ? "TRANSIT" : "DRIVE",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`routes ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error("no route");
  return {
    legs: route.legs.map((l: { duration: string; distanceMeters?: number }) => ({ minutes: Math.round(parseInt(l.duration) / 60), meters: l.distanceMeters ?? 0 })),
    path: decodePolyline(route.polyline?.encodedPolyline ?? ""),
    mode, source: "Google Routes", fetched_at: new Date().toISOString(),
  };
}

async function osrm(stops: LatLng[]): Promise<RouteResult> {
  const base = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/$/, "");
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const res = await fetch(`${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`osrm ${res.status}`);
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error("no route");
  return {
    legs: route.legs.map((l: { duration: number; distance: number }) => ({ minutes: Math.round(l.duration / 60), meters: Math.round(l.distance) })),
    path: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
    mode: "drive", source: "OSRM (OpenStreetMap)", fetched_at: new Date().toISOString(),
  };
}

function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}
