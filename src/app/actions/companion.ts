"use server";
import crypto from "node:crypto";
import { z } from "zod";
import { act, changed, no, ok } from "@/lib/action";
import { withUser, j } from "@/lib/db";
import { getEntitlements, LimitError } from "@/lib/entitlements";
import { tripRow, loadItinerary, loadPools } from "@/lib/data";
import { putFile, removeFile } from "@/lib/storage";
import { getForecast } from "@/lib/weather";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "text/plain"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function savePacking(tripId: string, list: { id: string; label: string; done: boolean }[]) {
  return act(async (u) => {
    const clean = z.array(z.object({ id: z.string().max(40), label: z.string().trim().min(1).max(120), done: z.boolean() })).max(80).parse(list);
    return changed(await withUser(u.id, (q) => q("update trips set packing_list = $2::jsonb where id = $1 returning id", [tripId, j(clean)])));
  });
}

export async function saveTripNotes(tripId: string, notes: string, contacts: { name: string; phone: string }[]) {
  return act(async (u) => {
    const c = z.array(z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().min(2).max(40) })).max(10).parse(contacts.filter((x) => x.name.trim() && x.phone.trim()));
    return changed(await withUser(u.id, (q) => q("update trips set notes = $2, emergency_contacts = $3::jsonb where id = $1 returning id", [tripId, notes.slice(0, 5000), j(c)])));
  });
}

export async function uploadDocument(form: FormData) {
  return act(async (u) => {
    const tripId = z.string().uuid().parse(form.get("tripId"));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return no("Choose a file to upload.");
    if (file.size > MAX_BYTES) return no("Files can be up to 10 MB.");
    if (!ALLOWED.has(file.type)) return no("Upload a PDF, image or text file.");
    if (!rateLimit(`upload:${u.id}`, 20, 60_000).ok) return no("Too many uploads. Try again in a minute.");
    if (!(await getEntitlements(u.id)).limits.documents) throw new LimitError("Private travel documents are a Traveler Plus feature.");
    const trip = await withUser(u.id, (q) => tripRow(q, u.id, tripId));
    if (!trip || trip.role === "viewer") return no("You don't have permission to upload to this trip.");
    const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80) || "document";
    const path = `${tripId}/${crypto.randomUUID()}-${safe}`;
    await putFile(path, Buffer.from(await file.arrayBuffer()), file.type);
    try {
      await withUser(u.id, (q) =>
        q("insert into uploaded_documents (trip_id, uploaded_by, name, doc_type, confirmation_code, mime_type, size_bytes, storage_path) values ($1,$2,$3,$4,$5,$6,$7,$8)", [tripId, u.id, safe, z.enum(["booking", "ticket", "insurance", "id", "other"]).catch("other").parse(form.get("docType")), String(form.get("code") ?? "").trim().slice(0, 60) || null, file.type, file.size, path]),
      );
    } catch (e) {
      await removeFile(path);
      throw e;
    }
    return ok();
  });
}

export async function deleteDocument(id: string) {
  return act(async (u) => {
    const rows = await withUser(u.id, (q) => q<{ storage_path: string }>("delete from uploaded_documents where id = $1 returning storage_path", [id]));
    if (!rows.length) return no("Only the uploader or trip owner can delete this document.");
    await removeFile(rows[0].storage_path);
    return ok();
  });
}

/** On-demand weather check. Flags outdoor plans on wet days and offers indoor swaps from the trip's own pool. */
export async function checkWeather(tripId: string) {
  return act(async (u) => {
    const data = await withUser(u.id, async (q) => {
      const trip = await tripRow(q, u.id, tripId);
      return trip ? { trip, ...(await loadItinerary(q, tripId)), ...(await loadPools(q, tripId)) } : null;
    });
    if (!data) return no("Trip not found.");
    if (data.trip.dest_lat == null || data.trip.dest_lng == null) return no("This destination has no map location yet, so a forecast can't be fetched.");
    const f = await getForecast(data.trip.dest_lat, data.trip.dest_lng, data.trip.start_date, data.trip.end_date);
    if ("error" in f) return no(f.error);
    const scheduled = new Set(data.days.flatMap((d) => d.items.map((i) => i.activity_id)));
    const indoorPool = data.activities.filter((a) => a.indoor && !scheduled.has(a.id)).map((a) => ({ id: a.id, name: a.name }));
    const byId = new Map(data.activities.map((a) => [a.id, a]));
    const affected = f.days.filter((d) => d.wet).flatMap((d) => {
      const day = data.days.find((x) => x.date === d.date);
      return (day?.items ?? []).filter((i) => i.activity_id && byId.get(i.activity_id)?.indoor === false).map((i) => ({ itemId: i.id, dayId: day!.id, date: d.date, title: i.title, slot: i.slot }));
    });
    return ok({ forecast: f, affected, indoorPool });
  });
}
