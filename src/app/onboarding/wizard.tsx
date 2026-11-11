"use client";
import { useState } from "react";
import { CalendarRange, Map, MessageCircle, Wallet } from "lucide-react";
import { savePreferences, skipOnboarding } from "@/app/actions/profile";
import { BasicsFields, TasteFields } from "@/components/preferences-fields";
import { SubmitButton } from "@/components/client-ui";
import { Button } from "@/components/ui";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOW = [
  { icon: CalendarRange, title: "Tell us the basics", body: "Where, when, who and how much. That's all we need to start." },
  { icon: Map, title: "Get a full plan", body: "Stays, food, activities and a day-by-day itinerary you can edit and see on a map." },
  { icon: Wallet, title: "Stay on budget", body: "Every plan comes with a budget you can track from estimate to paid." },
  { icon: MessageCircle, title: "Ask the concierge", body: "Change of plans? Ask for a rainy-day swap or a dinner near your hotel." },
];

export function Wizard({ prefs, name, next }: { prefs: Prefs | null; name: string | null; next: string }) {
  const [step, setStep] = useState(0);
  return (
    <div className="card mx-auto w-full max-w-2xl p-6 shadow-float sm:p-10">
      <div className="mb-8 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line")} />
        ))}
      </div>
      <form action={savePreferences}>
        <input type="hidden" name="next" value={next} />
        <section className={cn(step !== 0 && "hidden", "animate-fade")}>
          <p className="eyebrow mb-2">Welcome to TripCraft</p>
          <h1 className="display text-3xl sm:text-4xl">Your personal AI travel agent</h1>
          <p className="mt-3 text-ink-soft">Every detail of your trip, in one place. Here&apos;s how it works.</p>
          <ul className="mt-7 grid gap-4 sm:grid-cols-2">
            {HOW.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl bg-muted p-4">
                <Icon className="h-5 w-5 text-accent" />
                <p className="mt-2.5 font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className={cn(step !== 1 && "hidden", "animate-fade")}>
          <h2 className="display text-3xl">A little about how you travel</h2>
          <p className="mb-7 mt-2 text-ink-soft">All optional. We use this to tailor future trips, and you can change it any time.</p>
          <BasicsFields prefs={prefs} name={name} />
        </section>
        <section className={cn(step !== 2 && "hidden", "animate-fade")}>
          <h2 className="display text-3xl">What makes a trip great for you?</h2>
          <p className="mb-7 mt-2 text-ink-soft">Pick anything that applies.</p>
          <TasteFields prefs={prefs} />
        </section>
        <div className="mt-9 flex items-center justify-between gap-3">
          {step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>Back</Button> : <span />}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="ghost" formAction={skipOnboarding} formNoValidate>Skip for now</Button>
            {step < 2 ? <Button type="button" onClick={() => setStep(step + 1)}>Continue</Button> : <SubmitButton>Finish setup</SubmitButton>}
          </div>
        </div>
      </form>
    </div>
  );
}
