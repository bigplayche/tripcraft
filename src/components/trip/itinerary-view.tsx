"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Coffee, MapPin, MoreHorizontal, Navigation, Plus, RefreshCw, Route, Ticket, Trash2, Utensils, Bus } from "lucide-react";
import { addItem, moveItem, moveItemToDay, optimizeDay, removeItem, swapRestaurant } from "@/app/actions/itinerary";
import { regenDay } from "@/app/actions/trips";
import { Modal, Spinner, useAction } from "@/components/client-ui";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Activity, Day, Hotel, Item, Restaurant } from "@/lib/types";
import { cn, fmtDate, haversineKm, money } from "@/lib/utils";

const ICON = { activity: Ticket, restaurant: Utensils, transport: Bus, free: Coffee };
const SLOTS = ["morning", "afternoon", "evening"] as const;

function TravelChip({ item, prev }: { item: Item; prev: { lat: number | null; lng: number | null } | null }) {
  const t = item.travel_from_prev;
  if (t)
    return (
      <p className="ml-[1.35rem] flex items-center gap-1.5 border-l border-dashed border-line py-1.5 pl-5 text-xs text-ink-soft" title={`${t.source}, fetched ${new Date(t.fetched_at).toLocaleString()}`}>
        <Navigation className="h-3 w-3" />
        {t.minutes} min {t.mode} · {(t.meters / 1000).toFixed(1)} km <span className="text-ink-faint">· {t.source}</span>
      </p>
    );
  if (prev?.lat != null && prev.lng != null && item.lat != null && item.lng != null) {
    const km = haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: item.lat, lng: item.lng });
    return <p className="ml-[1.35rem] border-l border-dashed border-line py-1.5 pl-5 text-xs text-ink-faint">{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} in a straight line{item.transport_note ? ` · ${item.transport_note}` : ""}</p>;
  }
  return item.transport_note ? <p className="ml-[1.35rem] border-l border-dashed border-line py-1.5 pl-5 text-xs text-ink-faint">{item.transport_note}</p> : <div className="ml-[1.35rem] h-3 border-l border-dashed border-line" />;
}

