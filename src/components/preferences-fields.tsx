"use client";
import { useState } from "react";
import { ACTIVITY_TYPES, FOOD_PREFERENCES, HOTEL_CATEGORIES, VACATION_STYLES } from "@/lib/plans";
import type { Prefs } from "@/lib/types";
import { ChipSelect } from "./client-ui";
import { Field, Input } from "./ui";

function Interest({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  const [v, setV] = useState(defaultValue);
  const words = ["Not for me", "A little", "Some", "Quite a bit", "Love it"];
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-ink-soft">{words[v]}</span>
      </span>
      <input type="range" name={name} min={0} max={4} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} className="w-full accent-(--accent)" />
    </label>
  );
}

export function BasicsFields({ prefs, name }: { prefs: Prefs | null; name?: string | null }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><Input name="full_name" defaultValue={name ?? ""} placeholder="Alex Morgan" /></Field>
        <Field label="Home or departure city"><Input name="home_city" defaultValue={prefs?.home_city ?? ""} placeholder="e.g. Chicago" /></Field>
        <Field label="Typical trip budget (USD)" hint="For the whole party. Leave blank if it varies."><Input name="typical_budget" type="number" min={0} step={100} defaultValue={prefs?.typical_budget ?? ""} placeholder="3000" /></Field>
        <Field label="Places on your wish list" hint="Comma separated"><Input name="preferred_destinations" defaultValue={prefs?.preferred_destinations.join(", ") ?? ""} placeholder="Japan, Amalfi Coast, Patagonia" /></Field>
      </div>
      <div>
        <p className="mb-2 text-[0.8rem] font-medium text-ink-soft">Favorite vacation styles</p>
        <ChipSelect name="vacation_styles" options={VACATION_STYLES} defaultValue={prefs?.vacation_styles} />
      </div>
    </div>
  );
}

export function TasteFields({ prefs }: { prefs: Prefs | null }) {
  return (
    <div className="grid gap-6">
      <div>
        <p className="mb-2 text-[0.8rem] font-medium text-ink-soft">Preferred hotel category</p>
        <ChipSelect name="hotel_category" options={HOTEL_CATEGORIES} defaultValue={prefs?.hotel_category ? [prefs.hotel_category] : []} single />
      </div>
      <div>
        <p className="mb-2 text-[0.8rem] font-medium text-ink-soft">Food preferences</p>
        <ChipSelect name="food_preferences" options={FOOD_PREFERENCES} defaultValue={prefs?.food_preferences} />
      </div>
      <div>
        <p className="mb-2 text-[0.8rem] font-medium text-ink-soft">Activities you enjoy</p>
        <ChipSelect name="activities" options={ACTIVITY_TYPES} defaultValue={prefs?.activities} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Interest name="nightlife_interest" label="Nightlife" defaultValue={prefs?.nightlife_interest ?? 2} />
        <Interest name="adventure_interest" label="Adventure" defaultValue={prefs?.adventure_interest ?? 2} />
        <Interest name="relaxation_interest" label="Relaxation" defaultValue={prefs?.relaxation_interest ?? 2} />
      </div>
    </div>
  );
}
