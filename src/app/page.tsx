import Link from "next/link";
import { CalendarRange, Compass, Map, MessageCircle, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { Logo, LinkButton, Badge } from "@/components/ui";
import { ThemeToggle } from "@/components/client-ui";
import { TripForm } from "@/components/trip-form";
import { Pricing } from "@/components/pricing";
import { ProductPreview } from "@/components/product-preview";
import { DestinationImage } from "@/components/destination-image";
import { getSessionUser } from "@/lib/auth/session";
import { DESTINATIONS } from "@/lib/catalog";
import { demoPlan } from "@/lib/ai/fallback";
import { EXPENSE_CATEGORIES } from "@/lib/plans";
import { addDays, todayISO } from "@/lib/utils";

const FEATURES = [
  { icon: Sparkles, title: "AI vacation builder", body: "A complete, realistic plan from five inputs: stays, restaurants, activities and a day-by-day schedule." },
  { icon: Map, title: "Interactive trip map", body: "Every stop on one map, organised so each day stays in one part of town." },
  { icon: Wallet, title: "Budget planner", body: "See cost per day and per traveler, and track every line from estimate to booked to paid." },
  { icon: MessageCircle, title: "AI concierge", body: "Ask for a romantic dinner near your hotel or a rainy-day plan. It already knows your trip." },
  { icon: Users, title: "Group trips", body: "Invite friends, vote on options, comment and split shared expenses without a group-chat mess." },
  { icon: Compass, title: "Surprise Me", body: "Not sure where to go? Give us a month, a budget and a mood." },
];
const STEPS = [
  { n: "01", title: "Tell us the basics", body: "Destination, dates, travelers, budget and the kind of trip you want." },
  { n: "02", title: "Get your itinerary", body: "A day-by-day plan with stays, food and activities, built around your budget." },
  { n: "03", title: "Make it yours", body: "Swap, reorder, regenerate a day, invite your group and keep everything in one place." },
];
const FAQ = [
  ["Is TripCraft free?", "Yes. Free Explorer includes one active trip, AI itinerary generation, destination discovery and a basic budget planner. Paid plans add more trips, group planning and higher AI limits."],
  ["Are the prices and ratings live?", "No, and we never pretend they are. Costs are clearly labelled estimates, and ratings only appear when verified by a data provider, with the time they were fetched. Always confirm price and availability with the booking provider."],
  ["Can I edit the itinerary?", "Everything is editable: remove or add activities, change restaurants, swap your stay, move things between days, or regenerate a single day without touching the rest."],
  ["Does TripCraft book things for me?", "TripCraft plans and organises. It links you to providers to book, and you can store your confirmations privately alongside the trip."],
  ["Who can see my trip and documents?", "Only you and the people you invite. Documents are stored privately, never on public links, and you can delete them at any time. We don't store payment card details."],
  ["Can I cancel any time?", "Yes. Manage, downgrade or cancel your subscription from your billing settings. A one-time Trip Pass is available if you don't want a subscription."],
];

export default async function Landing() {
  const user = await getSessionUser();
  const start = addDays(todayISO(), 45);
  const plan = demoPlan({ destination_name: "Lisbon", start_date: start, end_date: addDays(start, 3), travelers: 2, budget: 3000, vacation_style: "Food and culture", origin_city: null });
  const sample = {
    destination: "Lisbon",
    hotel: plan.hotels[0].name,
    days: plan.days.map((d) => ({ title: d.title, items: d.items.map((i) => ({ time: i.start_time, title: i.title, kind: i.kind, cost: i.est_cost_pp_usd })) })),
    budget: plan.budget.map((b) => ({ label: EXPENSE_CATEGORIES.find((c) => c.id === b.category)!.label, amount: b.amount_usd })),
    total: plan.budget.reduce((a, b) => a + b.amount_usd, 0),
  };
  const cta = user ? { href: "/home", label: "Open TripCraft" } : { href: "/signup", label: "Start free" };

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {!user && <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</LinkButton>}
            <LinkButton href={cta.href} size="sm" variant="dark">{cta.label}</LinkButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="animate-rise">
              <Badge tone="accent" className="mb-5"><Sparkles className="h-3 w-3" />Your personal AI travel agent</Badge>
              <h1 className="display text-[2.7rem] leading-[1.03] sm:text-6xl lg:text-7xl">Your trip. Your budget. Your perfect itinerary.</h1>
              <p className="mt-6 max-w-xl text-lg text-ink-soft">TripCraft plans your whole vacation in minutes: where to stay, what to eat, what to do each day and what it will cost. Then it keeps every detail in one place.</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-ok" />Free to start, no card</span>
                <span className="flex items-center gap-1.5"><CalendarRange className="h-4 w-4 text-ok" />Editable day-by-day plans</span>
              </div>
            </div>
            <div className="relative hidden h-[26rem] lg:block">
              {[DESTINATIONS[0], DESTINATIONS[5], DESTINATIONS[1]].map((d, i) => (
                <div key={d.slug} className={["absolute right-0 top-0 w-64 rotate-3", "absolute bottom-0 left-4 w-56 -rotate-6", "absolute left-36 top-24 z-10 w-60 -rotate-1"][i] + " animate-rise overflow-hidden rounded-3xl border-4 border-surface shadow-pop"} style={{ animationDelay: `${i * 120}ms` }}>
                  <DestinationImage src={`/destinations/${d.slug}.jpg`} name={d.name} art={d.art} className="aspect-[4/5]" priority />
                  <p className="absolute bottom-3 left-4 text-sm font-semibold text-white drop-shadow">{d.name}</p>
                </div>
              ))}
            </div>
          </div>
          <div id="plan" className="mt-12 animate-rise" style={{ animationDelay: "150ms" }}>
            <p className="mb-3 text-sm font-medium text-ink-soft">Where would you like to go next?</p>
            <TripForm authed={!!user} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="eyebrow mb-3">How it works</p>
        <h2 className="display max-w-xl text-4xl">Plan less. Travel more.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-7">
              <p className="display text-3xl text-accent">{s.n}</p>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product preview with sample itinerary */}
      <section className="bg-muted/60 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow mb-3">Sample itinerary</p>
            <h2 className="display text-4xl">Four days in Lisbon, planned in the time it takes to read this.</h2>
            <p className="mt-4 text-ink-soft">This is a real output of TripCraft&apos;s planner for two travelers on a $3,000 budget. Explore the itinerary, the budget and the concierge.</p>
            <p className="mt-4 text-sm text-ink-faint">Shown with sample catalogue data. Stay: {sample.hotel}. Costs are estimates.</p>
            <LinkButton href={cta.href} className="mt-7">Build yours</LinkButton>
          </div>
          <ProductPreview sample={sample} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="eyebrow mb-3">Features</p>
        <h2 className="display max-w-2xl text-4xl">Every detail of your trip, in one place.</h2>
        <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
        <div className="card mt-14 flex flex-wrap items-center gap-5 p-6 sm:p-8">
          <ShieldCheck className="h-8 w-8 shrink-0 text-ok" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Honest by design</h3>
            <p className="text-sm text-ink-soft">TripCraft never invents availability, live prices, ratings or opening hours. Estimates are labelled as estimates, verified facts show their source and time, and you always get a link to confirm with the provider.</p>
          </div>
        </div>
      </section>

      {/* Destinations strip */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {DESTINATIONS.slice(0, 8).map((d) => (
            <div key={d.slug} className="group relative w-44 shrink-0 overflow-hidden rounded-3xl sm:w-52">
              <DestinationImage src={`/destinations/${d.slug}.jpg`} name={d.name} art={d.art} className="aspect-[3/4]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <p className="display absolute bottom-3 left-4 text-lg text-white">{d.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials (placeholders) */}
      <section className="bg-muted/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="eyebrow mb-3">Travelers</p>
          <h2 className="display text-4xl">Better trips start here.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <figure key={n} className="rounded-[1.25rem] border border-dashed border-ink-faint/60 p-7">
                <Badge tone="outline">Placeholder</Badge>
                <blockquote className="mt-4 text-ink-soft">Testimonial placeholder {n}. A real traveler quote will appear here once TripCraft has collected and verified customer feedback.</blockquote>
                <figcaption className="mt-4 text-sm text-ink-faint">Name, trip destination</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className="eyebrow mb-3">Pricing</p>
          <h2 className="display text-4xl">Start free. Upgrade when the trips add up.</h2>
        </div>
        <Pricing mode="marketing" />
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <h2 className="display mb-8 text-center text-4xl">Questions, answered</h2>
        <div className="grid gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group px-6 py-4 open:shadow-float">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span className="text-xl text-ink-faint transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-ink px-6 py-16 text-center text-bg sm:py-20">
          <h2 className="display mx-auto max-w-2xl text-4xl sm:text-5xl">Your next trip is one form away.</h2>
          <p className="mx-auto mt-4 max-w-md text-bg/70">Create a free account and build your first itinerary in minutes.</p>
          <LinkButton href={cta.href} size="lg" className="mt-8">{cta.label}</LinkButton>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-soft sm:px-6">
          <Logo />
          <p>Your trip. Your budget. Your perfect itinerary.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/signup" className="hover:text-ink">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
