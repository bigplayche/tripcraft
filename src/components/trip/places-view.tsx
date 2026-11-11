"use client";
import { useState } from "react";
import { BadgeCheck, Bookmark, ExternalLink, Star } from "lucide-react";
import { selectHotel, resolveSuggestion } from "@/app/actions/itinerary";
import { savePlace } from "@/app/actions/trips";
import { useAction } from "@/components/client-ui";
import { Badge, Button, EmptyState, SectionTitle, Select, SourceNote } from "@/components/ui";
import { DestinationImage } from "@/components/destination-image";
import { artFor } from "@/lib/catalog";
import type { Activity, Hotel, Restaurant } from "@/lib/types";
import { cn, money } from "@/lib/utils";

function Rating({ r }: { r: { rating: number | null; rating_count: number | null; verified_at: string | null } }) {
  if (r.rating == null || !r.verified_at) return <span className="text-xs text-ink-faint">Rating not verified</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-ink-soft" title={`Google Places, fetched ${new Date(r.verified_at).toLocaleDateString()}`}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {r.rating.toFixed(1)}{r.rating_count ? ` (${r.rating_count.toLocaleString()})` : ""} <BadgeCheck className="h-3.5 w-3.5 text-ok" />
    </span>
  );
}

export function PlacesView({ tripId, destination, hotels, restaurants, activities, canEdit, nights, rooms }: { tripId: string; destination: string; hotels: Hotel[]; restaurants: Restaurant[]; activities: Activity[]; canEdit: boolean; nights: number; rooms: number }) {
  const { run, pending } = useAction();
  const [tier, setTier] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [cuisine, setCuisine] = useState("all");
  const [price, setPrice] = useState("all");
  const [cat, setCat] = useState("all");
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();

  const hs = hotels.filter((h) => (tier === "all" || h.tier === tier) && (type === "all" || h.hotel_type === type)).sort((a, b) => (sort === "price" ? (a.est_nightly ?? 1e9) - (b.est_nightly ?? 1e9) : sort === "price_desc" ? (b.est_nightly ?? 0) - (a.est_nightly ?? 0) : sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) : Number(b.selected) - Number(a.selected)));
  const rs = restaurants.filter((r) => (cuisine === "all" || r.cuisine === cuisine) && (price === "all" || String(r.price_level) === price));
  const as = activities.filter((a) => cat === "all" || a.category === cat);
  const filter = "h-9 min-h-0 w-auto py-1 text-sm";
  const save = (x: { name: string; address: string | null; lat: number | null; lng: number | null }, kind: string) => (
    <Button variant="ghost" size="icon" aria-label={`Save ${x.name}`} title="Save place" disabled={pending} onClick={() => run(() => savePlace({ tripId, name: x.name, kind, address: x.address, lat: x.lat, lng: x.lng }), { success: "Saved to your places", refresh: false })}><Bookmark className="h-4 w-4" /></Button>
  );
  const suggestion = (x: Restaurant | Activity, t: "restaurant" | "activity") =>
    x.status === "suggested" && (
      <div className="mt-3 flex items-center gap-2">
        <Badge tone="accent">Group suggestion</Badge>
        {canEdit && <><Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveSuggestion({ type: t, id: x.id, accept: true }), { success: "Added to recommendations" })}>Accept</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resolveSuggestion({ type: t, id: x.id, accept: false }))}>Dismiss</Button></>}
      </div>
    );

  return (
    <div className="grid gap-14">
      <section>
        <SectionTitle title="Where to stay" hint="Nightly prices are estimates. Follow the link to confirm the real price and availability." />
        {hotels.length === 0 ? <EmptyState title="No stay recommendations yet" body="Generate the itinerary to get accommodation options." /> : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Select aria-label="Budget or luxury" value={tier} onChange={(e) => setTier(e.target.value)} className={filter}><option value="all">Any budget</option><option value="budget">Budget</option><option value="mid">Mid-range</option><option value="luxury">Luxury</option></Select>
              <Select aria-label="Hotel type" value={type} onChange={(e) => setType(e.target.value)} className={filter}><option value="all">Any type</option>{uniq(hotels.map((h) => h.hotel_type)).map((t) => <option key={t}>{t}</option>)}</Select>
              <Select aria-label="Sort stays" value={sort} onChange={(e) => setSort(e.target.value)} className={filter}><option value="recommended">Recommended</option><option value="price">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="rating">Verified rating</option></Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {hs.map((h) => (
                <article key={h.id} className={cn("card flex flex-col overflow-hidden", h.selected && "ring-2 ring-accent")}>
                  <div className="relative">
                    <DestinationImage src={h.image_url} name={h.name} art={artFor(h.name)} className="aspect-[16/9]" />
                    {h.selected && <Badge tone="accent" className="absolute left-3 top-3 bg-accent text-on-accent">Your stay</Badge>}
                    {!h.image_url && <span className="absolute bottom-2 right-3 text-[0.65rem] text-white/80">Illustration, not a photo of the property</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><h3 className="font-semibold leading-snug">{h.name}</h3><p className="text-xs text-ink-soft">{[h.hotel_type, h.area].filter(Boolean).join(" · ")}</p></div>
                      {save(h, "hotel")}
                    </div>
                    <p className="mt-2 flex-1 text-sm text-ink-soft">{h.description}</p>
                    {h.distance_note && <p className="mt-2 text-xs text-ink-faint">{h.distance_note}{h.address ? ` · ${h.address}` : ""}</p>}
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div><p className="text-lg font-semibold">~{money(h.est_nightly)}<span className="text-sm font-normal text-ink-soft"> / night</span></p><p className="text-xs text-ink-faint">≈ {money((h.est_nightly ?? 0) * nights * rooms)} for {nights} night{nights !== 1 ? "s" : ""}, {rooms} room{rooms > 1 ? "s" : ""} · estimate</p></div>
                      <Rating r={h} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {h.booking_url && <a href={h.booking_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-line text-sm font-medium hover:bg-muted">Check price<ExternalLink className="h-3.5 w-3.5" /></a>}
                      {canEdit && !h.selected && <Button size="sm" className="flex-1" disabled={pending} onClick={() => run(() => selectHotel(tripId, h.id), { success: `Switched to ${h.name}. Budget updated.` })}>Choose this stay</Button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <SectionTitle title="Where to eat" hint="Cost per person is an estimate." />
        {restaurants.length === 0 ? <EmptyState title="No restaurants yet" /> : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Select aria-label="Cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={filter}><option value="all">Any cuisine</option>{uniq(restaurants.map((r) => r.cuisine)).map((c) => <option key={c}>{c}</option>)}</Select>
              <Select aria-label="Price range" value={price} onChange={(e) => setPrice(e.target.value)} className={filter}><option value="all">Any price</option>{[1, 2, 3, 4].map((p) => <option key={p} value={p}>{"$".repeat(p)}</option>)}</Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {rs.map((r) => (
                <article key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="font-semibold">{r.name}</h3><p className="text-xs text-ink-soft">{[r.cuisine, r.price_level ? "$".repeat(r.price_level) : null, r.est_cost_pp != null ? `~${money(r.est_cost_pp)} pp` : null].filter(Boolean).join(" · ")}</p></div>
                    {save(r, "restaurant")}
                  </div>
                  {r.description && <p className="mt-2 text-sm text-ink-soft">{r.description}</p>}
                  {r.address && <p className="mt-1 text-xs text-ink-faint">{r.address}</p>}
                  <div className="mt-3 flex items-center justify-between"><Rating r={r} /><a href={r.website_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${destination}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">{r.website_url ? "Website" : "Find on Google Maps"}<ExternalLink className="h-3 w-3" /></a></div>
                  {suggestion(r, "restaurant")}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <SectionTitle title="Things to do" hint="Add any of these to a day from the Itinerary tab." />
        {activities.length === 0 ? <EmptyState title="No activities yet" /> : (
          <>
            <div className="mb-4"><Select aria-label="Activity type" value={cat} onChange={(e) => setCat(e.target.value)} className={filter}><option value="all">All types</option>{uniq(activities.map((a) => a.category)).map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div className="grid gap-3 md:grid-cols-2">
              {as.map((a) => (
                <article key={a.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="font-semibold">{a.name}</h3><p className="text-xs text-ink-soft">{[a.category, a.indoor ? "Indoor" : a.indoor === false ? "Outdoor" : null, a.est_cost_pp == null ? "Cost unknown" : a.est_cost_pp === 0 ? "Free" : `~${money(a.est_cost_pp)} pp`].filter(Boolean).join(" · ")}</p></div>
                    {save(a, "activity")}
                  </div>
                  {a.description && <p className="mt-2 text-sm text-ink-soft">{a.description}</p>}
                  <div className="mt-3 flex items-center justify-between"><Rating r={a} /><a href={a.website_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.name}, ${destination}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">{a.website_url ? "Website" : "Find on Google Maps"}<ExternalLink className="h-3 w-3" /></a></div>
                  {suggestion(a, "activity")}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
      <SourceNote>Ratings appear only when confirmed by Google Places, with the date they were fetched. TripCraft does not check availability or opening hours; confirm those with each provider.</SourceNote>
    </div>
  );
}
