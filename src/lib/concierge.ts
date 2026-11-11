/**
 * TripCraft Concierge: a trip-aware assistant.
 * - With OpenAI: tool-calling loop (place lookup, weather, itinerary edits) ending in a structured answer.
 * - Without: a small rule-based responder over the trip's own stored data, clearly labelled as a demo.
 * A place is only ever marked "verified" by this server when it came back from a provider lookup.
 */
import type OpenAI from "openai";
import { withUser, j } from "@/lib/db";
import { integrations } from "@/lib/env";
import { assertAiQuota, recordUsage } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { budgetSummary, getPrefs, loadTripBundle, type TripBundle } from "@/lib/data";
import { haversineKm, money, type ActionResult } from "@/lib/utils";
import { PROMPTS } from "@/lib/ai/prompts";
import { ConciergeAnswer, type ConciergePlaceOut } from "@/lib/ai/schemas";
import { aiModel, extraParams, jsonSchemaFormat, openai } from "@/lib/ai/openai";
import { searchPlaces, type PlaceResult } from "@/lib/maps/places";
import { getForecast } from "@/lib/weather";
import { fail, tripBrief } from "@/lib/planner";
import { optimizeDayOrder } from "@/lib/itinerary-ops";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; places: ConciergePlaceOut[]; meta: { mode?: "ai" | "demo"; follow_ups?: string[]; sources?: string[]; changed?: boolean }; created_at: string };

function tripContext(b: TripBundle) {
  const s = budgetSummary(b);
  const hotel = b.hotels.find((h) => h.selected);
  return [
    "=== CURRENT TRIP ===",
    tripBrief(b.trip, null),
    `Selected hotel: ${hotel ? `${hotel.name}, ${hotel.area ?? ""} (~$${hotel.est_nightly}/night estimate${hotel.verified_at ? "" : ", unverified"})` : "none chosen"}`,
    `Other stay options: ${b.hotels.filter((h) => !h.selected).map((h) => `${h.name} (~$${h.est_nightly})`).join("; ") || "none"}`,
    `Budget: planned $${Math.round(s.total)} of $${b.trip.budget} (${Math.round(s.pct)}%), remaining $${Math.round(s.remaining)}. By category: ${Object.entries(s.byCategory).map(([k, v]) => `${k} $${Math.round(v)}`).join(", ") || "no expenses yet"}`,
    "Itinerary:",
    ...b.days.map((d) => `Day ${d.day_number} (${d.date}): ${d.items.map((i) => `${i.start_time ?? ""} ${i.title}${i.est_cost_pp ? ` ~$${i.est_cost_pp}pp` : ""}`).join(" | ") || "empty"}`),
    `Unscheduled activity pool: ${b.activities.filter((a) => !b.days.some((d) => d.items.some((i) => i.activity_id === a.id))).map((a) => `${a.name} (${a.category}${a.indoor ? ", indoor" : ""}${a.est_cost_pp != null ? `, ~$${a.est_cost_pp}pp` : ""})`).join("; ") || "none"}`,
    `Restaurant pool: ${b.restaurants.map((r) => `${r.name} (${r.cuisine}, ${"$".repeat(r.price_level ?? 2)})`).join("; ") || "none"}`,
    `Your role on this trip: ${b.trip.role}`,
  ].join("\n");
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "search_places", strict: true, description: "Look up real places from Google Places near the trip destination or hotel. Returns name, address, rating, price level and coordinates with a fetch timestamp.", parameters: { type: "object", additionalProperties: false, required: ["query", "near"], properties: { query: { type: "string", description: "e.g. 'romantic italian restaurant' or 'rooftop bar'" }, near: { type: "string", enum: ["hotel", "destination"] } } } } },
  { type: "function", function: { name: "get_weather_forecast", strict: true, description: "Daily forecast for the destination for a date range (max 16 days ahead).", parameters: { type: "object", additionalProperties: false, required: ["start_date", "end_date"], properties: { start_date: { type: "string" }, end_date: { type: "string" } } } } },
  { type: "function", function: { name: "add_itinerary_item", strict: true, description: "Add an item to a day of the traveler's itinerary. Only when the traveler asks.", parameters: { type: "object", additionalProperties: false, required: ["day_number", "slot", "kind", "title", "description", "est_cost_pp_usd", "lat", "lng"], properties: { day_number: { type: "number" }, slot: { type: "string", enum: ["morning", "afternoon", "evening"] }, kind: { type: "string", enum: ["activity", "restaurant"] }, title: { type: "string" }, description: { type: "string" }, est_cost_pp_usd: { type: ["number", "null"] }, lat: { type: ["number", "null"] }, lng: { type: ["number", "null"] } } } } },
  { type: "function", function: { name: "optimize_day_order", strict: true, description: "Reorder one day's stops to reduce backtracking (uses straight-line distance between stops). Only when the traveler asks.", parameters: { type: "object", additionalProperties: false, required: ["day_number"], properties: { day_number: { type: "number" } } } } },
  { type: "function", function: { name: "save_place", strict: true, description: "Save a place to the traveler's saved places. Only when asked.", parameters: { type: "object", additionalProperties: false, required: ["name", "kind", "note", "lat", "lng"], properties: { name: { type: "string" }, kind: { type: "string" }, note: { type: "string" }, lat: { type: ["number", "null"] }, lng: { type: ["number", "null"] } } } } },
];

