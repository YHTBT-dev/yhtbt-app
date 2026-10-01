-- Profiles: allow two more dietary options, "Pescetarian" and "Other", on
-- top of the original 9 from 20261001010000_profiles_dietary_options.sql.
-- Widening only — every value allowed before is still allowed, so existing
-- rows pass the new check.
--
-- The allowed options must match DIETARY_OPTIONS in src/lib/dietary.ts.
--
-- Run once in the Supabase dashboard's SQL editor.

alter table public.profiles
  drop constraint profiles_dietary_options_allowed;

alter table public.profiles
  add constraint profiles_dietary_options_allowed check (
    dietary_options <@ array[
      'No Restrictions',
      'Vegetarian',
      'Pescetarian',
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
