-- TripCraft core schema.
-- Money is stored as numeric(12,2) in the trip currency (USD by default).
-- List-like preference columns are jsonb arrays so both drivers serialise them identically.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  home_city text,
  preferred_destinations jsonb not null default '[]',
  typical_budget numeric(12,2),
  vacation_styles jsonb not null default '[]',
  hotel_category text,
  food_preferences jsonb not null default '[]',
  nightlife_interest smallint not null default 2 check (nightlife_interest between 0 and 4),
  adventure_interest smallint not null default 2 check (adventure_interest between 0 and 4),
  relaxation_interest smallint not null default 2 check (relaxation_interest between 0 and 4),
  activities jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- Written only by the Stripe webhook (service role). Users can read their own row.
create table public.subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','plus','pro')),
  billing_interval text check (billing_interval in ('month','year')),
  status text not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trip_pass_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Shared cache of destination lookups (catalog, geocoding, Places). Service-written.
create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  lat double precision,
  lng double precision,
  data jsonb not null default '{}',
  source text not null,
  fetched_at timestamptz not null default now()
);

create table public.destination_views (
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete set null,
  title text not null,
  destination_name text not null,
  destination_country text,
  dest_lat double precision,
  dest_lng double precision,
  origin_city text,
  start_date date not null,
  end_date date not null,
  travelers int not null default 1 check (travelers between 1 and 30),
  budget numeric(12,2) not null check (budget >= 0),
  currency text not null default 'USD',
  vacation_style text,
  status text not null default 'planning' check (status in ('planning','booked','completed','archived')),
  is_favorite boolean not null default false,
  cover_image text,
  notes text,
  emergency_contacts jsonb not null default '[]',
  packing_list jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index trips_owner_idx on public.trips(owner_id);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members(user_id);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token text not null unique,
  email text,
  role text not null default 'editor' check (role in ('editor','viewer')),
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz,
  revoked boolean not null default false,
  uses int not null default 0,
  created_at timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites(trip_id);

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  summary text,
  assumptions jsonb not null default '[]',
  savings_tips jsonb not null default '[]',
  generated_by text not null,           -- e.g. 'openai:gpt-5-mini' or 'demo-catalog'
  budget_at_generation numeric(12,2),
  generated_at timestamptz not null default now()
);

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null,
  date date,
  title text,
  summary text,
  unique (itinerary_id, day_number)
);
create index itinerary_days_trip_idx on public.itinerary_days(trip_id);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  area text,
  description text,
  address text,
  lat double precision,
  lng double precision,
  hotel_type text,
  tier text check (tier in ('budget','mid','luxury')),
  est_nightly numeric(12,2),            -- estimate, never a live price
  rating numeric(3,1),                  -- only set when verified by a provider
  rating_count int,
  distance_note text,
  booking_url text,
  image_url text,
  selected boolean not null default false,
  source text not null,                 -- 'ai' | 'catalog' | 'google_places' | 'user'
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index hotels_trip_idx on public.hotels(trip_id);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  cuisine text,
  price_level smallint check (price_level between 1 and 4),
  description text,
  address text,
  lat double precision,
  lng double precision,
  est_cost_pp numeric(12,2),
  rating numeric(3,1),
  rating_count int,
  website_url text,
  image_url text,
  status text not null default 'recommended' check (status in ('recommended','suggested')),
  suggested_by uuid references public.users(id) on delete set null,
  source text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index restaurants_trip_idx on public.restaurants(trip_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text,
  description text,
  address text,
  lat double precision,
  lng double precision,
  est_cost_pp numeric(12,2),
  duration_min int,
  indoor boolean,
  rating numeric(3,1),
  rating_count int,
  website_url text,
  image_url text,
  status text not null default 'recommended' check (status in ('recommended','suggested')),
  suggested_by uuid references public.users(id) on delete set null,
  source text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index activities_trip_idx on public.activities(trip_id);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  position int not null default 0,
  slot text not null check (slot in ('morning','afternoon','evening')),
  kind text not null check (kind in ('activity','restaurant','transport','free')),
  title text not null,
  description text,
  start_time text,
  duration_min int,
  est_cost_pp numeric(12,2),
  address text,
  lat double precision,
  lng double precision,
  transport_note text,
  -- {minutes, meters, mode, source, fetched_at}; only ever written from a routing provider
  travel_from_prev jsonb,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  source text not null default 'ai',
  created_at timestamptz not null default now()
);
create index itinerary_items_day_idx on public.itinerary_items(day_id, position);
create index itinerary_items_trip_idx on public.itinerary_items(trip_id);

create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  paid_by uuid references public.users(id) on delete set null,
  category text not null check (category in ('flights','hotel','food','transportation','activities','shopping','nightlife','misc','emergency')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'estimated' check (status in ('estimated','booked','paid')),
  is_shared boolean not null default false,
  incurred_on date,
  source text not null default 'manual', -- 'manual' | 'ai'
  created_at timestamptz not null default now()
);
create index trip_expenses_trip_idx on public.trip_expenses(trip_id);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(12,2) not null,
  settled boolean not null default false,
  settled_at timestamptz,
  unique (expense_id, user_id)
);
create index expense_splits_trip_idx on public.expense_splits(trip_id);

create table public.group_polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  question text not null,
  kind text not null default 'other' check (kind in ('destination','activity','restaurant','other')),
  options jsonb not null,               -- [{id, label}]
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index group_polls_trip_idx on public.group_polls(trip_id);

create table public.group_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table public.trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index trip_comments_trip_idx on public.trip_comments(trip_id, created_at);

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  name text not null,
  kind text,
  note text,
  address text,
  lat double precision,
  lng double precision,
  url text,
  source text not null default 'user',
  created_at timestamptz not null default now()
);
create index saved_places_user_idx on public.saved_places(user_id);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_conversations_user_idx on public.chat_conversations(user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  places jsonb not null default '[]',
  meta jsonb not null default '{}',     -- {mode, model, sources:[{name, fetched_at}]}
  created_at timestamptz not null default now()
);
create index chat_messages_conv_idx on public.chat_messages(conversation_id, created_at);

create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  doc_type text not null default 'other' check (doc_type in ('booking','ticket','insurance','id','other')),
  confirmation_code text,
  mime_type text not null,
  size_bytes int not null,
  storage_path text not null,           -- private bucket path; never a public URL
  created_at timestamptz not null default now()
);
create index uploaded_documents_trip_idx on public.uploaded_documents(trip_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

-- AI metering: drives per-plan limits and cost monitoring. Service-written.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null,                   -- 'trip_generation' | 'day_regen' | 'concierge' | 'discover' | 'budget'
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  est_cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage(user_id, kind, created_at);

-- Processed Stripe events, for webhook idempotency.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
