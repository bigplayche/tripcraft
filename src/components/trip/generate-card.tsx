"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { generateTrip } from "@/app/actions/trips";
import { Button, LinkButton } from "@/components/ui";
import { Spinner, useToast } from "@/components/client-ui";

const STEPS = ["Reading your preferences", "Choosing where to stay", "Finding places to eat", "Picking activities", "Arranging each day by neighbourhood", "Balancing the budget"];

/** Kicks off itinerary generation and shows progress. Also used for "Regenerate". */
export function GenerateCard({ tripId, autoStart, destination, canEdit, variant = "empty" }: { tripId: string; autoStart?: boolean; destination: string; canEdit: boolean; variant?: "empty" | "button" }) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null);
  const started = useRef(false);
  const router = useRouter();
  const toast = useToast();

  const start = async () => {
    setBusy(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    try {
      const r = await generateTrip(tripId);
      if (!r.ok) setError({ message: r.error, upgrade: r.code === "upgrade_required" });
      else {
        toast(r.data?.mode === "demo" ? "Sample itinerary ready" : "Your itinerary is ready");
        router.replace(`/trips/${tripId}`);
        router.refresh();
      }
    } catch {
      setError({ message: "Generation didn't finish. Please try again.", upgrade: false });
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoStart && canEdit && !started.current) {
      started.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (variant === "button")
    return (
      <Button variant="outline" size="sm" onClick={start} disabled={busy}>
        {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Rebuilding…" : "Regenerate itinerary"}
        {error && <span className="sr-only" role="alert">{error.message}</span>}
      </Button>
    );

  return (
    <div className="card mx-auto max-w-xl p-8 text-center sm:p-12">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">{busy ? <Spinner className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}</div>
      {busy ? (
        <>
          <h2 className="display text-2xl">Crafting your {destination} itinerary</h2>
          <ul className="mx-auto mt-6 grid max-w-xs gap-2 text-left text-sm" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "text-ink-faint line-through" : i === step ? "font-medium text-ink" : "text-ink-faint"}>{s}{i === step && "…"}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink-faint">This can take up to a couple of minutes with the AI planner.</p>
        </>
      ) : (
        <>
          <h2 className="display text-2xl">{error ? "We couldn't build the itinerary" : "No itinerary yet"}</h2>
          <p className="mt-2 text-ink-soft">{error?.message ?? (canEdit ? "Generate a day-by-day plan with stays, restaurants, activities and a budget." : "The trip owner hasn't generated an itinerary yet.")}</p>
          {canEdit && (
            <div className="mt-6 flex justify-center gap-2">
              {error?.upgrade && <LinkButton href="/profile/billing">See plans</LinkButton>}
              <Button onClick={start} variant={error?.upgrade ? "outline" : "primary"}>{error ? "Try again" : "Generate itinerary"}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
