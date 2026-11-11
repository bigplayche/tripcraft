/**
 * Exercises the real OpenAI code path (SDK calls, structured-output parsing, tool loop,
 * persistence, metering) against a local mock of the Chat Completions endpoint.
 * It proves our side of the contract; it does not prove model quality. Run: npm run test:ai
 */
import http from "node:http";
import { demoPlan } from "../src/lib/ai/fallback";

const requests: { tools: boolean; schema: string | undefined; hasToolResult: boolean }[] = [];
const trip = { destination_name: "Lisbon", start_date: "2027-05-01", end_date: "2027-05-04", travelers: 2, budget: 3000, vacation_style: "Romantic", origin_city: "Chicago" };

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body);
    const schema = j.response_format?.json_schema?.name as string | undefined;
    const hasToolResult = j.messages.some((m: { role: string }) => m.role === "tool");
    requests.push({ tools: !!j.tools, schema, hasToolResult });
    let message: Record<string, unknown>;
    if (schema === "trip_plan") message = { role: "assistant", content: JSON.stringify(demoPlan(trip)) };
    else if (schema === "concierge_answer" && !hasToolResult)
      message = { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "search_places", arguments: JSON.stringify({ query: "romantic restaurant", near: "hotel" }) } }] };
    else message = { role: "assistant", content: JSON.stringify({ reply: "Try A Cevicheria; I could not verify it live.", places: [{ name: "A Cevicheria", kind: "restaurant", why: "Close to your stay", address: null, lat: 38.7163, lng: -9.1487, est_cost_pp_usd: 40, from_lookup: true }], follow_ups: ["Book it?"] }) };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "x", object: "chat.completion", model: j.model, choices: [{ index: 0, finish_reason: message.tool_calls ? "tool_calls" : "stop", message }], usage: { prompt_tokens: 1200, completion_tokens: 800, total_tokens: 2000 } }));
  });
});

let failed = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`); if (!ok) failed++; };

async function main() {
  await new Promise<void>((r) => server.listen(0, r));
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  process.env.PGLITE_DIR = "memory";
  const { asService, withUser } = await import("../src/lib/db");
  const { generateItinerary } = await import("../src/lib/planner");
  const { sendConciergeMessage } = await import("../src/lib/concierge");
  const { loadTripBundle } = await import("../src/lib/data");

  const userId = await asService(async (q) => (await q("insert into auth.users (email) values ('ai@test.dev') returning id"))[0].id as string);
  const tripId = await withUser(userId, async (q) => (await q("insert into trips (owner_id,title,destination_name,origin_city,start_date,end_date,travelers,budget,vacation_style) values ($1,'T',$2,$3,$4,$5,$6,$7,$8) returning id", [userId, trip.destination_name, trip.origin_city, trip.start_date, trip.end_date, trip.travelers, trip.budget, trip.vacation_style]))[0].id as string);

  const gen = await generateItinerary(userId, tripId);
  check("AI generation succeeds through the OpenAI SDK", gen.ok && gen.data?.mode === "ai", JSON.stringify(gen));
  check("request used strict structured output", requests[0]?.schema === "trip_plan");
  const b = (await loadTripBundle(userId, tripId))!;
  check("plan persisted: itinerary, 4 days, pools, budget lines", b.itinerary?.generated_by.startsWith("openai:") === true && b.days.length === 4 && b.hotels.length === 3 && b.restaurants.length > 0 && b.expenses.length > 4);
  check("scheduled items are linked to recommendation rows with coordinates", b.days.flatMap((d) => d.items).filter((i) => i.kind !== "free").every((i) => (i.activity_id || i.restaurant_id) && i.lat != null));
  check("exactly one stay is selected and has a booking search link", b.hotels.filter((h) => h.selected).length === 1 && b.hotels.every((h) => h.booking_url?.includes("booking.com/searchresults")));
  check("no rating is stored for unverified places", [...b.hotels, ...b.restaurants, ...b.activities].every((x) => x.rating == null && x.verified_at == null));

  const chat = await sendConciergeMessage(userId, { conversationId: null, tripId, message: "Find me a romantic restaurant near my hotel" });
  check("concierge completes a tool-call round trip", chat.ok && requests.some((r) => r.schema === "concierge_answer" && r.hasToolResult), JSON.stringify(chat).slice(0, 200));
  const place = chat.ok ? chat.data!.reply.places[0] : null;
  check("model's own 'from_lookup: true' claim is overridden when no provider returned the place", place?.verified === false && place.from_lookup === false);
  const follow = await sendConciergeMessage(userId, { conversationId: chat.ok ? chat.data!.conversationId : null, tripId: null, message: "And for lunch?" });
  check("follow-up continues the same conversation", follow.ok && follow.data?.conversationId === (chat.ok && chat.data?.conversationId));
  const usage = await asService((q) => q("select kind, input_tokens, est_cost_usd from ai_usage where user_id = $1 order by created_at", [userId]));
  check("usage and estimated cost are metered per request", usage.length === 3 && usage[0].kind === "trip_generation" && usage[0].input_tokens === 1200 && usage[0].est_cost_usd > 0, JSON.stringify(usage.map((u) => u.kind)));

  server.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll AI-path checks passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
