import Link from "next/link";
import { Star, Users } from "lucide-react";
import { DestinationImage } from "./destination-image";
import { Badge } from "./ui";
import { artFor, findDestination } from "@/lib/catalog";
import type { Trip } from "@/lib/types";
import { dateRange, money, todayISO } from "@/lib/utils";

export function tripPhase(t: Pick<Trip, "start_date" | "end_date" | "status">) {
  const today = todayISO();
  if (t.status === "archived") return { label: "Archived", tone: "neutral" as const };
  if (today > t.end_date) return { label: "Completed", tone: "neutral" as const };
  if (today >= t.start_date) return { label: "Happening now", tone: "ok" as const };
  const days = Math.round((Date.parse(t.start_date) - Date.parse(today)) / 86400000);
  return { label: days === 1 ? "Tomorrow" : `In ${days} days`, tone: "accent" as const };
}

export function TripCard({ trip, href }: { trip: Trip; href?: string }) {
  const phase = tripPhase(trip);
  return (
    <Link href={href ?? `/trips/${trip.id}`} className="card group block animate-rise overflow-hidden transition-shadow duration-300 hover:shadow-float">
      <div className="relative">
        <DestinationImage src={trip.cover_image} name={trip.destination_name} art={findDestination(trip.destination_name)?.art ?? artFor(trip.destination_name)} className="aspect-[16/9]" />
        <Badge tone={phase.tone} className="absolute left-3 top-3 bg-surface/95 backdrop-blur">{phase.label}</Badge>
        {trip.is_favorite && <Star className="absolute right-3 top-3 h-5 w-5 fill-white text-white drop-shadow" />}
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold">{trip.title}</h3>
        <p className="mt-0.5 text-sm text-ink-soft">{dateRange(trip.start_date, trip.end_date)}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}{(trip.member_count ?? 1) > 1 ? ` · ${trip.member_count} planning` : ""}</span>
          <span>{money(trip.budget)} budget</span>
        </div>
      </div>
    </Link>
  );
}
