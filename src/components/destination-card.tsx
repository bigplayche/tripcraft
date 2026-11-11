import Link from "next/link";
import { DestinationImage } from "./destination-image";
import type { Destination } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function DestinationCard({ d, className, size = "md" }: { d: Pick<Destination, "slug" | "name" | "country" | "tagline" | "art" | "dailyCost">; className?: string; size?: "md" | "lg" }) {
  return (
    <Link href={`/discover/${d.slug}`} className={cn("group block shrink-0 animate-rise", className)}>
      <div className="relative overflow-hidden rounded-[1.25rem] shadow-card transition-shadow duration-300 group-hover:shadow-float">
        <DestinationImage src={`/destinations/${d.slug}.jpg`} name={d.name} art={d.art} className={size === "lg" ? "aspect-[4/5]" : "aspect-[4/3]"} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-xs font-medium tracking-wide text-white/80">{d.country}</p>
          <h3 className="display text-xl leading-tight">{d.name}</h3>
        </div>
      </div>
      <p className="mt-2.5 line-clamp-1 text-sm text-ink-soft">{d.tagline}</p>
      <p className="text-xs text-ink-faint">From about ${d.dailyCost.budget}/day per person, excluding stay and flights (estimate)</p>
    </Link>
  );
}
