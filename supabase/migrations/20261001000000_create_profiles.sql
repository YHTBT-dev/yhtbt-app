-- Profiles: one row per browser, for the /profile tab.
--
-- There are no real accounts yet, so a profile belongs to a browser, not a
-- person — the same honest stand-in as creatorName (src/lib/creatorName.ts).
-- Each browser generates a random id once (src/lib/browserId.ts) and sends
-- it as an "x-browser-id" header on every profiles request
-- (src/data/profilesStore.js). The RLS policies below only let a request
-- see or change the row whose browser_id matches that header.
--
-- Not real security: anyone who learns a browser's id can act as that
-- browser. But the id is a random UUID, and unlike the wide-open anon
-- policies on experiences there's no policy that lists or reads anyone
-- else's profile, and no delete at all.
--
-- Run once in the Supabase dashboard's SQL editor.

create table public.profiles (
  id bigint generated always as identity primary key,
  browser_id uuid not null unique,
  first_name text not null default '',
  last_name text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  photo_url text not null default '',
  linkedin text not null default '',
  instagram text not null default '',
  x_handle text not null default '',
  dietary_restrictions text not null default '',
  home_city text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();

-- The x-browser-id header of the current request, or '' if missing.
-- Compared as text so a malformed header just matches nothing instead of
-- erroring on a uuid cast.
create function public.request_browser_id()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.headers', true)::json ->> 'x-browser-id',
    ''
  );
$$;

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to anon;

create policy "Browsers can read their own profile"
  on public.profiles for select
  to anon
  using (browser_id::text = public.request_browser_id());

create policy "Browsers can create their own profile"
  on public.profiles for insert
  to anon
  with check (browser_id::text = public.request_browser_id());

create policy "Browsers can update their own profile"
  on public.profiles for update
  to anon
  using (browser_id::text = public.request_browser_id())
  with check (browser_id::text = public.request_browser_id());
