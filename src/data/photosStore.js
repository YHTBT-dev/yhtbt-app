import { deleteExperiencePhoto } from "@/lib/supabase";

const STORAGE_KEY = "yhtbt:photos";

// The photo *record* (tags, itinerary link, timestamp) lives here in
// localStorage, same as before — only the actual image file has moved.
// dataUrl now holds a real Supabase Storage public URL, uploaded by the
// caller (see handlePhotoFileChange in /experiences/[id]/page.tsx)
// *before* addPhoto() is called; this store never uploads or reads image
// bytes itself. The name "dataUrl" is unchanged from before the
// migration — same field, now pointing at a hosted URL instead of a
// base64 string, rather than a rename that would've meant updating every
// existing photo record too.
//
// Photo shape: { id, experienceId, dataUrl, taggedNames, itineraryItemId,
// timestamp }. taggedNames is an array of guest names tagged in the photo
// (may be empty). itineraryItemId optionally links the photo to a specific
// itinerary item (null if not linked — not every photo needs one).
// timestamp is set automatically when the photo is uploaded.

function readFromStorage() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeToStorage(photos) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
}

function getAllPhotos() {
  return readFromStorage();
}

// Rough estimate of total localStorage usage for this origin (all keys,
// not just photos), so it's easy to tell if a failed save is a quota
// problem. localStorage strings are UTF-16, so this approximates bytes
// as 2 per character rather than just using string length.
function logLocalStorageUsage() {
  if (typeof window === "undefined") return;

  let totalChars = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    totalChars += key.length + (window.localStorage.getItem(key) ?? "").length;
  }

  const approxBytes = totalChars * 2;
  const approxMb = (approxBytes / (1024 * 1024)).toFixed(2);
  console.warn(
    `[photosStore] Approximate localStorage usage for this origin: ~${approxMb}MB (${totalChars} chars across all keys). Most browsers cap localStorage at ~5-10MB per origin — if this is near that, the quota is likely why the save failed. Storing photos as base64 uses a lot of space; deleting some photos should free up room.`
  );
}

// Photos saved before taggedNames existed (or from the brief uploaderName
// version of this feature) may not have it — always return an array.
function normalizePhoto(photo) {
  return {
    ...photo,
    taggedNames: photo.taggedNames ?? [],
    itineraryItemId: photo.itineraryItemId ?? null,
  };
}

export function getPhotos(experienceId) {
  return getAllPhotos()
    .filter((photo) => photo.experienceId === experienceId)
    .map(normalizePhoto)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function addPhoto(photo) {
  const photos = getAllPhotos();
  const nextId =
    photos.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newPhoto = {
    id: nextId,
    timestamp: new Date().toISOString(),
    taggedNames: [],
    ...photo,
  };
  const updatedPhotos = [...photos, newPhoto];

  writeToStorage(updatedPhotos);
  return newPhoto;
}

// Replaces a photo's full tag list (not a merge) — removing a tag from
// the caller's array actually removes it, rather than only appending.
export function setPhotoTags(photoId, names) {
  const photos = getAllPhotos();
  let updatedPhoto = null;

  const updatedPhotos = photos.map((photo) => {
    if (photo.id !== photoId) return photo;
    updatedPhoto = { ...photo, taggedNames: names };
    return updatedPhoto;
  });

  try {
    writeToStorage(updatedPhotos);
  } catch (error) {
    console.error(
      "[photosStore] Failed to save photo tags — localStorage write threw an error instead of saving silently failing. This is most likely a storage quota issue, since photos are stored as base64 data URLs, which use a lot of space.",
      error
    );
    logLocalStorageUsage();
    return null;
  }

  return updatedPhoto;
}

// Sets (or clears, passing null) which itinerary item a photo is linked
// to. Replaces rather than merges, since a photo can only link to one
// moment at a time.
export function setPhotoItineraryItem(photoId, itineraryItemId) {
  const photos = getAllPhotos();
  let updatedPhoto = null;

  const updatedPhotos = photos.map((photo) => {
    if (photo.id !== photoId) return photo;
    updatedPhoto = { ...photo, itineraryItemId: itineraryItemId ?? null };
    return updatedPhoto;
  });

  try {
    writeToStorage(updatedPhotos);
  } catch (error) {
    console.error(
      "[photosStore] Failed to save photo's itinerary link — localStorage write threw an error instead of failing silently. This is most likely a storage quota issue, since photos are stored as base64 data URLs, which use a lot of space.",
      error
    );
    logLocalStorageUsage();
    return null;
  }

  return updatedPhoto;
}

// Async now — also deletes the actual image file from Supabase Storage,
// not just the local record, so deleted photos don't pile up as orphaned
// files nobody can see anymore. The local record is still removed even
// if the Storage delete fails (e.g. offline), so a stuck record can't
// block the rest of the UI; the failure is only logged (see
// deleteExperiencePhoto in @/lib/supabase).
export async function deletePhoto(photoId) {
  const photos = getAllPhotos();
  const photo = photos.find((item) => item.id === photoId);
  if (photo?.dataUrl) {
    await deleteExperiencePhoto(photo.dataUrl);
  }

  const updatedPhotos = photos.filter((item) => item.id !== photoId);
  writeToStorage(updatedPhotos);
}

// Removes every photo for an experience — used when the experience itself
// is deleted, so nothing is left orphaned, including each photo's file in
// Supabase Storage.
export async function deleteAllForExperience(experienceId) {
  const photos = getAllPhotos();
  const photosToDelete = photos.filter(
    (photo) => photo.experienceId === experienceId
  );

  await Promise.all(
    photosToDelete
      .filter((photo) => photo.dataUrl)
      .map((photo) => deleteExperiencePhoto(photo.dataUrl))
  );

  const updatedPhotos = photos.filter(
    (photo) => photo.experienceId !== experienceId
  );
  writeToStorage(updatedPhotos);
}
