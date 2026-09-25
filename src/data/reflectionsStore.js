import { getMentions } from "@/lib/mentions";
import { deleteExperiencePhoto, getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "reflections";
const MY_REFLECTION_IDS_KEY = "myReflectionIds";

// Migrated off localStorage onto Supabase — see the "reflections" table (a
// real experience_id foreign key referencing experiences.id, on delete
// cascade) and its RLS policies. Every function here is now async. photo
// still holds a real Supabase Storage public URL (uploaded by the caller
// — see handleReflectionPhotoFileChange in /experiences/[id]/page.tsx —
// before addReflection() is called), same as before this migration and
// the same pattern already used by photosStore.js.
//
// guestName is no longer collected on submission (removed from the form,
// matching how Updates has never asked for one) — new entries are saved
// with guestName: "". Older entries that already had a name are gone now
// anyway, since this migration starts fresh rather than carrying over old
// localStorage data.
//
// FUTURE: once guest accounts exist, attribute each reflection to the
// logged-in guest automatically (store userId, display their name from
// the account). Until then, entries are unattributed, same as Updates.

// The 6 fixed prompts. The last is open-ended — text is null, and the
// submitter supplies their own promptText instead of picking one of these.
export const REFLECTION_PROMPTS = [
  {
    id: 1,
    text: "Did you have a moment of real connection with someone here that's stuck with you?",
  },
  {
    id: 2,
    text: "What's a memory you shared together that you know you'll bring up for years to come?",
  },
  {
    id: 3,
    text: "Did someone here teach you something — big or small — you're taking with you?",
  },
  {
    id: 4,
    text: "What's a small detail from this Experience you don't want to forget?",
  },
  {
    id: 5,
    text: "Who do you wish had been here to share this with — and how are you going to tell them about it?",
  },
  { id: 6, text: null },
];

export const OPEN_ENDED_REFLECTION_PROMPT_ID = 6;

function rowToReflection(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    promptId: row.prompt_id,
    promptText: row.prompt_text,
    responseText: row.response_text,
    // Derived from @mention tokens inline in response_text (see
    // @/lib/mentions) — separate from taggedGuests, the "with …" tags.
    mentions: getMentions(row.response_text),
    photo: row.photo ?? null,
    guestName: row.guest_name ?? "",
    taggedGuests: row.tagged_guests ?? [],
    createdAt: row.created_at,
    hidden: row.hidden ?? false,
    editedAt: row.edited_at ?? null,
  };
}

function reflectionToRow(reflection) {
  const row = {};
  if (reflection.experienceId !== undefined)
    row.experience_id = Number(reflection.experienceId);
  if (reflection.promptId !== undefined) row.prompt_id = reflection.promptId;
  if (reflection.promptText !== undefined) row.prompt_text = reflection.promptText;
  if (reflection.responseText !== undefined) row.response_text = reflection.responseText;
  if (reflection.photo !== undefined) row.photo = reflection.photo;
  if (reflection.guestName !== undefined) row.guest_name = reflection.guestName;
  if (reflection.taggedGuests !== undefined) row.tagged_guests = reflection.taggedGuests;
  if (reflection.hidden !== undefined) row.hidden = reflection.hidden;
  if (reflection.editedAt !== undefined) row.edited_at = reflection.editedAt;
  return row;
}

// Newest first; hidden entries never appear here, for host or guest.
export async function getReflections(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .eq("hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reflectionsStore] getReflections failed:", error);
    return [];
  }
  return data.map(rowToReflection);
}

export async function addReflection(reflection) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(reflectionToRow(reflection))
    .select()
    .single();

  if (error) {
    console.error("[reflectionsStore] addReflection failed:", error);
    throw error;
  }
  return rowToReflection(data);
}

// Self-editing (see handleSubmitReflection in /experiences/[id]/page.tsx):
// only fields the submitter controls are ever passed in updates (promptId,
// promptText, responseText, photo, taggedGuests) — id, experienceId, and
// createdAt are never touched, so an edit revises the entry in place
// without disturbing when it was originally posted or its ownership.
export async function updateReflection(id, updates) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ ...reflectionToRow(updates), edited_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[reflectionsStore] updateReflection failed:", error);
    return null;
  }
  return rowToReflection(data);
}

// Soft delete for host moderation — sets hidden: true rather than
// removing the record, so this is reversible later even though there's
// no "undo" affordance in the UI yet.
export async function hideReflection(id) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ hidden: true })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[reflectionsStore] hideReflection failed:", error);
    return null;
  }
  return rowToReflection(data);
}

// Removes every reflection for an experience — used when the experience
// itself is deleted, so nothing is left orphaned, including each
// reflection's photo file in Supabase Storage (hideReflection, above,
// deliberately does NOT do this — soft-deleted reflections stay
// reversible, photo included). The table's own experience_id foreign key
// is ON DELETE CASCADE for the database ROWS, but that can't reach
// outside the database — deleting each Storage file first, below, is
// still the only thing that prevents orphaned files sitting in Storage
// with no record pointing at them.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { data: rows, error: selectError } = await supabase
    .from(TABLE_NAME)
    .select("photo")
    .eq("experience_id", Number(experienceId));

  if (selectError) {
    console.error("[reflectionsStore] deleteAllForExperience lookup failed:", selectError);
  } else {
    await Promise.all(
      rows.filter((row) => row.photo).map((row) => deleteExperiencePhoto(row.photo))
    );
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[reflectionsStore] deleteAllForExperience failed:", error);
  }
}

// Tracks which reflection ids were submitted from this browser/device, so
// the feed can offer Edit only on entries the current visitor actually
// wrote — the same pre-accounts, localStorage-as-identity pattern used
// elsewhere in the app (e.g. votedPollIds), not real authentication. A
// different browser/device never sees Edit on the same entry, and clearing
// site data forgets ownership entirely — both accepted trade-offs of this
// approach. This stays in localStorage untouched by the Supabase
// migration above, since it's a per-browser flag, not shared reflection
// data.
export function getMyReflectionIds() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(MY_REFLECTION_IDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addMyReflectionId(id) {
  if (typeof window === "undefined") return;

  const current = getMyReflectionIds();
  if (current.includes(id)) return;

  window.localStorage.setItem(
    MY_REFLECTION_IDS_KEY,
    JSON.stringify([...current, id])
  );
}

// One-time cleanup: this store no longer reads/writes reflection data in
// localStorage, so the old "yhtbt:reflections" key is dead data now
// rather than left lingering indefinitely. Existing local test
// reflections are deliberately NOT migrated into Supabase — starting
// fresh, same choice already made for every other migrated store. Note
// "myReflectionIds" is NOT removed here — that key is still actively
// used, see above.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:reflections");
}
