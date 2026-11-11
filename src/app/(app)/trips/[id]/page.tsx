import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { GenerateCard } from "@/components/trip/generate-card";
import { ItineraryView } from "@/components/trip/itinerary-view";
import { LinkButton, Notice, SourceNote } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { loadTripBundle } from "@/lib/data";
import { money } from "@/lib/utils";

export const maxDuration = 300;

export default async function ItineraryPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const sp = (await searchParams) as { new?: string };
  const user = await requireUser();
  const b = await loadTripBundle(user.id, id);
  if (!b) notFound();
  const canEdit = b.trip.role !== "viewer";
  const plain = JSON.parse(JSON.stringify(b)) as typeof b;

  if (!b.itinerary) return <GenerateCard tripId={id} autoStart={sp.new === "1"} destination={b.trip.destination_name} canEdit={canEdit} />;

  const demo = b.itinerary.generated_by === "demo-catalog";
  const hotel = b.hotels.find((h) => h.selected) ?? null;
  const budgetChanged = b.itinerary.budget_at_generation != null && b.itinerary.budget_at_generation !== b.trip.budget;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
      <div className="min-w-0">
        {demo && (
          <div className="mb-5">
            <Notice tone="warn" title="Sample itinerary">Built from TripCraft&apos;s curated catalogue because the AI planner isn&apos;t connected (no OPENAI_API_KEY). Costs are rough estimates, not live prices.</Notice>
          </div>
        )}
        {budgetChanged && canEdit && (
          <div className="mb-5">
            <Notice tone="accent" title="Your budget changed" action={<GenerateCard tripId={id} destination={b.trip.destination_name} canEdit variant="button" />}>
              This itinerary was built for {money(b.itinerary.budget_at_generation)}. Regenerate it around your new {money(b.trip.budget)} budget?
            </Notice>
          </div>
        )}
        <ItineraryView tripId={id} days={plain.days} restaurants={plain.restaurants} activities={plain.activities} hotel={plain.hotels.find((h) => h.selected) ?? null} canEdit={canEdit} travelers={b.trip.travelers} />
      </div>

      <aside className="grid content-start gap-4 lg:sticky lg:top-8 lg:self-start">
        <div className="card p-5">
          <p className="eyebrow mb-2">Overview</p>
          <p className="text-sm text-ink-soft">{b.itinerary.summary}</p>
          {hotel && (
            <div className="mt-4 rounded-xl bg-muted p-3 text-sm">
              <p className="text-xs text-ink-faint">Your stay</p>
              <p className="font-medium">{hotel.name}</p>
              <p className="text-xs text-ink-soft">{hotel.area} · about {money(hotel.est_nightly)}/night (estimate)</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={`/trips/${id}/map`} variant="outline" size="sm">View on map</LinkButton>
            <LinkButton href={`/concierge?trip=${id}`} variant="outline" size="sm">Ask concierge</LinkButton>
          </div>
        </div>
        {b.itinerary.assumptions.length > 0 && (
          <details className="card p-5" open={demo}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-accent" />Assumptions &amp; things to confirm</summary>
            <ul className="mt-3 grid list-disc gap-2 pl-4 text-sm text-ink-soft">{b.itinerary.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </details>
        )}
        {canEdit && <GenerateCard tripId={id} destination={b.trip.destination_name} canEdit variant="button" />}
        <SourceNote>
          Generated {new Date(b.itinerary.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} by {demo ? "the sample planner" : b.itinerary.generated_by.replace("openai:", "AI model ")}. Travel times between stops come only from a routing provider (Map tab); distances shown here are straight-line.
        </SourceNote>
      </aside>
    </div>
  );
}
