"use client";
import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, PlaneTakeoff, Users, Wallet, Sparkles } from "lucide-react";
import { createTrip, type TripFormState } from "@/app/actions/trips";
import { VACATION_STYLES } from "@/lib/plans";
import { addDays, todayISO, cn } from "@/lib/utils";
import { SubmitButton } from "./client-ui";

const DRAFT = "tc-trip-draft";

function Cell({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("group flex min-w-0 flex-col gap-0.5 rounded-2xl border border-transparent px-4 py-2.5 transition-colors focus-within:border-accent focus-within:bg-surface hover:bg-muted/60", className)}>
      <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-soft">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
const inputCls = "w-full min-w-0 bg-transparent text-[0.95rem] text-ink placeholder:text-ink-faint focus:outline-none";

export function TripForm({ authed, defaults }: { authed: boolean; defaults?: { origin?: string | null; destination?: string; budget?: number | null; style?: string } }) {
  const [state, action] = useActionState<TripFormState, FormData>(createTrip, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const start = addDays(todayISO(), 30);
  const v = state?.values ?? {};

  // Restore a draft started on the landing page before signing up.
  useEffect(() => {
    if (!authed || !ref.current) return;
    try {
      const raw = sessionStorage.getItem(DRAFT);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(d)) {
        const el = ref.current.elements.namedItem(k);
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = v;
      }
      sessionStorage.removeItem(DRAFT);
    } catch {}
  }, [authed]);

  const guestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (authed) return;
    e.preventDefault();
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))));
    } catch {}
    router.push("/signup?next=/home");
  };

  return (
    <form ref={ref} action={action} onSubmit={guestSubmit} className="card p-2 shadow-float sm:p-3">
      <div key={JSON.stringify(v)} className="grid grid-cols-2 gap-1 lg:grid-cols-12">
        <Cell icon={<PlaneTakeoff className="h-3.5 w-3.5" />} label="From" className="col-span-2 lg:col-span-3">
          <input name="origin" placeholder="Departure city" defaultValue={v.origin ?? defaults?.origin ?? ""} className={inputCls} autoComplete="off" />
        </Cell>
        <Cell icon={<MapPin className="h-3.5 w-3.5" />} label="Destination" className="col-span-2 lg:col-span-3">
          <input name="destination" required placeholder="Lisbon, Tokyo, anywhere…" defaultValue={v.destination ?? defaults?.destination ?? ""} className={inputCls} autoComplete="off" />
        </Cell>
        <Cell icon={<CalendarDays className="h-3.5 w-3.5" />} label="Depart" className="lg:col-span-3">
          <input name="start" type="date" required min={todayISO()} defaultValue={v.start ?? start} className={inputCls} />
        </Cell>
        <Cell icon={<CalendarDays className="h-3.5 w-3.5" />} label="Return" className="lg:col-span-3">
          <input name="end" type="date" required min={todayISO()} defaultValue={v.end ?? addDays(start, 5)} className={inputCls} />
        </Cell>
        <Cell icon={<Users className="h-3.5 w-3.5" />} label="Travelers" className="lg:col-span-2">
          <input name="travelers" type="number" min={1} max={30} defaultValue={v.travelers ?? 2} required className={inputCls} />
        </Cell>
        <Cell icon={<Wallet className="h-3.5 w-3.5" />} label="Total budget (USD)" className="lg:col-span-3">
          <input name="budget" type="number" min={50} step={50} defaultValue={v.budget ?? defaults?.budget ?? 3000} required className={inputCls} />
        </Cell>
        <Cell icon={<Sparkles className="h-3.5 w-3.5" />} label="Vacation style" className="col-span-2 lg:col-span-3">
          <select name="style" defaultValue={v.style ?? defaults?.style ?? ""} className={cn(inputCls, "cursor-pointer appearance-none")}>
            <option value="">Any style</option>
            {VACATION_STYLES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Cell>
        <div className="col-span-2 flex items-stretch p-1 lg:col-span-4">
          <SubmitButton size="lg" className="h-full min-h-13 w-full" pendingText="Creating your trip…">
            Build My Vacation
          </SubmitButton>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="mx-2 mb-1 mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}{" "}
          {state.code === "upgrade_required" && (
            <Link href="/profile/billing" className="font-semibold underline">
              See plans
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
