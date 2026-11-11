"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Archive, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { deleteTrip, updateTrip } from "@/app/actions/trips";
import { Modal, useAction } from "@/components/client-ui";
import { Button, Field, Input } from "@/components/ui";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [["", "Itinerary"], ["/map", "Map"], ["/places", "Places"], ["/budget", "Budget"], ["/group", "Group"], ["/companion", "Companion"]];

export function TripTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/trips/${id}`;
  return (
    <nav className="no-scrollbar -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Trip sections">
      {TABS.map(([seg, label]) => {
        const on = path === base + seg;
        return (
          <Link key={seg} href={base + seg} aria-current={on ? "page" : undefined} className={cn("-mb-px shrink-0 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors", on ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TripActions({ trip }: { trip: Trip }) {
  const { run, pending } = useAction();
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const canEdit = trip.role !== "viewer";
  return (
    <div className="flex items-center gap-1.5">
      {canEdit && (
        <button aria-label={trip.is_favorite ? "Remove from saved trips" : "Save trip"} aria-pressed={trip.is_favorite} disabled={pending} onClick={() => run(() => updateTrip(trip.id, { is_favorite: !trip.is_favorite }), { success: trip.is_favorite ? "Removed from saved trips" : "Saved to your trips" })} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-neutral-800 shadow-card backdrop-blur transition-transform hover:scale-105">
          <Star className={cn("h-[1.1rem] w-[1.1rem]", trip.is_favorite && "fill-amber-400 text-amber-500")} />
        </button>
      )}
      {canEdit && (
        <div className="relative">
          <button aria-label="Trip options" onClick={() => setMenu(!menu)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-neutral-800 shadow-card backdrop-blur">
            <MoreHorizontal className="h-[1.1rem] w-[1.1rem]" />
          </button>
          {menu && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-hidden tabIndex={-1} onClick={() => setMenu(false)} />
              <div className="card absolute right-0 top-12 z-20 w-48 animate-fade p-1.5 text-sm text-ink shadow-pop">
                <button onClick={() => { setEdit(true); setMenu(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted"><Pencil className="h-4 w-4" />Rename</button>
                <button onClick={() => { setMenu(false); run(() => updateTrip(trip.id, { status: trip.status === "archived" ? "planning" : "archived" }), { success: trip.status === "archived" ? "Trip restored" : "Trip archived" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-muted"><Archive className="h-4 w-4" />{trip.status === "archived" ? "Restore" : "Archive"}</button>
                {trip.role === "owner" && <button onClick={() => { setConfirm(true); setMenu(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-danger hover:bg-danger-soft"><Trash2 className="h-4 w-4" />Delete trip</button>}
              </div>
            </>
          )}
        </div>
      )}
      <Modal open={edit} onClose={() => setEdit(false)} title="Rename trip">
        <form action={(f) => run(() => updateTrip(trip.id, { title: String(f.get("title")) }), { onDone: () => setEdit(false) })} className="grid gap-4">
          <Field label="Trip name"><Input name="title" defaultValue={trip.title} required maxLength={120} /></Field>
          <Button type="submit" disabled={pending}>Save</Button>
        </form>
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete this trip?">
        <p className="text-ink-soft">This permanently deletes the itinerary, budget, group activity and uploaded documents for everyone on the trip. This can&apos;t be undone.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)}>Keep trip</Button>
          <Button className="bg-danger text-white hover:bg-danger" disabled={pending} onClick={() => run(() => deleteTrip(trip.id), { refresh: false })}>Delete trip</Button>
        </div>
      </Modal>
    </div>
  );
}
