"use client";
import { useState } from "react";
import { CloudRain, FileText, Lock, Plus, Sun, Trash2, Upload } from "lucide-react";
import { checkWeather, deleteDocument, savePacking, saveTripNotes, uploadDocument } from "@/app/actions/companion";
import { moveItemToDay, addItem, removeItem } from "@/app/actions/itinerary";
import { Spinner, useAction } from "@/components/client-ui";
import { Badge, Button, Field, Input, Notice, Select, SourceNote, Textarea } from "@/components/ui";
import type { Trip } from "@/lib/types";
import type { Forecast } from "@/lib/weather";
import { cn, fmtDate, timeAgo } from "@/lib/utils";

export type Doc = { id: string; name: string; doc_type: string; confirmation_code: string | null; size_bytes: number; uploaded_by: string; created_at: string };
type Weather = { forecast: Forecast; affected: { itemId: string; dayId: string; date: string; title: string; slot: string }[]; indoorPool: { id: string; name: string }[] };

export function Packing({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [list, setList] = useState(trip.packing_list);
  const commit = (next: typeof list) => { setList(next); run(() => savePacking(trip.id, next), { refresh: false }); };
  const done = list.filter((p) => p.done).length;
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Packing checklist</h2><span className="text-xs text-ink-faint">{done}/{list.length} packed</span></div>
      {list.length === 0 && <p className="mb-3 text-sm text-ink-soft">No items yet. Generating an itinerary adds a starter list.</p>}
      <ul className="grid gap-1">
        {list.map((p) => (
          <li key={p.id} className="group flex items-center gap-3 rounded-lg px-1 py-1">
            <input id={p.id} type="checkbox" checked={p.done} disabled={!canEdit} onChange={() => commit(list.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)))} className="h-4 w-4 accent-(--accent)" />
            <label htmlFor={p.id} className={cn("flex-1 text-sm", p.done && "text-ink-faint line-through")}>{p.label}</label>
            {canEdit && <button aria-label={`Remove ${p.label}`} className="text-ink-faint opacity-0 focus:opacity-100 group-hover:opacity-100" onClick={() => commit(list.filter((x) => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="mt-3 flex gap-2" action={(f) => { const label = String(f.get("item") ?? "").trim(); if (label) commit([...list, { id: `p${Date.now()}`, label: label.slice(0, 120), done: false }]); }}>
          <Input name="item" placeholder="Add an item" className="h-9 min-h-0 py-1 text-sm" key={list.length} />
          <Button size="sm" variant="outline" type="submit" disabled={pending} aria-label="Add item"><Plus className="h-4 w-4" /></Button>
        </form>
      )}
    </div>
  );
}

export function NotesAndContacts({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [contacts, setContacts] = useState(trip.emergency_contacts.length ? trip.emergency_contacts : [{ name: "", phone: "" }]);
  return (
    <form className="card grid gap-4 p-5" action={(f) => run(() => saveTripNotes(trip.id, String(f.get("notes") ?? ""), contacts), { success: "Saved" })}>
      <h2 className="font-semibold">Important notes &amp; emergency contacts</h2>
      <Field label="Travel notes" hint="Visa details, check-in times, door codes, allergies…"><Textarea name="notes" defaultValue={trip.notes ?? ""} readOnly={!canEdit} maxLength={5000} /></Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-[0.8rem] font-medium text-ink-soft">Emergency contacts</legend>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Input aria-label="Contact name" placeholder="Name / relationship" value={c.name} readOnly={!canEdit} onChange={(e) => setContacts(contacts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
            <Input aria-label="Contact phone" placeholder="Phone" value={c.phone} readOnly={!canEdit} onChange={(e) => setContacts(contacts.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)))} />
          </div>
        ))}
        {canEdit && contacts.length < 6 && <button type="button" className="justify-self-start text-sm font-medium text-accent" onClick={() => setContacts([...contacts, { name: "", phone: "" }])}>+ Add another</button>}
      </fieldset>
      <SourceNote>Look up and save the local emergency number for your destination before you travel. TripCraft doesn&apos;t supply it.</SourceNote>
      {canEdit && <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>Save</Button>}
    </form>
  );
}

