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
