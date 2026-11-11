"use client";
import { useState } from "react";
import { MapPin, Send, Utensils, Ticket, BedDouble } from "lucide-react";
import { cn, money } from "@/lib/utils";

type Sample = { days: { title: string; items: { time: string; title: string; kind: string; cost: number | null }[] }[]; budget: { label: string; amount: number }[]; total: number; hotel: string; destination: string };

const CHAT = [
  { me: true, text: "It might rain on day 3. What should we do instead?" },
  { me: false, text: "Day 3 has two outdoor stops. Here are indoor swaps already in your plan, both close to your hotel:" },
  { me: false, place: "National Tile Museum", note: "Museum · about $9 per person (estimate)" },
  { me: false, place: "Tram 28 ride", note: "Local experience · about $4 per person (estimate)" },
];

export function ProductPreview({ sample }: { sample: Sample }) {
  const [tab, setTab] = useState<"Itinerary" | "Budget" | "Concierge">("Itinerary");
  const max = Math.max(...sample.budget.map((b) => b.amount));
  const icon = (k: string) => (k === "restaurant" ? <Utensils className="h-3.5 w-3.5" /> : k === "free" ? <BedDouble className="h-3.5 w-3.5" /> : <Ticket className="h-3.5 w-3.5" />);
  return (
    <div className="card overflow-hidden shadow-pop">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex gap-1 rounded-full bg-muted p-1 text-sm" role="tablist">
          {(["Itinerary", "Budget", "Concierge"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-full px-3.5 py-1.5 font-medium transition-colors", tab === t ? "bg-surface text-ink shadow-card" : "text-ink-soft")}>
              {t}
            </button>
          ))}
        </div>
        <span className="hidden items-center gap-1 text-xs text-ink-faint sm:flex"><MapPin className="h-3 w-3" />{sample.destination} · sample plan</span>
      </div>
      <div className="h-[26rem] overflow-y-auto p-5 sm:p-6">
        {tab === "Itinerary" && (
          <div className="grid animate-fade gap-5 sm:grid-cols-2">
            {sample.days.map((d, i) => (
              <div key={i}>
                <p className="eyebrow">Day {i + 1}</p>
                <p className="mb-3 font-semibold">{d.title}</p>
                <ol className="grid gap-2">
                  {d.items.map((it, k) => (
                    <li key={k} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-accent">{icon(it.kind)}</span>
                      <span className="min-w-0 flex-1 truncate">{it.title}</span>
                      <span className="shrink-0 text-xs text-ink-faint">{it.time}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        {tab === "Budget" && (
          <div className="animate-fade">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="eyebrow">Estimated total</p>
                <p className="display text-4xl">{money(sample.total)}</p>
              </div>
              <p className="text-sm text-ink-soft">of {money(3000)} budget</p>
            </div>
            <div className="grid gap-3">
              {sample.budget.map((b) => (
                <div key={b.label} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-3 text-sm">
                  <span className="text-ink-soft">{b.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${(b.amount / max) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{money(b.amount)}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-ink-faint">Figures are planning estimates from TripCraft&apos;s sample catalogue, not live prices.</p>
          </div>
        )}
        {tab === "Concierge" && (
          <div className="flex h-full animate-fade flex-col">
            <div className="grid flex-1 content-start gap-2.5">
              {CHAT.map((m, i) =>
                m.place ? (
                  <div key={i} className="mr-auto w-72 max-w-full rounded-2xl border border-line p-3 text-sm">
                    <p className="font-semibold">{m.place}</p>
                    <p className="text-xs text-ink-soft">{m.note}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-accent"><MapPin className="h-3 w-3" />View on map</p>
                  </div>
                ) : (
                  <p key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.me ? "ml-auto bg-ink text-bg" : "mr-auto bg-muted")}>{m.text}</p>
                ),
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm text-ink-faint">
              <span className="flex-1">Ask about your trip…</span>
              <Send className="h-4 w-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
