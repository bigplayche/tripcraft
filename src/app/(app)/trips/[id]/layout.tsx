import { notFound } from "next/navigation";
import { CalendarDays, Users, Wallet } from "lucide-react";
import { DestinationImage } from "@/components/destination-image";
import { TripActions, TripTabs } from "@/components/trip/trip-header";
import { tripPhase } from "@/components/trip-card";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getTrip } from "@/lib/data";
import { artFor, findDestination } from "@/lib/catalog";
import { dateRange, money } from "@/lib/utils";

export default async function TripLayout({ children, params }: LayoutProps<"/trips/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/trips/${id}`);
  const trip = await getTrip(user.id, id);
  if (!trip) notFound();
  const phase = tripPhase(trip);
  return (
    <>
      <div className="relative -mx-4 -mt-6 mb-2 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[1.5rem]">
        <DestinationImage src={trip.cover_image} name={trip.destination_name} art={findDestination(trip.destination_name)?.art ?? artFor(trip.destination_name)} className="h-48 sm:h-60" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/10" />
        <div className="absolute right-4 top-4"><TripActions trip={JSON.parse(JSON.stringify(trip))} /></div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="bg-white/90 text-neutral-800">{phase.label}</Badge>
            {trip.role !== "owner" && <Badge className="bg-white/90 capitalize text-neutral-800">{trip.role}</Badge>}
            {trip.vacation_style && <Badge className="bg-white/20 text-white backdrop-blur">{trip.vacation_style}</Badge>}
          </div>
          <h1 className="display text-3xl sm:text-4xl">{trip.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/85">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{dateRange(trip.start_date, trip.end_date)}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4" />{money(trip.budget)}</span>
          </div>
        </div>
      </div>
      <TripTabs id={trip.id} />
      {children}
    </>
  );
}
