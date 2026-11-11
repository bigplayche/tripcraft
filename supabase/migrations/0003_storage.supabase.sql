-- Supabase-only: private bucket for travel documents. (Skipped by the local PGlite fallback.)
-- Objects are stored at  <trip_id>/<uuid>-<filename>  and are only reachable by trip members.
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-documents', 'trip-documents', false, 4194304)
on conflict (id) do update set public = false;

create policy "trip members read documents" on storage.objects for select to authenticated
  using (bucket_id = 'trip-documents' and public.is_trip_member(((storage.foldername(name))[1])::uuid));
create policy "trip editors upload documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-documents' and public.can_edit_trip(((storage.foldername(name))[1])::uuid));
create policy "uploader or owner deletes documents" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-documents' and (owner = auth.uid() or public.is_trip_owner(((storage.foldername(name))[1])::uuid)));
