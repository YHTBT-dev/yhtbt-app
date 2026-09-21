import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client, using the project's URL and publishable
// (public) key — both safe to expose in the browser. This is not the
// service-role key and shouldn't be used for anything that needs to
// bypass Row Level Security.
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must both be set in .env.local (see .env.local.example)."
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

// Storage bucket for uploaded Experience photos (Photos section and
// Reflections' attached photos) — see the setup walkthrough for creating
// this bucket in the Supabase dashboard. Photo/Reflection *records*
// (tags, prompt text, etc.) still live in localStorage; this bucket only
// holds the actual image files, with the record storing the resulting
// public URL. Set to public read so <img src> and downloads work without
// signed URLs — fine for now since there's no auth/private-Experience
// concept yet, same as everything else in this app.
const PHOTOS_BUCKET = "experience-photos";

// Uploads an already-compressed image Blob and returns its public URL.
// The path is namespaced by experienceId so a bucket listing stays
// organized per Experience, with a random id so two uploads never collide.
export async function uploadExperiencePhoto(experienceId: string, blob: Blob) {
  const supabase = getSupabaseClient();
  const filePath = `${experienceId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, blob, { contentType: "image/jpeg" });

  if (error) {
    throw new Error(`Failed to upload photo to Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// Deletes a previously-uploaded photo from the bucket, given its public
// URL (as stored on the photo/reflection record). Silently no-ops for a
// URL that isn't actually one of this bucket's public URLs (e.g. an
// older base64 data URL from before this migration) — there's nothing in
// storage to clean up for those.
export async function deleteExperiencePhoto(publicUrl: string) {
  const marker = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex === -1) return;

  const filePath = decodeURIComponent(
    publicUrl.slice(markerIndex + marker.length)
  );
  if (!filePath) return;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove([filePath]);

  if (error) {
    console.error(
      `[supabase] Failed to delete photo from Storage (${filePath}):`,
      error
    );
  }
}
