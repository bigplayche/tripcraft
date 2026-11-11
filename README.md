# TripCraft

**Your trip. Your budget. Your perfect itinerary.**

TripCraft is an AI travel companion: it builds a full vacation plan (stays, restaurants, activities, a day-by-day itinerary and a budget), shows it on a map, lets a group plan together, and keeps bookings and notes in one place.

Stack: Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · OpenAI (structured outputs + tool calling) · Google Maps Platform · Stripe · Vercel.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, TripCraft runs in **demo mode** so every workflow can be used immediately:

| Integration | When configured | Demo-mode fallback (clearly labelled in the UI) |
|---|---|---|
| Supabase | Supabase Auth (email, Google, Apple), Supabase Postgres, private Storage bucket | Embedded Postgres (PGlite) in `./.data`, local email/password sign-in, files on local disk |
| OpenAI | AI itineraries, day regeneration, concierge with tools, Surprise Me, budget advice | Sample planner built from a hand-curated catalogue of 11 destinations; rule-based concierge over your stored plan |
| Google Places / Routes | Verified addresses, ratings and photos with fetch timestamps; walk / drive / transit times | Unverified approximate locations; driving times from the public OSRM server; otherwise straight-line distance only |
| Google Maps JS | Google map | Leaflet + OpenStreetMap |
| Stripe | Checkout, billing portal, webhooks | Checkout disabled; a development-only plan switcher |
| Open-Meteo | On-demand forecast (no key required) | Graceful "unavailable" message |

Demo mode is for development. It is not a production configuration.

## Running at zero cost

TripCraft needs no paid service to run. Nothing below is required, and nothing is billed unless you add a key for it.

| Piece | Free option | What you give up |
|---|---|---|
| Database, sign-in, file storage | Demo mode locally, or Supabase's free tier when you deploy | Free projects have usage caps |
| Map | OpenStreetMap (the default) | Google's map style |
| Travel times | OSRM (the default) | Driving only; no walking or transit times |
| Weather | Open-Meteo (the default, no key) | Nothing |
| Trip planning and concierge | Built-in sample planner and rule-based concierge | Only the 11 catalogue destinations get a full plan; no open-ended AI answers |
| Payments | Leave Stripe unset | You cannot charge subscribers |

The only features that cost money are the ones behind `OPENAI_API_KEY` (billed per use) and `GOOGLE_MAPS_API_KEY` (billed per use beyond Google's free allowance). Leave both unset to stay at zero. Stripe has no monthly fee and only takes a share of payments you receive.

Demo mode stores data on local disk, so it suits your own machine but not serverless hosting such as Vercel; to put the app online for free, use a free Supabase project.

## Environment variables

Copy `.env.example` to `.env.local`. Nothing is required for demo mode.

| Variable | Used for | Exposed to browser |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Absolute links (invites, Stripe return URLs) | yes |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth and Storage | yes (safe: protected by RLS) |
| `DATABASE_URL` | Server-side Postgres connection | no |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | AI features | no |
| `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK` | Cost estimates in `ai_usage` | no |
| `GOOGLE_MAPS_API_KEY` | Places API (New) and Routes API | no |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID` | Maps JavaScript API | yes (restrict by referrer) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Subscriptions | no |
| `OSRM_URL`, `WEATHER_PROVIDER` | Fallback providers; set to `off` to disable | no |
| `FREE_ACCESS_PLAN` | `plus` or `pro`: gives every user that plan while Stripe is not configured | no |
| `SESSION_SECRET` | Demo-mode session cookie signing | no |

## Configure Supabase

1. Create a project. Copy the project URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Copy the **Transaction pooler** connection string into `DATABASE_URL`.
3. Run the migrations (below).
4. Authentication > URL configuration: set the site URL to your app URL and add `<app url>/auth/callback` as a redirect URL.
5. Authentication > Providers: enable Email, and Google and Apple if you want social sign-in (each needs its own OAuth credentials).

How data access works: the server connects with `DATABASE_URL` and runs every user query in a transaction as the `authenticated` role with the user's id in `request.jwt.claims`, the same mechanism Supabase's own API uses. Row Level Security therefore applies to every query the app makes, and equally to any direct Supabase client. Privileged writes (billing, AI metering) use a separate service path.

### Database migrations

Migrations live in `supabase/migrations`. See [docs/SCHEMA.md](docs/SCHEMA.md).

```bash
DATABASE_URL="postgres://..." npm run db:migrate
```

The Supabase CLI works too (`supabase db push`). For a plain local Postgres without Supabase, add `-- --local`, which installs a small auth shim and skips the Storage policies. In demo mode migrations are applied automatically on first start.

## Configure the AI provider

Set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-5-mini`; any chat model that supports JSON-schema structured outputs and tool calling works. For reasoning models, `OPENAI_REASONING_EFFORT=low` makes itinerary generation noticeably faster.

Each AI task has its own system prompt (`src/lib/ai/prompts.ts`) and output schema (`src/lib/ai/schemas.ts`): trip generation, destination discovery, budget optimization, restaurant and activity recommendations, the concierge, and single-day modification. All share one reliability policy: never invent availability, live prices, ratings, opening hours or confirmations; label estimates; state assumptions.

Usage is metered per request in `ai_usage`, and monthly limits per plan are enforced on the server (`src/lib/entitlements.ts`).

## Configure Google Maps

Create two keys in Google Cloud:

- **Server key** (`GOOGLE_MAPS_API_KEY`): enable *Places API (New)* and *Routes API*; restrict to those APIs.
- **Browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): enable *Maps JavaScript API*; restrict by HTTP referrer. Optionally set a map ID.

