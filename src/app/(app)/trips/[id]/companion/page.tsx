import { notFound } from "next/navigation";
import { BedDouble, ExternalLink, MapPin } from "lucide-react";
import { Documents, NotesAndContacts, Packing, WeatherCheck, type Doc } from "@/components/trip/companion-view";
import { Badge, LinkButton, SourceNote } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadTripBundle } from "@/lib/data";
import { getEntitlements } from "@/lib/entitlements";
import { fmtDate, money, todayISO } from "@/lib/utils";

export const metadata = { title: "Companion" };

export default async function CompanionPage({ params }: PageProps<"/trips/[id]/companion">) {
  const { id } = await params;
  const user = await requireUser();
  const [b, ent, docs] = await Promise.all([
    loadTripBundle(user.id, id),
    getEntitlements(user.id),
    withUser(user.id, (q) => q<Doc>("select id, name, doc_type, confirmation_code, size_bytes, uploaded_by, created_at from uploaded_documents where trip_id = $1 order by created_at desc", [id]).catch(() => [])),
  ]);
  if (!b) notFound();
  const today = todayISO();
  const live = today >= b.trip.start_date && today <= b.trip.end_date;
  const day = b.days.find((d) => d.date === today) ?? (today < b.trip.start_date ? b.days[0] : null);
  const now = new Date().toISOString().slice(11, 16);
  const hotel = b.hotels.find((h) => h.selected);
  const canEdit = b.trip.role !== "viewer";
  const trip = JSON.parse(JSON.stringify(b.trip)) as typeof b.trip;
  const upcoming = b.days.filter((d) => d.date && d.date > (day?.date ?? today)).slice(0, 2);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid min-w-0 content-start gap-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow">{live ? "Today" : today < b.trip.start_date ? "First day preview" : "Trip complete"}</p>
              <h2 className="display mt-1 text-2xl">{day ? `${day.title} · ${fmtDate(day.date, { weekday: "long", month: "short", day: "numeric" })}` : live ? "Nothing scheduled today" : "This trip has ended"}</h2>
            </div>
            <Badge tone={live ? "ok" : "neutral"}>{live ? "Trip in progress" : today < b.trip.start_date ? "Companion mode starts on your first day" : "Completed"}</Badge>
          </div>
          {day?.items.length ? (
            <ol className="grid gap-2">
              {day.items.map((i) => {
                const past = live && (i.start_time ?? "") < now;
                return (
                  <li key={i.id} className={`flex gap-4 rounded-xl px-3 py-3 ${past ? "opacity-50" : "bg-muted"}`}>
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{i.start_time ?? "—"}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{i.title}</p>
                      {i.address && <p className="flex items-center gap-1 text-xs text-ink-soft"><MapPin className="h-3 w-3" />{i.address}</p>}
                      {i.travel_from_prev && <p className="text-xs text-ink-faint">{i.travel_from_prev.minutes} min {i.travel_from_prev.mode} from previous stop · {i.travel_from_prev.source}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : <p className="rounded-xl bg-muted px-4 py-6 text-center text-sm text-ink-soft">{b.itinerary ? "A free day. Ask the concierge for ideas." : "Generate an itinerary to see your daily plan here."}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href={`/trips/${id}/map`} variant="outline" size="sm">Open map</LinkButton>
            <LinkButton href={`/concierge?trip=${id}`} variant="outline" size="sm">Ask the concierge</LinkButton>
          </div>
        </section>

        {upcoming.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Coming up</h2>
            <ul className="grid gap-3">
              {upcoming.map((d) => (
                <li key={d.id} className="text-sm"><p className="font-medium">{fmtDate(d.date, { weekday: "short", month: "short", day: "numeric" })} · {d.title}</p><p className="text-ink-soft">{d.items.filter((i) => i.kind !== "free").map((i) => i.title).join(" · ") || "Free day"}</p></li>
              ))}
            </ul>
          </section>
        )}

        <WeatherCheck tripId={id} canEdit={canEdit} />
        <Documents tripId={id} docs={JSON.parse(JSON.stringify(docs))} canUpload={ent.limits.documents} canEdit={canEdit} me={user.id} isOwner={b.trip.role === "owner"} />
      </div>

      <aside className="grid content-start gap-6">
        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BedDouble className="h-4 w-4 text-accent" />Your stay</h2>
          {hotel ? (
            <>
              <p className="font-medium">{hotel.name}</p>
              <p className="text-sm text-ink-soft">{hotel.address ?? hotel.area}</p>
              <p className="mt-1 text-sm text-ink-soft">{fmtDate(b.trip.start_date)} to {fmtDate(b.trip.end_date)} · about {money(hotel.est_nightly)}/night (estimate)</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-accent">
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name}, ${b.trip.destination_name}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">Directions<ExternalLink className="h-3.5 w-3.5" /></a>
                {hotel.booking_url && <a href={hotel.booking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">Booking page<ExternalLink className="h-3.5 w-3.5" /></a>}
              </div>
              <SourceNote className="mt-3">This is your planned stay, not a booking. Upload your confirmation under Reservations once you&apos;ve booked.</SourceNote>
            </>
          ) : <p className="text-sm text-ink-soft">No stay selected yet. Choose one on the Places tab.</p>}
        </div>
        <Packing trip={trip} canEdit={canEdit} />
        <NotesAndContacts trip={trip} canEdit={canEdit} />
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Shared with</h2>
          <ul className="grid gap-1.5 text-sm">{b.members.map((m) => <li key={m.user_id} className="flex justify-between gap-3"><span className="truncate">{m.full_name || m.email}</span><span className="capitalize text-ink-faint">{m.role}</span></li>)}</ul>
          <LinkButton href={`/trips/${id}/group`} variant="outline" size="sm" className="mt-4">Open group space</LinkButton>
        </div>
      </aside>
    </div>
  );
}
