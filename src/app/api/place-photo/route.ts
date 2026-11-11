import { getSessionUser } from "@/lib/auth/session";

/** Proxies Google Places photos so the server API key is never sent to the browser. */
export async function GET(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return new Response("Not found", { status: 404 });
  if (!(await getSessionUser())) return new Response("Unauthorized", { status: 401 });
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&key=${key}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok || !res.body) return new Response("Not found", { status: 404 });
  return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" } });
}
