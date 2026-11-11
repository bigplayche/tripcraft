import { DestinationCard } from "@/components/destination-card";
import { SurpriseMe } from "@/components/surprise-me";
import { PageHeader, SectionTitle, SourceNote } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getPrefs } from "@/lib/data";
import { CATALOG_REVIEWED, DESTINATIONS } from "@/lib/catalog";
import { VACATION_STYLES } from "@/lib/plans";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Discover" };
export const maxDuration = 120;

export default async function Discover({ searchParams }: PageProps<"/discover">) {
  const user = await requireUser();
  const sp = (await searchParams) as { style?: string };
  const prefs = await getPrefs(user.id);
  const style = VACATION_STYLES.find((s) => s === sp.style);
  const list = style ? DESTINATIONS.filter((d) => d.styles.includes(style)) : DESTINATIONS;
  return (
    <>
      <PageHeader eyebrow="Discover" title="Find your next destination" subtitle="Browse TripCraft's curated destinations, or let us surprise you." />
      <SurpriseMe defaults={{ origin: prefs?.home_city ?? "", budget: prefs?.typical_budget ?? 3000 }} />
      <section className="mt-14">
        <SectionTitle title="Browse destinations" />
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[undefined, ...VACATION_STYLES].map((s) => (
            <Link key={s ?? "all"} href={s ? `/discover?style=${encodeURIComponent(s)}` : "/discover"} scroll={false} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", style === s ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-soft hover:border-ink-faint")}>{s ?? "All"}</Link>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">{list.map((d) => <DestinationCard key={d.slug} d={d} size="lg" />)}</div>
        {list.length === 0 && <p className="text-sm text-ink-soft">No catalogue destinations for this style yet. Try Surprise Me.</p>}
        <SourceNote className="mt-8">Curated editorial catalogue, last reviewed {CATALOG_REVIEWED}. Daily costs are rough estimates, not live prices. You can plan a trip to any destination from Home, not only these.</SourceNote>
      </section>
    </>
  );
}
