-- TripCraft database setup for plain Postgres (Neon and similar). GENERATED FILE: do not edit.
-- Paste the whole file into your provider's SQL editor and run it once on an empty database.
-- Not for Supabase projects: use the files in supabase/migrations there.

-- Stand-in for the parts of Supabase that the migrations depend on (roles, auth.users,
-- auth.uid()), plus server-only tables used when TripCraft runs without Supabase:
-- local demo mode and self-hosting on plain Postgres such as Neon.
-- Never run this against a Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
-- The app connects as the database owner and switches to `authenticated` for every user query.
-- On managed Postgres the owner is not a superuser, so it needs explicit permission to do that.
do $$ begin
  execute format('grant authenticated to %I with set true', current_user);
exception when others then
  begin
    execute format('grant authenticated to %I', current_user);
  exception when others then null; -- superusers can already switch role
  end;
end $$;
-- Fail loudly here rather than with a confusing error at sign-up time.
do $$ declare can boolean; begin
  begin
    can := pg_has_role(current_user, 'authenticated', 'SET');
  exception when others then
    can := pg_has_role(current_user, 'authenticated', 'MEMBER'); -- PostgreSQL 15 and older
  end;
  if not can then
    raise exception 'TripCraft setup: the database user "%" is not allowed to act as the "authenticated" role. Run this file as the database owner on a new, empty database.', current_user;
  end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;

