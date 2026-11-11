"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, List, Map as MapIcon, MapPin, Navigation, X, CalendarRange, BadgeCheck } from "lucide-react";
import { planDayRoute } from "@/app/actions/itinerary";
import { Spinner, useAction } from "@/components/client-ui";
import { Badge, Button, EmptyState, Select, SourceNote } from "@/components/ui";
import { KIND_COLOR, KIND_LABEL, MapCanvas } from "./map-canvas";
import type { MapPoint } from "@/lib/types";
import { cn, haversineKm } from "@/lib/utils";

type DayRef = { id: string; number: number; label: string };
type RouteInfo = { path: [number, number][]; source: string; mode: string; fetched_at: string; totalMinutes: number; totalKm: number };
const km = (a: MapPoint, b: MapPoint) => { const d = haversineKm(a, b); return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`; };

export function TripMap({ tripId, points, days, center, provider }: { tripId: string; points: MapPoint[]; days: DayRef[]; center: [number, number] | null; provider: string }) {
  const [day, setDay] = useState<number | "all">("all");
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"walk" | "drive" | "transit">("drive");
  const [route, setRoute] = useState<(RouteInfo & { day: number }) | null>(null);
  const { run, pending } = useAction();

  const visible = useMemo(() => {
    if (day === "all") return points.map((p) => ({ ...p, order: null }));
    return points.filter((p) => p.kind === "hotel" || p.day === day);
  }, [points, day]);
  const sel = visible.find((p) => p.id === selected) ?? null;
  const hotel = points.find((p) => p.kind === "hotel");
  const prev = sel?.order != null && sel.order > 1 ? visible.find((p) => p.order === sel.order! - 1) : null;
  const dayRef = days.find((d) => d.number === day);

  const card = sel && (
    <div className="card animate-rise p-4 shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge style={{ background: KIND_COLOR[sel.kind], color: "#fff" }}>{KIND_LABEL[sel.kind]}{sel.day ? ` · Day ${sel.day}` : ""}</Badge>
          <h3 className="mt-2 font-semibold leading-snug">{sel.name}</h3>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {sel.image && <img src={sel.image} alt="" className="mt-3 h-32 w-full rounded-xl object-cover" />}
      {sel.description && <p className="mt-2 text-sm text-ink-soft">{sel.description}</p>}
      {sel.address && <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{sel.address}</p>}
      <ul className="mt-3 grid gap-1 text-xs text-ink-soft">
        {hotel && sel.id !== hotel.id && <li>{km(sel, hotel)} from your stay (straight line)</li>}
        {prev && <li>{km(sel, prev)} from the previous stop, {prev.name} (straight line)</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {sel.url && <a href={sel.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">{sel.kind === "hotel" ? "Check price & availability" : "Open website / map"}<ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
      <SourceNote className="mt-2">{sel.verified ? <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-ok" />Location verified with Google Places.</span> : "Approximate location, not yet verified with a places provider."}</SourceNote>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ number: "all" as const, label: "All days" }, ...days].map((d) => (
            <button key={d.number} onClick={() => { setDay(d.number); setSelected(null); }} aria-pressed={day === d.number} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", day === d.number ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft hover:border-ink-faint")}>
              {d.number === "all" ? "All days" : `Day ${d.number}`}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-line bg-surface p-1 text-sm" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === "map"} onClick={() => setView("map")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium", view === "map" ? "bg-ink text-bg" : "text-ink-soft")}><MapIcon className="h-3.5 w-3.5" />Map</button>
          <Link href={`/trips/${tripId}${day !== "all" ? `#day-${day}` : ""}`} className="flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-ink-soft"><CalendarRange className="h-3.5 w-3.5" />Itinerary</Link>
          <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 font-medium", view === "list" ? "bg-ink text-bg" : "text-ink-soft")}><List className="h-3.5 w-3.5" />List</button>
        </div>
      </div>

      {dayRef && (
        <div className="card mb-4 flex flex-wrap items-center gap-3 p-3 pl-4">
          <Navigation className="h-4 w-4 text-accent" />
          <p className="min-w-0 flex-1 text-sm">
            {route?.day === dayRef.number ? (
              <><span className="font-semibold">{route.totalMinutes} min · {route.totalKm.toFixed(1)} km</span> {route.mode === "drive" ? "driving" : route.mode === "walk" ? "walking" : "by transit"} between Day {dayRef.number}&apos;s stops <span className="text-ink-faint">· {route.source}, fetched {new Date(route.fetched_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></>
            ) : (
              <>Plan Day {dayRef.number}&apos;s route with real travel times from the routing provider.</>
            )}
          </p>
          <Select aria-label="Travel mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 min-h-0 w-auto py-1 text-sm">
            <option value="drive">Drive</option><option value="walk">Walk</option><option value="transit">Transit</option>
          </Select>
          <Button size="sm" disabled={pending} onClick={() => run(() => planDayRoute(tripId, dayRef.id, mode), { onDone: (d) => d && setRoute({ ...(d as RouteInfo), day: dayRef.number }) })}>{pending && <Spinner />}Get travel times</Button>
        </div>
      )}

      {points.length === 0 ? (
        <EmptyState icon={<MapPin className="h-5 w-5" />} title="Nothing to map yet" body="Generate an itinerary and your stay, restaurants and activities will appear here." />
      ) : view === "map" ? (
        <div className="relative">
          <MapCanvas points={visible} selectedId={selected} onSelect={setSelected} path={route && route.day === day ? route.path : null} fallbackCenter={center} className="h-[62dvh] min-h-96 w-full overflow-hidden rounded-[1.25rem] border border-line" />
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            {(Object.keys(KIND_LABEL) as MapPoint["kind"][]).filter((k) => visible.some((p) => p.kind === k)).map((k) => (
              <span key={k} className="flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-medium shadow-card"><span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k]}</span>
            ))}
          </div>
          {card && <div className="absolute inset-x-3 bottom-3 z-[500] sm:left-auto sm:w-80">{card}</div>}
        </div>
      ) : (
        <ul className="grid gap-2">
          {visible.map((p) => (
            <li key={p.id}>
              <button onClick={() => { setSelected(p.id); setView("map"); }} className="card flex w-full items-center gap-3 p-3 text-left transition-shadow hover:shadow-float">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: KIND_COLOR[p.kind] }}>{p.order ?? KIND_LABEL[p.kind][0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{KIND_LABEL[p.kind]}{p.day ? ` · Day ${p.day}` : p.kind !== "hotel" ? " · Not scheduled" : ""}{hotel && p.id !== hotel.id ? ` · ${km(p, hotel)} from stay (straight line)` : ""}</span>
                </span>
                <MapPin className="h-4 w-4 shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <SourceNote className="mt-3">Map: {provider}. The dashed line shows visiting order only. Road routes and travel times appear after “Get travel times” and always come from the routing provider.</SourceNote>
    </div>
  );
}
