import { getSupabaseClient } from "@/lib/supabase";

const TABLE_NAME = "guests";

// Migrated off localStorage onto Supabase — see the "guests" table (a
// real experience_id foreign key referencing experiences.id, on delete
// cascade, plus a check constraint requiring at least one of email/phone)
// and its RLS policies. Every function here is now async.
//
// experienceId stays a plain string everywhere else in the app (route
// params, comparisons like String(id) === experienceId) — the table's
// experience_id column is a real bigint, so rowToGuest/guestToRow convert
// between the two, same pattern as experiencesStore.js.
//
// email and phone are both optional individually — the database itself
// now enforces that at least one is present (not just the add-guest
// form's client-side check), which is why the guest self-RSVP flow
// (submitRsvp below) also collects one of them now: a self-RSVP that
// only had a name would fail to insert otherwise.

// One-time cleanup: this store no longer reads/writes localStorage at
// all, so the old "yhtbt:guests" key is dead data now rather than left
// lingering indefinitely. Existing local test guests are deliberately
// NOT migrated into Supabase — starting fresh there, same call already
// made for Photos — so this just clears the stale key; removeItem on an
// already-removed key is a no-op, safe to run on every load.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("yhtbt:guests");
}

function rowToGuest(row) {
  return {
    id: row.id,
    experienceId: String(row.experience_id),
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    rsvpStatus: row.rsvp_status,
    everConfirmed: !!row.ever_confirmed,
  };
}

function guestToRow(guest) {
  const row = {};
  if (guest.experienceId !== undefined)
    row.experience_id = Number(guest.experienceId);
  if (guest.name !== undefined) row.name = guest.name;
  if (guest.email !== undefined) row.email = guest.email;
  if (guest.phone !== undefined) row.phone = guest.phone;
  if (guest.rsvpStatus !== undefined) row.rsvp_status = guest.rsvpStatus;
  return row;
}

export async function getGuests(experienceId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[guestsStore] getGuests failed:", error);
    return [];
  }
  return data.map(rowToGuest);
}

export async function addGuest(guest) {
  const supabase = getSupabaseClient();
  // everConfirmed is a permanent record — set immediately if this guest
  // is being added as already "confirmed" (e.g. a first-time self-RSVP
  // that confirms right away), same as the old localStorage logic did.
  const everConfirmed = !!guest.everConfirmed || guest.rsvpStatus === "confirmed";

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({ ...guestToRow(guest), ever_confirmed: everConfirmed })
    .select()
    .single();

  if (error) {
    console.error("[guestsStore] addGuest failed:", error);
    throw error;
  }
  return rowToGuest(data);
}

export async function updateGuestStatus(id, rsvpStatus) {
  const supabase = getSupabaseClient();

  // everConfirmed only ever turns on, never off — reading the row's
  // current value first (rather than deriving purely from the new
  // status) is what makes "stays true even after moving away from
  // confirmed" work: a later status change can't un-record an earlier
  // confirmation.
  const { data: current, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select("ever_confirmed")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !current) {
    console.error("[guestsStore] updateGuestStatus lookup failed:", fetchError);
    return null;
  }

  const everConfirmed = current.ever_confirmed || rsvpStatus === "confirmed";

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ rsvp_status: rsvpStatus, ever_confirmed: everConfirmed })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[guestsStore] updateGuestStatus failed:", error);
    return null;
  }
  return rowToGuest(data);
}

// Edits a guest's own details (name, email, phone) — RSVP status has its
// own function above so everConfirmed keeps being tracked. The table
// requires at least one of email/phone, so callers should check that
// first; a violation comes back as null like any other failed update.
export async function updateGuest(id, fields) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(guestToRow({
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
    }))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[guestsStore] updateGuest failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }
  return rowToGuest(data);
}

export async function deleteGuest(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    console.error("[guestsStore] deleteGuest failed:", error);
  }
}

// Used by the guest-facing RSVP page, which only has a typed name (and,
// now that the table requires it, an email or phone) to go on — not a
// guest id the way host actions do. Matches case-insensitively and trims
// whitespace so "jamie rivera" and "Jamie Rivera " land on the same
// guest; updates that guest's rsvpStatus if a match exists for this
// experience, otherwise creates a new guest record with it. A repeat
// RSVP only updates status, not contact info — the existing row already
// satisfies the email-or-phone requirement from when it was created.
export async function submitRsvp(experienceId, name, rsvpStatus, email, phone) {
  const trimmedName = name.trim();
  const normalizedTarget = trimmedName.toLowerCase();

  const guests = await getGuests(experienceId);
  const existing = guests.find(
    (guest) => guest.name.trim().toLowerCase() === normalizedTarget
  );

  if (existing) {
    return updateGuestStatus(existing.id, rsvpStatus);
  }

  return addGuest({
    experienceId,
    name: trimmedName,
    email: email ?? "",
    phone: phone ?? "",
    rsvpStatus,
  });
}

// Removes every guest for an experience — used when the experience itself
// is deleted, so nothing is left orphaned. The guests table's own
// experience_id foreign key is ON DELETE CASCADE, so this is now a
// belt-and-braces call rather than the only thing preventing orphaned
// rows — deleting the experience row directly would clean these up too.
export async function deleteAllForExperience(experienceId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq("experience_id", Number(experienceId));

  if (error) {
    console.error("[guestsStore] deleteAllForExperience failed:", error);
  }
}
