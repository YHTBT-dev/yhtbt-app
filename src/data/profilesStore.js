import { getSupabaseClient } from "@/lib/supabase";
import { normalizePhoneNumber } from "@/lib/phone";

const TABLE_NAME = "profiles";

// One profile per browser — see the "profiles" table and its RLS policies
// in supabase/migrations. Every request sends this browser's id (from
// @/lib/browserId) as the x-browser-id header, which is what the policies
// match against; the shared Supabase client is left untouched, the header
// is set per request here instead.
//
// Unlike most stores, failures throw rather than returning an empty value:
// the Profile page needs to tell "no profile yet" (null) apart from
// "couldn't load" (e.g. the migration hasn't been run), so it doesn't show
// an empty form that would look like the saved profile was lost.

export const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  photoUrl: "",
  linkedin: "",
  instagram: "",
  xHandle: "",
  /** @type {string[]} */
  dietaryOptions: [],
  dietaryNotes: "",
  homeCity: "",
};

function rowToProfile(row) {
  return {
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    company: row.company ?? "",
    email: row.email ?? "",
    phone: normalizePhoneNumber(row.phone),
    photoUrl: row.photo_url ?? "",
    linkedin: row.linkedin ?? "",
    instagram: row.instagram ?? "",
    xHandle: row.x_handle ?? "",
    dietaryOptions: row.dietary_options ?? [],
    dietaryNotes: row.dietary_notes ?? "",
    homeCity: row.home_city ?? "",
  };
}

function profileToRow(profile) {
  return {
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    company: profile.company.trim(),
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    photo_url: profile.photoUrl,
    linkedin: profile.linkedin.trim(),
    instagram: profile.instagram.trim(),
    x_handle: profile.xHandle.trim(),
    dietary_options: profile.dietaryOptions,
    dietary_notes: profile.dietaryNotes.trim(),
    home_city: profile.homeCity.trim(),
  };
}

// Resolves with this browser's profile, or null if it hasn't saved one.
export async function getProfile(browserId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("browser_id", browserId)
    .setHeader("x-browser-id", browserId)
    .maybeSingle();

  if (error) {
    console.error("[profilesStore] getProfile failed:", error);
    throw new Error(error.message);
  }
  return data ? rowToProfile(data) : null;
}

// Creates this browser's profile on first save, updates it after that.
export async function saveProfile(browserId, profile) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      { ...profileToRow(profile), browser_id: browserId },
      { onConflict: "browser_id" }
    )
    .setHeader("x-browser-id", browserId)
    .select()
    .single();

  if (error) {
    console.error("[profilesStore] saveProfile failed:", error);
    throw new Error(error.message);
  }
  return rowToProfile(data);
}
