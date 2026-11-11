/**
 * On-demand forecast from Open-Meteo (no key needed). TripCraft does NOT monitor weather in the
 * background: this is fetched only when the traveler asks, and stamped with its fetch time.
 */
export type DayForecast = { date: string; tmax: number; tmin: number; rainChance: number | null; rainMm: number; code: number; wet: boolean; label: string };
export type Forecast = { days: DayForecast[]; source: "Open-Meteo"; fetched_at: string };

const LABELS: [number, string][] = [[0, "Clear"], [3, "Partly cloudy"], [48, "Fog"], [57, "Drizzle"], [67, "Rain"], [77, "Snow"], [82, "Showers"], [86, "Snow showers"], [99, "Thunderstorm"]];
const label = (code: number) => LABELS.find(([max]) => code <= max)?.[1] ?? "Mixed";

export async function getForecast(lat: number, lng: number, start: string, end: string): Promise<Forecast | { error: string }> {
  if (process.env.WEATHER_PROVIDER === "off") return { error: "Weather lookups are turned off." };
  const today = new Date();
  const horizon = new Date(today.getTime() + 15 * 86400000).toISOString().slice(0, 10);
  const from = start < today.toISOString().slice(0, 10) ? today.toISOString().slice(0, 10) : start;
  const to = end > horizon ? horizon : end;
  if (from > to) return { error: "These dates are beyond the 16-day forecast horizon. Check again closer to your trip." };
  try {
    const q = new URLSearchParams({ latitude: String(lat), longitude: String(lng), daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum", timezone: "auto", start_date: from, end_date: to });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const d = (await res.json()).daily;
    const days: DayForecast[] = d.time.map((date: string, i: number) => {
      const rainChance = d.precipitation_probability_max?.[i] ?? null;
      const rainMm = d.precipitation_sum?.[i] ?? 0;
      return { date, tmax: Math.round(d.temperature_2m_max[i]), tmin: Math.round(d.temperature_2m_min[i]), rainChance, rainMm, code: d.weather_code[i], wet: (rainChance ?? 0) >= 60 || rainMm >= 5, label: label(d.weather_code[i]) };
    });
    return { days, source: "Open-Meteo", fetched_at: new Date().toISOString() };
  } catch (e) {
    console.warn(JSON.stringify({ evt: "weather_error", message: String(e) }));
    return { error: "The weather service could not be reached. Try again later." };
  }
}
