const STORAGE_KEY = "yhtbt:photos";

// PLACEHOLDER STORAGE: uploaded images are stored as base64 data URLs
// directly in localStorage. This is NOT a real photo storage solution —
// localStorage has strict per-origin size limits (typically ~5-10MB total)
// and this will break down once there are more than a handful of real
// photos. Once real cloud storage exists (e.g. Supabase Storage), uploads
// should go there instead, and this store should hold just a URL/reference
// rather than the raw image data.

// Photo shape: { id, experienceId, dataUrl, taggedNames, timestamp }.
// taggedNames is an array of guest names tagged in the photo (may be
// empty). timestamp is set automatically when the photo is uploaded.

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
  return { ...photo, taggedNames: photo.taggedNames ?? [] };
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

export function deletePhoto(photoId) {
  const photos = getAllPhotos();
  const updatedPhotos = photos.filter((photo) => photo.id !== photoId);
  writeToStorage(updatedPhotos);
}
