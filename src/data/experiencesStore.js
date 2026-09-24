import { getSupabaseClient } from "@/lib/supabase";
import {
  getOrPromptCreatorName,
  recordCreatedExperience,
} from "@/lib/creatorName";

const TABLE_NAME = "experiences";

// Optional categorization used to drive the "Suggest FAQs" checklist (see
// suggestedFaqsStore.js) — doesn't gate or block Experience creation.
export const EXPERIENCE_TYPES = [
  "Wedding",
  "Birthday/Celebration",
  "Destination Trip/Group Getaway",
  "Corporate Retreat/Offsite",
  "Conference/Professional Event",
  "Dinner/Party/Social Event",
  "Wellness/Activity-Based Event",
  "Other",
];

// The first store migrated off localStorage onto Supabase (see the
// "experiences" table + RLS policies set up alongside this change) —
// every function here is now async, since a real network request replaces
// what used to be a synchronous localStorage read/write. Every other
// store (guests, itinerary, photos, etc.) still lives in localStorage and
// references an Experience purely by its id as a string (e.g. via route
// params) — Supabase's own auto-generated bigint id is used as the
// primary key here specifically so that convention (String(id) ===
// experienceId, Number(experienceId) when writing) keeps working
// unchanged everywhere else, without needing to touch any other store.
//
// Table columns are snake_case (Postgres convention — unquoted mixed-case
// identifiers get silently lowercased, a real footgun otherwise); rowTo/
// ExperienceToRow below translate to/from this app's usual camelCase
// shape so nothing else in the app needs to know the difference.
//
// RLS on this table is wide open to the anon role (select/insert/update/
// delete) — there's no real per-user auth yet, same tradeoff already made
// for the Storage bucket. Not real security on its own; see proxy.ts.

function rowToExperience(row) {
  return {
    id: row.id,
    name: row.name,
    coverImage: row.cover_image ?? "",
    startDate: row.start_date,
    endDate: row.end_date,
    location: row.location ?? "",
    theme: row.theme ?? "editorial-classic",
    reflectionsEnabled: row.reflections_enabled ?? false,
    showAttendeeCount: row.show_attendee_count ?? false,
    roles: row.roles ?? [],
    paid: row.paid ?? false,
    estimatedGuestCount: row.estimated_guest_count ?? null,
    checkoutSessionId: row.checkout_session_id ?? null,
    createdBy: row.created_by ?? "",
    experienceType: row.experience_type ?? "",
  };
}

// Only maps fields that are actually present on the input, so a partial
// update() call doesn't accidentally overwrite unrelated columns with
// undefined/null.
function experienceToRow(experience) {
  const row = {};
  if (experience.name !== undefined) row.name = experience.name;
  if (experience.coverImage !== undefined) row.cover_image = experience.coverImage;
  if (experience.startDate !== undefined) row.start_date = experience.startDate;
  if (experience.endDate !== undefined) row.end_date = experience.endDate;
  if (experience.location !== undefined) row.location = experience.location;
  if (experience.theme !== undefined) row.theme = experience.theme;
  if (experience.reflectionsEnabled !== undefined)
    row.reflections_enabled = experience.reflectionsEnabled;
  if (experience.showAttendeeCount !== undefined)
    row.show_attendee_count = experience.showAttendeeCount;
  if (experience.roles !== undefined) row.roles = experience.roles;
  if (experience.paid !== undefined) row.paid = experience.paid;
  if (experience.estimatedGuestCount !== undefined)
    row.estimated_guest_count = experience.estimatedGuestCount;
  if (experience.checkoutSessionId !== undefined)
    row.checkout_session_id = experience.checkoutSessionId;
  if (experience.createdBy !== undefined) row.created_by = experience.createdBy;
  if (experience.experienceType !== undefined)
    row.experience_type = experience.experienceType;
  return row;
}

export async function getExperiences() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE_NAME).select("*");

  if (error) {
    console.error("[experiencesStore] getExperiences failed:", error);
    return [];
  }
  return data.map(rowToExperience);
}

// Looks up an experience already created for a given Stripe Checkout
// Session ID, so the paid-experience creation step (see
// /experiences/new/success) can be idempotent: if this session already
// produced an experience, don't create a second one.
export async function getExperienceByCheckoutSessionId(checkoutSessionId) {
  if (!checkoutSessionId) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (error) {
    console.error(
      "[experiencesStore] getExperienceByCheckoutSessionId failed:",
      error
    );
    return null;
  }
  return data ? rowToExperience(data) : null;
}

export async function addExperience(experience) {
  const supabase = getSupabaseClient();
  const createdBy = getOrPromptCreatorName();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ ...experienceToRow(experience), created_by: createdBy })
    .select()
    .single();

  if (error) {
    console.error("[experiencesStore] addExperience failed:", error);
    throw error;
  }
  recordCreatedExperience(data.id);
  return rowToExperience(data);
}

export async function updateExperience(id, fields) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(experienceToRow(fields))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Supabase/PostgREST errors are class instances whose fields don't
    // enumerate, so logging the raw object shows "{}" — spell them out.
    console.error("[experiencesStore] updateExperience failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      fields: Object.keys(fields),
    });
    return null;
  }
  return rowToExperience(data);
}

// Deletes only the experience record itself. To also remove everything
// else keyed to this experience (itinerary, guests, photos, etc.), use
// deleteExperienceCompletely in @/data/deleteExperienceCascade instead —
// this function alone would leave orphaned data behind.
export async function deleteExperience(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    console.error("[experiencesStore] deleteExperience failed:", error);
  }
}