export function ItineraryView({ tripId, days, restaurants, activities, hotel, canEdit, travelers }: { tripId: string; days: Day[]; restaurants: Restaurant[]; activities: Activity[]; hotel: Hotel | null; canEdit: boolean; travelers: number }) {
  const { run, pending } = useAction();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [adding, setAdding] = useState<Day | null>(null);
  const [regen, setRegen] = useState<Day | null>(null);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const scheduled = new Set(days.flatMap((d) => d.items.map((i) => i.activity_id)));

  return (
    <div className="grid gap-6">
      {days.map((day) => {
        const cost = day.items.reduce((a, i) => a + (i.est_cost_pp ?? 0), 0);
        let prev: { lat: number | null; lng: number | null } | null = hotel;
        return (
          <section key={day.id} id={`day-${day.day_number}`} className="card scroll-mt-24 p-5 sm:p-6">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Day {day.day_number}{day.date && ` · ${fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" })}`}</p>
                <h2 className="display mt-1 text-xl sm:text-2xl">{day.title}</h2>
                {cost > 0 && <p className="mt-1 text-sm text-ink-soft">About {money(cost)} per person · {money(cost * travelers)} for the group <span className="text-ink-faint">(estimate)</span></p>}
              </div>
              {canEdit && (
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setAdding(day)}><Plus className="h-4 w-4" />Add</Button>
                  <Button variant="ghost" size="icon" title="Reorder stops to reduce backtracking" aria-label="Reorder stops to reduce backtracking" disabled={pending} onClick={() => { setBusyDay(day.id); run(() => optimizeDay(tripId, day.id), { onDone: () => setBusyDay(null), success: "Stops reordered by proximity" }); setTimeout(() => setBusyDay(null), 4000); }}>
                    {busyDay === day.id ? <Spinner /> : <Route className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" title="Regenerate this day" aria-label="Regenerate this day" onClick={() => setRegen(day)}><RefreshCw className="h-4 w-4" /></Button>
                </div>
              )}
            </header>

            {day.items.length === 0 && <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-ink-soft">Nothing planned yet. {canEdit && "Add an activity or regenerate this day."}</p>}
            {SLOTS.map((slot) => {
              const items = day.items.filter((i) => i.slot === slot);
              if (!items.length) return null;
              return (
                <div key={slot} className="mt-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">{slot}</p>
                  {items.map((it) => {
                    const Icon = ICON[it.kind];
                    const from = prev;
                    if (it.lat != null) prev = it;
                    const idx = day.items.indexOf(it);
                    const open = openItem === it.id;
                    return (
                      <div key={it.id}>
                        {idx > 0 || hotel ? <TravelChip item={it} prev={from} /> : null}
                        <div className={cn("group rounded-2xl transition-colors", open ? "bg-muted" : "hover:bg-muted/60")}>
                          <div className="flex items-start gap-3 p-2.5">
                            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", it.kind === "restaurant" ? "bg-warn-soft text-warn" : it.kind === "free" ? "bg-muted text-ink-soft" : "bg-accent-soft text-accent")}><Icon className="h-[1.1rem] w-[1.1rem]" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <h3 className="font-medium">{it.title}</h3>
                                {it.source === "user" && <Badge tone="outline">Added by you</Badge>}
                                {it.source === "concierge" && <Badge tone="outline">Via concierge</Badge>}
                              </div>
                              <p className="text-xs text-ink-soft">
                                {it.start_time}{it.duration_min ? ` · ${it.duration_min >= 60 ? `${Math.round((it.duration_min / 60) * 10) / 10} h` : `${it.duration_min} min`}` : ""}
                                {it.est_cost_pp != null && ` · ${it.est_cost_pp === 0 ? "Free" : `~${money(it.est_cost_pp)} pp`}`}
                              </p>
                              {it.description && <p className="mt-1 text-sm text-ink-soft">{it.description}</p>}
                              {it.address && <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint"><MapPin className="h-3 w-3" />{it.address}</p>}
                            </div>
                            {canEdit && (
                              <Button variant="ghost" size="icon" aria-label={`Edit ${it.title}`} aria-expanded={open} onClick={() => setOpenItem(open ? null : it.id)}><MoreHorizontal className="h-4 w-4" /></Button>
                            )}
                          </div>
                          {open && (
                            <div className="flex animate-fade flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
                              <Button variant="outline" size="sm" disabled={pending || idx === 0} onClick={() => run(() => moveItem(it.id, -1))}><ArrowUp className="h-3.5 w-3.5" />Earlier</Button>
                              <Button variant="outline" size="sm" disabled={pending || idx === day.items.length - 1} onClick={() => run(() => moveItem(it.id, 1))}><ArrowDown className="h-3.5 w-3.5" />Later</Button>
                              <Select aria-label="Move to another day" className="h-9 min-h-0 w-auto py-1 text-sm" value="" disabled={pending} onChange={(e) => e.target.value && run(() => moveItemToDay(it.id, e.target.value), { success: "Moved", onDone: () => setOpenItem(null) })}>
                                <option value="">Move to day…</option>
                                {days.filter((d) => d.id !== day.id).map((d) => <option key={d.id} value={d.id}>Day {d.day_number}</option>)}
                              </Select>
                              {it.kind === "restaurant" && restaurants.length > 1 && (
                                <Select aria-label="Change restaurant" className="h-9 min-h-0 w-auto max-w-56 py-1 text-sm" value="" disabled={pending} onChange={(e) => e.target.value && run(() => swapRestaurant(it.id, e.target.value), { success: "Restaurant changed", onDone: () => setOpenItem(null) })}>
                                  <option value="">Change restaurant…</option>
                                  {restaurants.filter((r) => r.id !== it.restaurant_id && r.status === "recommended").map((r) => <option key={r.id} value={r.id}>{r.name} · {"$".repeat(r.price_level ?? 2)}</option>)}
                                </Select>
                              )}
                              <Button variant="danger" size="sm" className="ml-auto" disabled={pending} onClick={() => run(() => removeItem(it.id), { success: "Removed from itinerary" })}><Trash2 className="h-3.5 w-3.5" />Remove</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        );
      })}

      <Modal open={!!adding} onClose={() => setAdding(null)} title={`Add to day ${adding?.day_number ?? ""}`}>
        {adding && <AddForm tripId={tripId} day={adding} restaurants={restaurants.filter((r) => r.status === "recommended")} activities={activities.filter((a) => a.status === "recommended")} scheduled={scheduled} onDone={() => setAdding(null)} />}
      </Modal>
      <Modal open={!!regen} onClose={() => setRegen(null)} title={`Regenerate day ${regen?.day_number ?? ""}`}>
        {regen && (
          <form action={(f) => run(() => regenDay(tripId, regen.id, String(f.get("instruction") ?? "")), { success: `Day ${regen.day_number} rebuilt`, onDone: () => setRegen(null) })} className="grid gap-4">
            <p className="text-sm text-ink-soft">Only this day changes. The rest of your trip stays exactly as it is.</p>
            <Field label="Anything specific? (optional)"><Textarea name="instruction" maxLength={300} placeholder="More relaxed, a rainy-day plan, kid friendly, more food…" /></Field>
            <Button type="submit" disabled={pending}>{pending && <Spinner />}{pending ? "Rebuilding…" : "Regenerate this day"}</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function AddForm({ tripId, day, restaurants, activities, scheduled, onDone }: { tripId: string; day: Day; restaurants: Restaurant[]; activities: Activity[]; scheduled: Set<string | null>; onDone: () => void }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState<"activity" | "restaurant" | "custom">("activity");
  const fresh = activities.filter((a) => !scheduled.has(a.id));
  return (
    <form
      className="grid gap-4"
      action={(f) => {
        const pick = String(f.get("pick") ?? "");
        run(() => addItem({ tripId, dayId: day.id, slot: String(f.get("slot")), activityId: mode === "activity" ? pick : undefined, restaurantId: mode === "restaurant" ? pick : undefined, title: String(f.get("title") ?? ""), description: String(f.get("description") ?? ""), cost: f.get("cost") ? Number(f.get("cost")) : null, startTime: String(f.get("time") ?? "") }), { success: "Added to itinerary", onDone });
      }}
    >
      <div className="flex gap-1 rounded-full bg-muted p-1 text-sm">
        {(["activity", "restaurant", "custom"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-full px-3 py-1.5 font-medium capitalize", mode === m ? "bg-surface shadow-card" : "text-ink-soft")}>{m === "custom" ? "Your own" : m}</button>
        ))}
      </div>
      {mode === "custom" ? (
        <>
          <Field label="What are you doing?"><Input name="title" required maxLength={200} placeholder="Sunset picnic at the viewpoint" /></Field>
          <Field label="Notes (optional)"><Input name="description" maxLength={500} /></Field>
          <Field label="Estimated cost per person (optional)"><Input name="cost" type="number" min={0} step="1" /></Field>
        </>
      ) : (
        <Field label={mode === "activity" ? "Choose from your recommended activities" : "Choose a restaurant"} hint={mode === "activity" && !fresh.length ? "Everything in your pool is already scheduled. You can still add one again, or add your own." : undefined}>
          <Select name="pick" required>
            {(mode === "activity" ? (fresh.length ? fresh : activities) : restaurants).map((x) => (
              <option key={x.id} value={x.id}>{x.name}{x.est_cost_pp != null ? ` · ~$${x.est_cost_pp} pp` : ""}</option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Part of day"><Select name="slot" defaultValue="afternoon">{SLOTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</Select></Field>
        <Field label="Start time (optional)"><Input name="time" type="time" /></Field>
      </div>
      <Button type="submit" disabled={pending}>{pending && <Spinner />}Add to day {day.day_number}</Button>
    </form>
  );
}
