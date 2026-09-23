import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "itinerary_items";

// type is pure categorization for a per-item icon on the schedule display
// — it never triggers extra structured fields; detailed flight/hotel/
// transport data entry stays exclusively in Travel Details.
export const ITINERARY_ITEM_TYPES = [
  "Flight",
  "Transportation",
  "Hotel",
  "Meal",
  "Event/Excursion",
  "Generic",
];

export const DEFAULT_ITINERARY_ITEM_TYPE = "Generic";

// Migrated off localStorage onto Supabase — see the "itinerary_items"
// table (a real experience_id foreign key referencing experiences.id, on
// delete cascade, plus a check constraint restricting type to
// ITINERARY_ITEM_TYPES) and its RLS policies. Every function here is now
// async. experienceId stays a plain string everywhere else in the app
// (route params, String(id) === experienceId comparisons) — the table's
// experience_id column is a real bigint, so rowToItem/itemToRow convert
// between the two, same pattern as experiencesStore.js and guestsStore.js.
//
// startTime/endTime stay plain "HH:MM" text columns (not Postgres time)
// — the app only ever does string comparisons/formatting on them, never
// SQL-side time arithmetic, and "HH:MM" 24-hour strings already sort
// correctly as plain text, so getItineraryItems can sort server-side via
// .order() instead of the old client-side timeToMinutes helper.

function rowToItem(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    dressCode: row.dress_code ?? undefined,
    type: row.type ?? DEFAULT_ITINERARY_ITEM_TYPE,
  };
}

function itemToRow(item) {
  const row = {};
  if (item.experienceId !== undefined) row.experience_id = Number(item.experienceId);
  if (item.date !== undefined) row.date = item.date;
  if (item.startTime !== undefined) row.start_time = item.startTime;
  if (item.endTime !== undefined) row.end_time = item.endTime;
  if (item.title !== undefined) row.title = item.title;
  if (item.description !== undefined) row.description = item.description;
  if (item.location !== undefined) row.location = item.location;
  if (item.dressCode !== undefined) row.dress_code = item.dressCode || null;
  if (item.type !== undefined) row.type = item.type;
  return row;
}

export async function getItineraryItems(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[itineraryStore] getItineraryItems failed:", error);
    return [];
  }
  return data.map(rowToItem);
}

export async function addItineraryItem(item) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(itemToRow(item))
    .select()
    .single();

  if (error) {
    console.error("[itineraryStore] addItineraryItem failed:", error);
    throw error;
  }
  return rowToItem(data);
}

export async function updateItineraryItem(id, fields) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(itemToRow(fields))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[itineraryStore] updateItineraryItem failed:", error);
    return null;
  }
  return rowToItem(data);
}

export async function deleteItineraryItem(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    console.error("[itineraryStore] deleteItineraryItem failed:", error);
  }
}

// Removes every itinerary item for an experience — used when the
// experience itself is deleted, so nothing is left orphaned. The table's
// own experience_id foreign key is ON DELETE CASCADE, so this is now a
// belt-and-braces call rather than the only thing preventing orphaned
// rows — deleting the experience row directly would clean these up too.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[itineraryStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:itinerary" key is dead data now rather than
// left lingering indefinitely. Existing local test items are
// deliberately NOT migrated into Supabase — starting fresh there, same
// call already made for Photos and Guests — so this just clears the
// stale key; removeItem on an already-removed key is a no-op, safe to
// run on every load.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:itinerary");
}
