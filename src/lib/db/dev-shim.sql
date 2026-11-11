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
