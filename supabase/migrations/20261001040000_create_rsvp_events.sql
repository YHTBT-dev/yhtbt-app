-- RSVP events: a log of every guest RSVP status as it's set, for the
-- Activity feed (src/data/activityStore.js).
--
-- The guests table only holds each guest's CURRENT status and when the
-- guest was added, so past status changes can't be reconstructed. This
-- log starts empty and records changes from the moment it's created — no
-- backfill, since guests.created_at is only the RSVP time for some guests
-- (self-RSVPs), not for host-added guests who responded later.
--
-- Rows are written by a trigger on guests, not by app code, so every path
-- that sets a status (host status change, self-RSVP, adding a guest who's
-- already confirmed) is captured. Every status is logged, including
-- "invited"; the feed itself leaves invitations out.
--
-- guest_name is a snapshot at the time of the change. Deleting a guest or
-- an Experience deletes its events too (on delete cascade).
--
-- RLS: readable by anon, same openness as experiences (every browser past
-- the testing gate sees everything; see proxy.ts). No insert/update/delete
-- policies — only the security-definer trigger function writes rows.
--
-- Run once in the Supabase dashboard's SQL editor.

create table public.rsvp_events (
  id bigint generated always as identity primary key,
  guest_id bigint not null references public.guests (id) on delete cascade,
  experience_id bigint not null references public.experiences (id) on delete cascade,
  guest_name text not null default '',
  status text not null,
  created_at timestamptz not null default now()
);

create index rsvp_events_created_at_idx
  on public.rsvp_events (created_at desc);
create index rsvp_events_experience_id_created_at_idx
  on public.rsvp_events (experience_id, created_at desc);

create function public.log_rsvp_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.rsvp_status is distinct from old.rsvp_status then
    insert into public.rsvp_events (guest_id, experience_id, guest_name, status)
    values (new.id, new.experience_id, coalesce(new.name, ''), new.rsvp_status);
  end if;
  return new;
end;
$$;

create trigger guests_log_rsvp_event
  after insert or update of rsvp_status on public.guests
  for each row execute function public.log_rsvp_event();

alter table public.rsvp_events enable row level security;

grant select on public.rsvp_events to anon;

create policy "Anyone can read RSVP events"
  on public.rsvp_events for select
  to anon
  using (true);
