const BROWSER_ID_STORAGE_KEY = "yhtbt:browserId";

// Not real authentication — a random, per-browser id that stands in for
// "whose profile is this" until real accounts exist, the same pre-accounts
// pattern as creatorName. Generated once and kept in localStorage, so
// clearing site data starts a fresh (empty) profile. Sent as the
// x-browser-id header on profiles requests, which the profiles table's
// RLS policies match against (see supabase/migrations).
export function getBrowserId(): string {
  const stored = window.localStorage.getItem(BROWSER_ID_STORAGE_KEY);
  if (stored) return stored;

  const created = crypto.randomUUID();
  window.localStorage.setItem(BROWSER_ID_STORAGE_KEY, created);
  return created;
}
