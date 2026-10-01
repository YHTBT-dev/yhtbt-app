-- Profiles: split dietary restrictions into preset options + free-text
-- notes (see the Dietary section of /profile).
--
-- The existing free-text column is renamed rather than dropped, so anything
-- already typed there carries over unchanged as the notes. Visibility is
-- unchanged: the same per-browser RLS policies from
-- 20261001000000_create_profiles.sql cover these columns too.
--
-- The allowed options must match DIETARY_OPTIONS in src/lib/dietary.ts.
--
-- Run once in the Supabase dashboard's SQL editor, after the first
-- profiles migration.

alter table public.profiles
  rename column dietary_restrictions to dietary_notes;

alter table public.profiles
  add column dietary_options text[] not null default '{}';

alter table public.profiles
  add constraint profiles_dietary_options_allowed check (
    dietary_options <@ array[
      'Vegetarian',
      'Vegan',
      'Gluten-Free',
      'Dairy-Free',
      'Nut Allergy',
      'Shellfish Allergy',
      'Halal',
      'Kosher',
      'No Restrictions'
    ]::text[]
  );