With the server key, recommendations are checked against Places after generation and gain a verified address, rating and photo, stamped with source and time. Travel times always come from a routing provider and are stored with their source; the AI is instructed never to state them.

## Configure Stripe

1. Create products and prices: Traveler Plus ($7.99/month, $59.99/year), TripCraft Pro ($14.99/month, $119.99/year) and a one-time Trip Pass ($14.99). Put the price IDs in the `STRIPE_PRICE_*` variables.
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint at `<app url>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created/updated/deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. In the customer portal settings, allow switching between your four subscription prices and cancelling. Upgrades, downgrades and cancellations happen there.

Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Plan state is written only by the verified webhook, and users cannot modify their own `subscriptions` row (enforced by grants and RLS). Every gated action checks entitlements on the server.

## Deploy

Deploy to Vercel, add the environment variables, set `NEXT_PUBLIC_APP_URL` to the production URL and run the migrations against the Supabase database. Then update the Supabase redirect URL and the Stripe webhook URL.

Before production: replace the in-memory rate limiter (`src/lib/rate-limit.ts`) with a shared store such as Upstash Redis, since serverless instances don't share memory; and use Google Maps or a commercial tile provider, because the public OpenStreetMap tile and OSRM servers are not meant for production traffic.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:rls   # 27 Row Level Security checks (also runs against DATABASE_URL)
npm run test:ai    # OpenAI code path against a local mock endpoint
npm run build && npx next start -p 3100 &
npm run test:e2e   # full browser journey; needs Playwright
```

## Project layout

```
supabase/migrations/     schema, RLS policies, storage policies
src/lib/db/              one SQL path, two drivers (postgres.js / PGlite), RLS-scoped transactions
src/lib/ai/              prompts, schemas, OpenAI client, fallback planner
src/lib/planner.ts       generate / regenerate / verify / budget advice / discovery
src/lib/concierge.ts     tool-calling concierge and demo responder
src/lib/maps/            Google Places and Routes, OSRM fallback
src/lib/entitlements.ts  plans, quotas, AI metering
src/app/actions/         server actions (validated with zod, authorised by RLS)
src/app/(app)/           signed-in app: home, discover, trips, group, concierge, profile
src/components/          design system and feature components
```

Next.js 16 note: this app uses the standard dynamic rendering model (Cache Components is off), because nearly every screen is per-user.

## Credits

Destination photos in `public/destinations` are from [Unsplash](https://unsplash.com/license). Map data © OpenStreetMap contributors. Forecasts by Open-Meteo.