async function aiAnswer(userId: string, b: TripBundle | null, history: ChatMessage[], message: string) {
  const model = aiModel();
  const prefs = await getPrefs(userId);
  const hotel = b?.hotels.find((h) => h.selected);
  const dest = b?.trip.dest_lat != null && b.trip.dest_lng != null ? { lat: b.trip.dest_lat, lng: b.trip.dest_lng } : null;
  const looked = new Map<string, PlaceResult>();
  const sources = new Set<string>();
  let changed = false;

  const run = async (name: string, a: Record<string, never>): Promise<unknown> => {
    if (name === "search_places") {
      const near = a.near === "hotel" && hotel?.lat != null && hotel.lng != null ? { lat: hotel.lat, lng: hotel.lng } : dest;
      const r = await searchPlaces(`${a.query}${b ? ` in ${b.trip.destination_name}` : ""}`, near, 6);
      if (!r) return { unavailable: true, note: "Place lookup is not configured or failed. Any places you suggest must be labelled unverified." };
      r.forEach((p) => looked.set(p.name.toLowerCase(), p));
      sources.add("Google Places");
      return { fetched_at: new Date().toISOString(), results: r.map(({ name, address, rating, rating_count, price_level, lat, lng }) => ({ name, address, rating, rating_count, price_level, lat, lng })) };
    }
    if (name === "get_weather_forecast") {
      if (!dest) return { unavailable: true, note: "No coordinates for this destination." };
      const f = await getForecast(dest.lat, dest.lng, a.start_date, a.end_date);
      if (!("error" in f)) sources.add("Open-Meteo");
      return f;
    }
    if (!b) return { error: "No trip is selected in this conversation." };
    if (b.trip.role === "viewer" && name !== "save_place") return { error: "The traveler is a viewer on this trip and cannot edit it." };
    if (name === "add_itinerary_item") {
      const day = b.days.find((d) => d.day_number === Math.round(a.day_number));
      if (!day) return { error: "No such day." };
      await withUser(userId, (q) =>
        q(`insert into itinerary_items (day_id, trip_id, position, slot, kind, title, description, est_cost_pp, lat, lng, source) values ($1,$2,(select coalesce(max(position),0)+1 from itinerary_items where day_id=$1),$3,$4,$5,$6,$7,$8,$9,'concierge')`,
          [day.id, b.trip.id, a.slot, a.kind, String(a.title).slice(0, 200), a.description, a.est_cost_pp_usd, a.lat, a.lng]));
      changed = true;
      return { ok: true };
    }
    if (name === "optimize_day_order") {
      const day = b.days.find((d) => d.day_number === Math.round(a.day_number));
      if (!day) return { error: "No such day." };
      const r = await optimizeDayOrder(userId, b.trip.id, day.id);
      changed ||= r.ok;
      return r;
    }
    if (name === "save_place") {
      await withUser(userId, (q) => q("insert into saved_places (user_id, trip_id, name, kind, note, lat, lng, source) values ($1,$2,$3,$4,$5,$6,$7,'concierge')", [userId, b.trip.id, String(a.name).slice(0, 200), a.kind, a.note, a.lat, a.lng]));
      return { ok: true };
    }
    return { error: "unknown tool" };
  };

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: `${PROMPTS.concierge}\n\nToday is ${new Date().toISOString().slice(0, 10)}.\nTraveler preferences: food=${prefs?.food_preferences.join(", ") || "none stated"}; styles=${prefs?.vacation_styles.join(", ") || "none"}; activities=${prefs?.activities.join(", ") || "none"}.\n\n${b ? tripContext(b) : "No trip is attached to this conversation. Help with general travel questions and suggest creating a trip."}` },
    ...history.slice(-14).map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];
  let inTok = 0, outTok = 0;
  for (let step = 0; step < 5; step++) {
    const res = await openai().chat.completions.create({ model, messages, tools: TOOLS, response_format: jsonSchemaFormat("concierge_answer", ConciergeAnswer), max_completion_tokens: 6000, ...extraParams() });
    inTok += res.usage?.prompt_tokens ?? 0;
    outTok += res.usage?.completion_tokens ?? 0;
    const msg = res.choices[0].message;
    if (msg.tool_calls?.length && step < 4) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let out: unknown;
        try {
          out = await run(tc.function.name, JSON.parse(tc.function.arguments || "{}"));
        } catch (e) {
          out = { error: String(e) };
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
      }
      continue;
    }
    await recordUsage(userId, "concierge", model, inTok, outTok);
    const parsed = ConciergeAnswer.safeParse(JSON.parse(msg.content || "{}"));
    if (!parsed.success) return { reply: msg.content || "Sorry, I couldn't put that answer together. Please try again.", places: [], meta: { mode: "ai" as const, changed } };
    const places: ConciergePlaceOut[] = parsed.data.places.slice(0, 8).map((p) => {
      const hit = looked.get(p.name.toLowerCase());
      return hit
        ? { ...p, address: hit.address, lat: hit.lat, lng: hit.lng, from_lookup: true, verified: true, source: "Google Places", rating: hit.rating, url: hit.maps_url, fetched_at: hit.fetched_at }
        : { ...p, from_lookup: false, verified: false, source: null };
    });
    return { reply: parsed.data.reply, places, meta: { mode: "ai" as const, follow_ups: parsed.data.follow_ups.slice(0, 3), sources: [...sources], changed } };
  }
  throw new Error("concierge loop did not finish");
}

