// Preset dietary options for the Profile, in display order. Must match the
// profiles_dietary_options_allowed check constraint (latest version in
// supabase/migrations/20261001030000_profiles_dietary_options_pescatarian_spelling.sql).
export const DIETARY_OPTIONS = [
  "No Restrictions",
  "Vegetarian",
  "Pescatarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut Allergy",
  "Shellfish Allergy",
  "Halal",
  "Kosher",
  "Other",
] as const;

export const NO_RESTRICTIONS = "No Restrictions";

// Multi-select, except "No Restrictions" contradicts every other option:
// choosing it clears the rest, and choosing anything else clears it.
// Result keeps DIETARY_OPTIONS order regardless of click order.
export function toggleDietaryOption(selected: string[], option: string): string[] {
  if (selected.includes(option)) {
    return selected.filter((item) => item !== option);
  }
  if (option === NO_RESTRICTIONS) return [NO_RESTRICTIONS];

  const next = [...selected.filter((item) => item !== NO_RESTRICTIONS), option];
  return DIETARY_OPTIONS.filter((item) => next.includes(item));
}
