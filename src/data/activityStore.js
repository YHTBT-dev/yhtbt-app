import { getSupabaseClient } from "@/lib/supabase";

// The Activity feed: Updates, RSVPs and Photos merged into one list,
// newest first. Read-only — each source is still written by its own store
// (updatesStore, guestsStore, photosStore); RSVP entries come from the
// rsvp_events log a database trigger keeps on guests (see
// supabase/migrations/20261001040000_create_rsvp_events.sql).
//
// No visibility filtering yet: every browser sees every Experience's
// activity, same as the rest of the app before real accounts.
//
// Each source is capped at its PER_SOURCE_LIMIT newest rows before
// merging, so very old entries can be missing from a busy feed. With an
// experienceId the cap applies within that one Experience.

const PER_SOURCE_LIMIT = 100;

// "invited" is logged but left out of the feed — every guest a host adds
// would otherwise appear.
const FEED_RSVP_STATUSES = ["confirmed", "declined"];

async function fetchRecent(table, columns, experienceId, applyFilters) {
  const supabase = getSupabaseClient();
  let query = supabase.from(table).select(columns);
  if (experienceId) query = query.eq("experience_id", Number(experienceId));
  if (applyFilters) query = applyFilters(query);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(PER_SOURCE_LIMIT);

  if (error) {
    console.error(`[activityStore] fetching ${table} failed:`, error);
    throw new Error(error.message);
  }
  return data;
}

// Resolves with feed entries, newest first. Entry shapes:
//   { type: "update", message }
//   { type: "rsvp", guestName, status }
//   { type: "photo", url }
// all with { key, experienceId, timestamp }. Throws if any source fails,
// so the page can say so instead of showing a silently partial feed.
export async function getActivity(experienceId) {
  const [updates, rsvpEvents, photos] = await Promise.all([
    fetchRecent("updates", "id, experience_id, message, created_at", experienceId),
    fetchRecent(
      "rsvp_events",
      "id, experience_id, guest_name, status, created_at",
      experienceId,
      (query) => query.in("status", FEED_RSVP_STATUSES)
    ),
    fetchRecent("photos", "id, experience_id, url, created_at", experienceId),
  ]);

  const entries = [
    ...updates.map((row) => ({
      key: `update-${row.id}`,
      type: "update",
      experienceId: String(row.experience_id),
      timestamp: row.created_at,
      message: row.message,
    })),
    ...rsvpEvents.map((row) => ({
      key: `rsvp-${row.id}`,
      type: "rsvp",
      experienceId: String(row.experience_id),
      timestamp: row.created_at,
      guestName: row.guest_name,
      status: row.status,
    })),
    ...photos.map((row) => ({
      key: `photo-${row.id}`,
      type: "photo",
      experienceId: String(row.experience_id),
      timestamp: row.created_at,
      url: row.url,
    })),
  ];

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