export function Documents({ tripId, docs, canUpload, canEdit, me, isOwner }: { tripId: string; docs: Doc[]; canUpload: boolean; canEdit: boolean; me: string; isOwner: boolean }) {
  const { run, pending } = useAction();
  const [key, setKey] = useState(0);
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2"><h2 className="font-semibold">Reservations &amp; documents</h2><Lock className="h-3.5 w-3.5 text-ink-faint" /></div>
      <p className="mb-4 text-xs text-ink-faint">Private to this trip&apos;s members. Files are never available on public links, and you can delete them at any time. Don&apos;t upload payment card details.</p>
      {docs.length === 0 && <p className="mb-4 rounded-xl bg-muted px-4 py-5 text-center text-sm text-ink-soft">No documents yet. Upload booking confirmations, tickets or insurance.</p>}
      <ul className="mb-4 grid gap-2">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5">
            <FileText className="h-5 w-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:underline">{d.name}</a>
              <p className="text-xs text-ink-soft"><span className="capitalize">{d.doc_type}</span>{d.confirmation_code && <> · Confirmation <span className="font-mono font-medium text-ink">{d.confirmation_code}</span></>} · {(d.size_bytes / 1024).toFixed(0)} KB · {timeAgo(d.created_at)}</p>
            </div>
            {(d.uploaded_by === me || isOwner) && <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`} disabled={pending} onClick={() => run(() => deleteDocument(d.id), { success: "Document deleted" })}><Trash2 className="h-4 w-4" /></Button>}
          </li>
        ))}
      </ul>
      {!canEdit ? null : canUpload ? (
        <form key={key} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end" action={(f) => run(() => uploadDocument(f), { success: "Document uploaded", onDone: () => setKey(key + 1) })}>
          <input type="hidden" name="tripId" value={tripId} />
          <Field label="File (PDF or image, up to 10 MB)"><Input name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp,text/plain" className="py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm" /></Field>
          <Field label="Type"><Select name="docType"><option value="booking">Booking</option><option value="ticket">Ticket</option><option value="insurance">Insurance</option><option value="id">ID</option><option value="other">Other</option></Select></Field>
          <Field label="Confirmation #"><Input name="code" maxLength={60} placeholder="Optional" /></Field>
          <Button type="submit" disabled={pending}>{pending ? <Spinner /> : <Upload className="h-4 w-4" />}Upload</Button>
        </form>
      ) : (
        <Notice title="Document storage is part of Traveler Plus" action={<a href="/profile/billing" className="text-sm font-semibold text-accent">See plans</a>}>Keep confirmations and tickets with your itinerary.</Notice>
      )}
    </div>
  );
}

export function WeatherCheck({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [w, setW] = useState<Weather | null>(null);
  const [swapped, setSwapped] = useState<string[]>([]);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Weather check</h2><p className="text-xs text-ink-faint">Fetched only when you ask. TripCraft doesn&apos;t monitor weather in the background.</p></div>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => checkWeather(tripId), { refresh: false, onDone: (d) => d && setW(d as Weather) })}>{pending ? <Spinner /> : <Sun className="h-4 w-4" />}{w ? "Refresh forecast" : "Check the forecast"}</Button>
      </div>
      {w && (
        <div className="mt-4 animate-fade">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {w.forecast.days.map((d) => (
              <div key={d.date} className={cn("w-24 shrink-0 rounded-xl p-3 text-center text-xs", d.wet ? "bg-warn-soft" : "bg-muted")}>
                <p className="font-medium">{fmtDate(d.date, { weekday: "short", day: "numeric" })}</p>
                {d.wet ? <CloudRain className="mx-auto my-1.5 h-5 w-5 text-warn" /> : <Sun className="mx-auto my-1.5 h-5 w-5 text-ink-soft" />}
                <p>{d.label}</p><p className="text-ink-soft">{d.tmax}° / {d.tmin}°C</p>{d.rainChance != null && <p className="text-ink-faint">{d.rainChance}% rain</p>}
              </div>
            ))}
          </div>
          {w.affected.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No outdoor plans fall on a likely-wet day in this forecast window.</p> : (
            <div className="mt-4 grid gap-2">
              <p className="text-sm font-medium">Outdoor plans on likely-wet days</p>
              {w.affected.map((a) => (
                <div key={a.itemId} className="flex flex-wrap items-center gap-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">{a.title} <span className="text-ink-soft">· {fmtDate(a.date, { weekday: "short", month: "short", day: "numeric" })}</span></span>
                  {swapped.includes(a.itemId) ? <Badge tone="ok">Swapped</Badge> : canEdit && w.indoorPool.length > 0 ? (
                    <Select aria-label={`Indoor alternative for ${a.title}`} className="h-9 min-h-0 w-auto py-1 text-sm" value="" disabled={pending} onChange={(e) => { const id = e.target.value; if (!id) return; run(async () => { const r = await addItem({ tripId, dayId: a.dayId, slot: a.slot, activityId: id }); return r.ok ? removeItem(a.itemId) : r; }, { success: "Swapped for an indoor alternative", onDone: () => setSwapped([...swapped, a.itemId]) }); }}>
                      <option value="">Swap for indoor option…</option>{w.indoorPool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  ) : <span className="text-xs text-ink-soft">No indoor alternatives in your plan&apos;s pool</span>}
                </div>
              ))}
            </div>
          )}
          <SourceNote className="mt-3">Forecast from {w.forecast.source}, fetched {new Date(w.forecast.fetched_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Covers up to 16 days ahead.</SourceNote>
        </div>
      )}
    </div>
  );
}
void moveItemToDay;
