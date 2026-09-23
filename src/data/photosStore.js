import { deleteExperiencePhoto, getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "photos";

// Migrated off localStorage onto Supabase — see the "photos" table (a
// real experience_id foreign key referencing experiences.id, on delete
// cascade; itinerary_item_id references itinerary_items.id, on delete
// SET NULL — losing the linked itinerary item unlinks the photo rather
// than deleting it) and its RLS policies. Every function here is now
// async. experienceId/itineraryItemId stay plain strings/numbers
// matching how the rest of the app already uses them; rowToPhoto/
// photoToRow convert to the table's real bigint foreign keys.
//
// Only the metadata record moved here — uploading to and deleting from
// Supabase Storage itself (see uploadExperiencePhoto/deleteExperiencePhoto
// in @/lib/supabase) is untouched, called exactly the same way as before
// from the pages that use this store.
//
// The DB column is "url" (clean, no legacy naming); the JS field stays
// "dataUrl" — the existing name used everywhere in the app, kept
// deliberately unchanged when the value itself moved from a base64
// string to a real Storage URL, and unchanged again by this migration.
//
// Deleting an Experience's photo ROWS is covered by the database's own
// ON DELETE CASCADE, but that can't reach outside the database — the
// actual Storage FILES are only ever cleaned up by deleteAllForExperience
// below actually running (deleting each file, then its row), same as
// before this migration. That call in deleteExperienceCascade.js is
// still what makes that happen, not the database on its own.

function rowToPhoto(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    dataUrl: row.url,
    taggedNames: row.tags ?? [],
    itineraryItemId: row.itinerary_item_id ?? null,
    timestamp: row.created_at,
  };
}

function photoToRow(photo) {
  const row = {};
  if (photo.experienceId !== undefined) row.experience_id = Number(photo.experienceId);
  if (photo.dataUrl !== undefined) row.url = photo.dataUrl;
  if (photo.taggedNames !== undefined) row.tags = photo.taggedNames;
  if (photo.itineraryItemId !== undefined)
    row.itinerary_item_id = photo.itineraryItemId ?? null;
  return row;
}

export async function getPhotos(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[photosStore] getPhotos failed:", error);
    return [];
  }
  return data.map(rowToPhoto);
}

export async function addPhoto(photo) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(photoToRow(photo))
    .select()
    .single();

  if (error) {
    console.error("[photosStore] addPhoto failed:", error);
    throw error;
  }
  return rowToPhoto(data);
}

// Replaces a photo's full tag list (not a merge) — removing a tag from
// the caller's array actually removes it, rather than only appending.
export async function setPhotoTags(photoId, names) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ tags: names })
    .eq("id", photoId)
    .select()
    .single();

  if (error) {
    console.error("[photosStore] setPhotoTags failed:", error);
    return null;
  }
  return rowToPhoto(data);
}

// Sets (or clears, passing null) which itinerary item a photo is linked
// to. Replaces rather than merges, since a photo can only link to one
// moment at a time.
export async function setPhotoItineraryItem(photoId, itineraryItemId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ itinerary_item_id: itineraryItemId ?? null })
    .eq("id", photoId)
    .select()
    .single();

  if (error) {
    console.error("[photosStore] setPhotoItineraryItem failed:", error);
    return null;
  }
  return rowToPhoto(data);
}

// Deletes the actual image file from Supabase Storage first, then the
// database record — same order/behavior as before this migration. The
// record is still removed even if the Storage delete fails (e.g.
// offline), so a stuck record can't block the rest of the UI; that
// failure is only logged (see deleteExperiencePhoto in @/lib/supabase).
export async function deletePhoto(photoId) {
  const supabase = getSupabaseClient();
  const { data: row } = await supabase
    .from(TABLE_NAME)
    .select("url")
    .eq("id", photoId)
    .maybeSingle();

  if (row?.url) {
    await deleteExperiencePhoto(row.url);
  }

  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", photoId);
  if (error) {
    console.error("[photosStore] deletePhoto failed:", error);
  }
}

// Removes every photo for an experience — used when the experience
// itself is deleted, so nothing is left orphaned, including each photo's
// file in Supabase Storage. The table's own experience_id foreign key is
// ON DELETE CASCADE for the database ROWS, but that can't clean up
// Storage files on its own — this call deleting each file first is still
// the only thing that does that (see the module comment above).
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { data: rows, error: selectError } = await supabase
    .from(TABLE_NAME)
    .select("url")
    .eq("experience_id", Number(experienceId));

  if (selectError) {
    console.error("[photosStore] deleteAllForExperience lookup failed:", selectError);
  } else {
    await Promise.all(
      rows.filter((row) => row.url).map((row) => deleteExperiencePhoto(row.url))
    );
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[photosStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:photos" key is dead data now rather than left
// lingering indefinitely. Existing local test photo METADATA is
// deliberately NOT migrated into Supabase — starting fresh there, same
// call already made for Guests, Itinerary Items, and Travel Details (the
// actual image files already lived in Storage, untouched by this
// cleanup, only their old localStorage metadata records are discarded)
// — so this just clears the stale key; removeItem on an already-removed
// key is a no-op, safe to run on every load.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:photos");
}