/* ---------------- demo responder (no OpenAI key) ---------------- */

async function demoAnswer(b: TripBundle | null, message: string) {
  const meta = { mode: "demo" as const, follow_ups: ["How is my budget looking?", "What should I pack?", "Find activities under $20"], sources: [] as string[] };
  if (!b) return { reply: "I'm running in demo mode without an AI model, so I can only answer questions about a specific trip's stored plan. Pick a trip above, or create one from Home.", places: [], meta };
  const m = message.toLowerCase();
  const hotel = b.hotels.find((h) => h.selected);
  const near = (x: { lat: number | null; lng: number | null }) => (hotel?.lat != null && hotel.lng != null && x.lat != null && x.lng != null ? haversineKm({ lat: hotel.lat, lng: hotel.lng }, { lat: x.lat, lng: x.lng }) : 999);
  const place = (x: { name: string; description: string | null; address: string | null; lat: number | null; lng: number | null; est_cost_pp: number | null; verified_at: string | null }, kind: string): ConciergePlaceOut => ({ name: x.name, kind, why: x.description ?? "", address: x.address, lat: x.lat, lng: x.lng, est_cost_pp_usd: x.est_cost_pp, from_lookup: false, verified: !!x.verified_at, source: "Your trip plan" });
  const s = budgetSummary(b);
  const under = m.match(/under \$?(\d+)/);

  if (/budget|spend|afford|money|cost/.test(m) && !under) {
    const top = Object.entries(s.byCategory).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${money(v)}`).join(", ");
    return { reply: `You've planned ${money(s.total)} of your ${money(b.trip.budget)} budget (${Math.round(s.pct)}%). ${s.remaining >= 0 ? `${money(s.remaining)} is still unallocated.` : `That's ${money(-s.remaining)} over.`}\n\nBiggest categories: ${top || "none yet"}.\nPer traveler: ${money(s.perTraveler)}. Per day: ${money(s.perDay)}.\n\nMost figures are estimates until you mark them booked or paid in the Budget tab.`, places: [], meta };
  }
  if (/pack/.test(m)) {
    const list = b.trip.packing_list.map((p) => `- ${p.label}`).join("\n");
    return { reply: list ? `Here's the packing list saved on this trip:\n${list}\n\nYou can tick items off in the Companion tab.` : "There's no packing list on this trip yet. Generate the itinerary first, or add items in the Companion tab.", places: [], meta };
  }
  if (/rain|weather|forecast/.test(m)) {
    const indoor = b.activities.filter((a) => a.indoor).slice(0, 4);
    let lead = "I couldn't fetch a forecast right now.";
    if (b.trip.dest_lat != null && b.trip.dest_lng != null) {
      const f = await getForecast(b.trip.dest_lat, b.trip.dest_lng, b.trip.start_date, b.trip.end_date);
      if ("error" in f) lead = f.error;
      else {
        meta.sources.push("Open-Meteo");
        const wet = f.days.filter((d) => d.wet);
        lead = wet.length ? `Open-Meteo's forecast shows likely rain on ${wet.map((d) => d.date).join(", ")}.` : `Open-Meteo's forecast shows no significant rain for ${f.days[0].date} to ${f.days[f.days.length - 1].date}.`;
      }
    }
    return { reply: `${lead}\n\n${indoor.length ? "Indoor options already in your plan's pool:" : "Your plan has no indoor alternatives saved yet."}`, places: indoor.map((a) => place(a, "activity")), meta };
  }
  if (under) {
    const max = Number(under[1]);
    const hits = b.activities.filter((a) => a.est_cost_pp != null && a.est_cost_pp <= max).sort((a, c) => (a.est_cost_pp ?? 0) - (c.est_cost_pp ?? 0)).slice(0, 5);
    return { reply: hits.length ? `Activities in your plan estimated at $${max} or less per person (estimates, confirm with the venue):` : `Nothing in your plan's activity pool is estimated under $${max}.`, places: hits.map((a) => place(a, "activity")), meta };
  }
  if (/cheaper hotel|cheaper stay|hotel/.test(m)) {
    const cheaper = b.hotels.filter((h) => !h.selected && (h.est_nightly ?? 1e9) < (hotel?.est_nightly ?? 1e9));
    return { reply: cheaper.length ? `Cheaper stay options already in your plan (nightly rates are estimates; check the booking link for real prices):` : "Your selected stay is already the least expensive option in this plan.", places: cheaper.map((h) => ({ ...place({ ...h, est_cost_pp: h.est_nightly }, "hotel"), why: `${h.area ?? ""} · about ${money(h.est_nightly)}/night (estimate)` })), meta };
  }
  if (/restaurant|eat|dinner|lunch|food|romantic/.test(m)) {
    const hits = [...b.restaurants].sort((a, c) => near(a) - near(c)).slice(0, 4);
    return { reply: hits.length ? `From your plan's restaurant list${hotel ? `, closest to ${hotel.name} first (straight-line distance)` : ""}:` : "There are no restaurants in this plan yet.", places: hits.map((r) => place(r, "restaurant")), meta };
  }
  if (/tonight|fun|nightlife|bar|rooftop|evening/.test(m)) {
    const hits = b.activities.filter((a) => /night|theatre|bar/i.test(a.category ?? "")).slice(0, 4);
    return { reply: hits.length ? "Evening ideas from your plan:" : "Your plan doesn't include evening venues yet.", places: hits.map((a) => place(a, "nightlife")), meta };
  }
  if (/family|kid|child/.test(m)) {
    const hits = b.activities.filter((a) => /park|museum|beach|nature|boat/i.test(a.category ?? "")).slice(0, 4);
    return { reply: hits.length ? "Options from your plan that usually work well with children (check age rules with each venue):" : "Nothing family-oriented is in this plan's pool yet.", places: hits.map((a) => place(a, "activity")), meta };
  }
  if (/driving|rearrange|reorder|route/.test(m)) {
    return { reply: "Open the Itinerary tab and use the reorder button on a day: it reorders stops to reduce backtracking. Real travel times come from the routing provider on the Map tab.", places: [], meta };
  }
  return { reply: `I'm the demo concierge: no AI model is connected, so I can only answer from the plan stored for ${b.trip.destination_name}. I can help with budget status, packing, weather and rainy-day swaps, activities under a price, restaurants near your hotel, evening ideas and cheaper stays.\n\nSet OPENAI_API_KEY to unlock open-ended answers.`, places: [], meta };
}

