-- Profiles: switch the "Pescetarian" dietary option to the more common US
-- spelling, "Pescatarian".
--
-- Safe to run whether or not 20261001020000 (which added "Pescetarian"
-- and "Other") has been run: the old constraint is dropped if present,
-- any saved "Pescetarian" is rewritten, then the constraint is recreated
-- with the full current list.
--
-- The allowed options must match DIETARY_OPTIONS in src/lib/dietary.ts.
--
-- Run once in the Supabase dashboard's SQL editor.

alter table public.profiles
  drop constraint if exists profiles_dietary_options_allowed;

update public.profiles
  set dietary_options = array_replace(dietary_options, 'Pescetarian', 'Pescatarian')
  where 'Pescetarian' = any (dietary_options);

alter table public.profiles
  add constraint profiles_dietary_options_allowed check (
    dietary_options <@ array[
      'No Restrictions',
      'Vegetarian',
      'Pescatarian',
      'Vegan',
      'Gluten-Free',
      'Dairy-Free',
      'Nut Allergy',
      'Shellfish Allergy',
      'Halal',
      'Kosher',
      'Other'
    ]::text[]
  );
