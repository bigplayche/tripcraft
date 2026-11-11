"use client";
import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Sparkles } from "lucide-react";
import { surprise } from "@/app/actions/trips";
import { Spinner, useAction } from "@/components/client-ui";
import { Badge, Button, Field, Input, Select, SourceNote } from "@/components/ui";
import { DestinationImage } from "@/components/destination-image";
import { artFor, findDestination } from "@/lib/catalog";
import { VACATION_STYLES } from "@/lib/plans";
import type { DiscoverResult } from "@/lib/ai/schemas";
import { money } from "@/lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function SurpriseMe({ defaults }: { defaults: { origin: string; budget: number } }) {
  const { run, pending } = useAction();
  const [result, setResult] = useState<(DiscoverResult & { mode: string }) | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [input, setInput] = useState<Parameters<typeof surprise>[0] | null>(null);

  const go = (i: Parameters<typeof surprise>[0], exclude: string[]) =>
    run(() => surprise({ ...i, exclude }), { refresh: false, onDone: (d) => { if (d) { setResult(d); setShown([...exclude, ...d.destinations.map((x) => x.name)]); } } });

  return (
    <div id="surprise" className="card scroll-mt-24 overflow-hidden">
      <div className="bg-accent-soft/60 p-5 sm:p-7">
        <Badge tone="accent" className="mb-3"><Sparkles className="h-3 w-3" />Surprise Me</Badge>
        <h2 className="display text-2xl sm:text-3xl">Not sure where to go?</h2>
        <p className="mt-1 text-ink-soft">Tell us when, how much and what kind of trip. We&apos;ll suggest where.</p>
        <form
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          action={(f) => {
            const i = { origin: String(f.get("origin")), month: Number(f.get("month")), budget: Number(f.get("budget")), travelers: Number(f.get("travelers")), weather: String(f.get("weather")), style: String(f.get("style")), exclude: [] };
            setInput(i);
            go(i, []);
          }}
        >
          <Field label="Departure city" className="lg:col-span-2"><Input name="origin" required minLength={2} defaultValue={defaults.origin} placeholder="e.g. Chicago" /></Field>
          <Field label="Travel month"><Select name="month" defaultValue={((new Date().getMonth() + 2) % 12) + 1}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
          <Field label="Budget (USD)"><Input name="budget" type="number" min={100} step={100} required defaultValue={defaults.budget} /></Field>
          <Field label="Travelers"><Input name="travelers" type="number" min={1} max={30} required defaultValue={2} /></Field>
          <Field label="Weather"><Select name="weather" defaultValue="any"><option value="any">Any</option><option value="tropical">Tropical</option><option value="warm">Warm</option><option value="mild">Mild</option><option value="cool">Cool</option></Select></Field>
          <Field label="Vacation style" className="lg:col-span-2"><Select name="style" defaultValue="City exploration">{VACATION_STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <div className="flex items-end lg:col-span-4"><Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? <Spinner /> : <Sparkles className="h-4 w-4" />}{pending ? "Finding places…" : "Surprise me"}</Button></div>
        </form>
      </div>

      {result && (
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{result.mode === "demo" ? "Matched from TripCraft's curated catalogue (AI not connected)." : "Picked for you by TripCraft AI."}</p>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => input && go(input, shown)}><RefreshCw className="h-3.5 w-3.5" />Show different ideas</Button>
          </div>
          {result.destinations.length === 0 && <p className="text-sm text-ink-soft">No more matches. Try changing the weather or style.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {result.destinations.map((d) => {
              const cat = findDestination(d.name);
              return (
                <article key={d.name} className="group flex animate-rise flex-col overflow-hidden rounded-2xl border border-line">
                  <div className="relative">
                    <DestinationImage src={cat ? `/destinations/${cat.slug}.jpg` : null} name={d.name} art={cat?.art ?? artFor(d.name)} className="aspect-[16/8]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <h3 className="display absolute bottom-3 left-4 text-2xl text-white">{d.name}<span className="ml-2 font-sans text-sm text-white/80">{d.country}</span></h3>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-sm">{d.why}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div><dt className="text-xs text-ink-faint">Estimated trip budget</dt><dd className="font-semibold">~{money(d.est_trip_budget_usd)}</dd></div>
                      <div><dt className="text-xs text-ink-faint">Suggested stay</dt><dd className="font-semibold">{d.suggested_nights} nights</dd></div>
                      {d.best_season && <div className="col-span-2"><dt className="text-xs text-ink-faint">Best season</dt><dd>{d.best_season}</dd></div>}
                      <div className="col-span-2"><dt className="text-xs text-ink-faint">Typical weather that month</dt><dd>{d.weather_note}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-ink-faint">Popular: {d.attractions.slice(0, 4).join(" · ")}</p>
                    <div className="mt-4 flex gap-2 pt-1">
                      <Link href={`/home?destination=${encodeURIComponent(d.name)}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-strong">Plan this trip</Link>
                      {cat && <Link href={`/discover/${cat.slug}`} className="inline-flex h-9 items-center justify-center rounded-full border border-line px-4 text-sm font-medium hover:bg-muted">Explore</Link>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <SourceNote className="mt-4">Budgets are rough estimates{result.mode === "demo" ? " of ground costs (stay, food, activities) and exclude flights" : " including a flight allowance"}. No flight or hotel prices here are live: check a booking provider before you commit.</SourceNote>
        </div>
      )}
    </div>
  );
}