/* ---------------- public entry point ---------------- */

export async function sendConciergeMessage(userId: string, input: { conversationId: string | null; tripId: string | null; message: string }): Promise<ActionResult<{ conversationId: string; reply: ChatMessage }>> {
  try {
    const rl = rateLimit(`chat:${userId}`, 12, 60_000);
    if (!rl.ok) return { ok: false, error: `You're sending messages quickly. Try again in ${rl.retryAfter}s.`, code: "rate_limited" };
    await assertAiQuota(userId, "concierge");

    let convId = input.conversationId, tripId = input.tripId, history: ChatMessage[] = [];
    if (convId) {
      const rows = await withUser(userId, async (q) => {
        const [c] = await q("select id, trip_id from chat_conversations where id = $1", [convId]);
        return c ? { c, msgs: await q<ChatMessage>("select * from chat_messages where conversation_id = $1 order by created_at", [convId]) } : null;
      });
      if (!rows) return { ok: false, error: "Conversation not found." };
      tripId = rows.c.trip_id;
      history = rows.msgs;
    }
    const bundle = tripId ? await loadTripBundle(userId, tripId) : null;
    if (tripId && !bundle) return { ok: false, error: "Trip not found." };

    const ai = integrations().openai;
    const answer = ai ? await aiAnswer(userId, bundle, history, input.message) : await demoAnswer(bundle, input.message);
    if (!ai) await recordUsage(userId, "concierge", "demo");

    const reply = await withUser(userId, async (q) => {
      if (!convId) {
        const [c] = await q<{ id: string }>("insert into chat_conversations (user_id, trip_id, title) values ($1,$2,$3) returning id", [userId, tripId, input.message.slice(0, 80)]);
        convId = c.id;
      } else await q("update chat_conversations set updated_at = now() where id = $1", [convId]);
      await q("insert into chat_messages (conversation_id, user_id, role, content) values ($1,$2,'user',$3)", [convId, userId, input.message]);
      const [m] = await q<ChatMessage>("insert into chat_messages (conversation_id, user_id, role, content, places, meta) values ($1,$2,'assistant',$3,$4::jsonb,$5::jsonb) returning *", [convId, userId, answer.reply, j(answer.places), j(answer.meta)]);
      return m;
    });
    return { ok: true, data: { conversationId: convId!, reply } };
  } catch (e) {
    return fail(e);
  }
}
