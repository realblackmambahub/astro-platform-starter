-- Fix event_type constraint to accept 'access' and 'download'
alter table download_events drop constraint if exists download_events_event_type_check;

alter table download_events add constraint download_events_event_type_check 
  check (event_type in ('access', 'download'));

-- Create RPC function to increment access count
create or replace function increment_access_count(link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update download_links
  set access_count = coalesce(access_count, 0) + 1,
      updated_at = now()
  where id = link_id;
$$;

-- Create RPC function to increment download count
create or replace function increment_download_count(link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update download_links
  set download_count = coalesce(download_count, 0) + 1,
      updated_at = now()
  where id = link_id;
$$;
