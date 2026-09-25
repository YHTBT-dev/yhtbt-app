import { getMentions } from "@/lib/mentions";
import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "updates";

// Migrated off localStorage onto Supabase — see the "updates" table (a
// real experience_id foreign key referencing experiences.id, on delete
// cascade) and its RLS policies. Every function here is now async. The
// app's "timestamp" field maps to the table's created_at column, set by
// the database itself (default now()) rather than the browser's clock —
// more reliable, and "newest first" sorting is just an order() on it.

// "mentions" is derived, not a column: tagged guests are stored inline in
// message as "@[Name](guest:<id>)" tokens (see @/lib/mentions), and
// surfaced here as [{ guestId, name }] for anything that needs who was
// tagged without rendering the text.
function rowToUpdate(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    message: row.message,
    mentions: getMentions(row.message),
    timestamp: row.created_at,
  };
}

function updateToRow(update) {
  const row = {};
  if (update.experienceId !== undefined) row.experience_id = Number(update.experienceId);
  if (update.message !== undefined) row.message = update.message;
  return row;
}

export async function getUpdates(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId))
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[updatesStore] getUpdates failed:", error);
    return [];
  }
  return data.map(rowToUpdate);
}

export async function addUpdate(update) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(updateToRow(update))
    .select()
    .single();

  if (error) {
    console.error("[updatesStore] addUpdate failed:", error);
    throw error;
  }
  return rowToUpdate(data);
}

// Removes every update for an experience — used when the experience
// itself is deleted, so nothing is left orphaned. The table's own
// experience_id foreign key is ON DELETE CASCADE, so this call is
// belt-and-braces cleanup rather than the only thing preventing orphaned
// rows.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[updatesStore] deleteAllForExperience failed:", error);
  }
}

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:updates" key is dead data now rather than left
// lingering indefinitely. Existing local test updates are deliberately
// NOT migrated into Supabase — starting fresh, same choice already made
// for every other migrated store.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:updates");
}