-- Uploaded documents. No grants to `authenticated`: only the server can read these bytes, and it
-- does so only after the uploaded_documents row has passed Row Level Security.
create schema if not exists tripcraft_meta;
create table if not exists tripcraft_meta.files (
  path text primary key,
  mime_type text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists tripcraft_meta.migrations (name text primary key, applied_at timestamptz not null default now());

-- ===== 0001_schema.sql =====
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

insert into tripcraft_meta.migrations (name) values ('0001_schema.sql') on conflict do nothing;

-- ===== 0002_security.sql =====
-- Functions, triggers and Row Level Security.

-- ---------- helpers (security definer so policies don't recurse) ----------
create or replace function public.trip_role(tid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from trip_members where trip_id = tid and user_id = auth.uid()
$$;

create or replace function public.is_trip_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = tid and user_id = auth.uid())
$$;

create or replace function public.can_edit_trip(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = tid and user_id = auth.uid() and role in ('owner','editor'))
$$;

create or replace function public.is_trip_owner(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = tid and user_id = auth.uid() and role = 'owner')
$$;

create or replace function public.shares_trip_with(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trip_members a join trip_members b on a.trip_id = b.trip_id
    where a.user_id = auth.uid() and b.user_id = uid)
$$;

-- ---------- triggers ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_trip() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;

create trigger on_trip_created after insert on public.trips
  for each row execute function public.handle_new_trip();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger trips_touch before update on public.trips for each row execute function public.touch_updated_at();
create trigger users_touch before update on public.users for each row execute function public.touch_updated_at();
create trigger prefs_touch before update on public.user_preferences for each row execute function public.touch_updated_at();

-- ---------- invitations ----------
create or replace function public.peek_invite(p_token text)
returns table (trip_id uuid, trip_title text, destination_name text, inviter_name text, role text)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.destination_name, coalesce(u.full_name, split_part(u.email, '@', 1)), i.role
  from trip_invites i join trips t on t.id = i.trip_id join users u on u.id = i.created_by
  where i.token = p_token and not i.revoked and (i.expires_at is null or i.expires_at > now())
$$;

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv trip_invites; who text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from trip_invites
   where token = p_token and not revoked and (expires_at is null or expires_at > now());
  if not found then raise exception 'invalid_invite'; end if;
  if exists (select 1 from trip_members where trip_id = inv.trip_id and user_id = auth.uid()) then
    return inv.trip_id;
  end if;
  insert into trip_members (trip_id, user_id, role) values (inv.trip_id, auth.uid(), inv.role);
  update trip_invites set uses = uses + 1 where id = inv.id;
  select coalesce(full_name, split_part(email, '@', 1)) into who from users where id = auth.uid();
  insert into notifications (user_id, type, title, body, link)
  values (inv.created_by, 'member_joined', who || ' joined your trip', null, '/trips/' || inv.trip_id || '/group');
  return inv.trip_id;
end $$;

-- Lets a trip member notify the other members without being able to write arbitrary notifications.
create or replace function public.notify_trip_members(p_trip uuid, p_type text, p_title text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_trip_member(p_trip) then raise exception 'forbidden'; end if;
  insert into notifications (user_id, type, title, link)
  select user_id, left(p_type, 40), left(p_title, 200), '/trips/' || p_trip || coalesce(p_link, '')
  from trip_members where trip_id = p_trip and user_id <> auth.uid();
end $$;

-- ---------- grants ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
-- Billing, metering and shared caches are written by the server's service connection only.
revoke insert, update, delete on public.subscriptions, public.ai_usage, public.destinations, public.stripe_events from authenticated;
revoke select on public.stripe_events from authenticated;
revoke insert on public.notifications from authenticated;

-- ---------- RLS ----------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profile data
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or shares_trip_with(id));
create policy users_update on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy prefs_all on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy subs_select on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy usage_select on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy destinations_select on public.destinations for select to authenticated using (true);
create policy views_all on public.destination_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trips & membership
create policy trips_select on public.trips for select to authenticated
  using (owner_id = auth.uid() or is_trip_member(id));
create policy trips_insert on public.trips for insert to authenticated with check (owner_id = auth.uid());
create policy trips_update on public.trips for update to authenticated
  using (can_edit_trip(id)) with check (can_edit_trip(id));
create policy trips_delete on public.trips for delete to authenticated using (owner_id = auth.uid());

create policy members_select on public.trip_members for select to authenticated using (is_trip_member(trip_id));
create policy members_update on public.trip_members for update to authenticated
  using (is_trip_owner(trip_id) and role <> 'owner') with check (is_trip_owner(trip_id) and role in ('editor','viewer'));
create policy members_delete on public.trip_members for delete to authenticated
  using (role <> 'owner' and (is_trip_owner(trip_id) or user_id = auth.uid()));
-- (no insert policy: members are added by handle_new_trip() and accept_invite())

create policy invites_all on public.trip_invites for all to authenticated
  using (is_trip_owner(trip_id)) with check (is_trip_owner(trip_id) and created_by = auth.uid());

-- itinerary: members read, owners/editors write
do $$ declare t text; begin
  foreach t in array array['itineraries','itinerary_days','itinerary_items','hotels'] loop
    execute format('create policy %I on public.%I for select to authenticated using (is_trip_member(trip_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (can_edit_trip(trip_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (can_edit_trip(trip_id))', t || '_delete', t);
  end loop;
  -- recommendation pools: any member may add a *suggestion*; only editors curate
  foreach t in array array['restaurants','activities'] loop
    execute format('create policy %I on public.%I for select to authenticated using (is_trip_member(trip_id))', t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (
      can_edit_trip(trip_id) or (is_trip_member(trip_id) and status = 'suggested' and suggested_by = auth.uid()))$p$, t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (can_edit_trip(trip_id) or suggested_by = auth.uid())', t || '_delete', t);
  end loop;
end $$;

-- money
create policy expenses_select on public.trip_expenses for select to authenticated using (is_trip_member(trip_id));
create policy expenses_insert on public.trip_expenses for insert to authenticated
  with check (can_edit_trip(trip_id) and created_by = auth.uid());
create policy expenses_update on public.trip_expenses for update to authenticated
  using (can_edit_trip(trip_id)) with check (can_edit_trip(trip_id));
create policy expenses_delete on public.trip_expenses for delete to authenticated using (can_edit_trip(trip_id));

create policy splits_select on public.expense_splits for select to authenticated using (is_trip_member(trip_id));
create policy splits_insert on public.expense_splits for insert to authenticated with check (can_edit_trip(trip_id));
create policy splits_update on public.expense_splits for update to authenticated
  using (can_edit_trip(trip_id) or user_id = auth.uid()) with check (can_edit_trip(trip_id) or user_id = auth.uid());
create policy splits_delete on public.expense_splits for delete to authenticated using (can_edit_trip(trip_id));

-- group collaboration (viewers can vote and comment)
create policy polls_select on public.group_polls for select to authenticated using (is_trip_member(trip_id));
create policy polls_insert on public.group_polls for insert to authenticated
  with check (can_edit_trip(trip_id) and created_by = auth.uid());
create policy polls_update on public.group_polls for update to authenticated
  using (created_by = auth.uid() or is_trip_owner(trip_id)) with check (is_trip_member(trip_id));
create policy polls_delete on public.group_polls for delete to authenticated
  using (created_by = auth.uid() or is_trip_owner(trip_id));

create policy votes_select on public.group_votes for select to authenticated using (is_trip_member(trip_id));
create policy votes_insert on public.group_votes for insert to authenticated
  with check (user_id = auth.uid() and is_trip_member(trip_id));
create policy votes_update on public.group_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_trip_member(trip_id));
create policy votes_delete on public.group_votes for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.trip_comments for select to authenticated using (is_trip_member(trip_id));
create policy comments_insert on public.trip_comments for insert to authenticated
  with check (user_id = auth.uid() and is_trip_member(trip_id));
create policy comments_delete on public.trip_comments for delete to authenticated
  using (user_id = auth.uid() or is_trip_owner(trip_id));

-- private per-user data
create policy saved_all on public.saved_places for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (trip_id is null or is_trip_member(trip_id)));
create policy conv_all on public.chat_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (trip_id is null or is_trip_member(trip_id)));
create policy msg_all on public.chat_messages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- documents: trip members only
create policy docs_select on public.uploaded_documents for select to authenticated using (is_trip_member(trip_id));
create policy docs_insert on public.uploaded_documents for insert to authenticated
  with check (can_edit_trip(trip_id) and uploaded_by = auth.uid());
create policy docs_delete on public.uploaded_documents for delete to authenticated
  using (uploaded_by = auth.uid() or is_trip_owner(trip_id));

insert into tripcraft_meta.migrations (name) values ('0002_security.sql') on conflict do nothing;
