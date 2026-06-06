-- Public storage bucket for image capture: menu/flyer/counter uploads, event
-- posters, and AI-generated product images. Created via migration so no manual
-- dashboard step is needed.
insert into storage.buckets (id, name, public)
values ('marketplace-media', 'marketplace-media', true)
on conflict (id) do update set public = true;

-- Public read; open write (the app gates every upload behind Clerk auth +
-- resolveActor before calling storage, mirroring the other open-RLS tables).
drop policy if exists "media_public_read" on storage.objects;
drop policy if exists "media_open_insert" on storage.objects;
drop policy if exists "media_open_update" on storage.objects;

create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'marketplace-media');
create policy "media_open_insert" on storage.objects
  for insert with check (bucket_id = 'marketplace-media');
create policy "media_open_update" on storage.objects
  for update using (bucket_id = 'marketplace-media');
