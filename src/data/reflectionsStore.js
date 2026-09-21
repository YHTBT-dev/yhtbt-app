const STORAGE_KEY = "yhtbt:reflections";

// PLACEHOLDER STORAGE: an optional reflection photo is stored as a base64
// data URL directly on the entry — same approach (and the same tradeoffs)
// as elsewhere in this app; see photosStore.js.

// Entry shape: { id, experienceId, promptId, promptText, responseText,
// photo, guestName, taggedGuests, createdAt, hidden }. photo is an
// optional base64 data URL (null if none). taggedGuests is an array of
// guest names (may be empty). hidden is a soft-delete flag for host
// moderation — a hidden entry is excluded from getReflections entirely,
// but the record itself isn't destroyed.
//
// guestName is no longer collected on submission (removed from the form,
// matching how Updates has never asked for one) — new entries are saved
// with guestName: "". Older entries that already have a name keep
// displaying it; nothing strips existing data.
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

function writeToStorage(reflections) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reflections));
}

function getAllReflections() {
  return readFromStorage();
}

// Entries from before taggedGuests/hidden existed may not have them.
function normalizeReflection(reflection) {
  return {
    ...reflection,
    taggedGuests: reflection.taggedGuests ?? [],
    hidden: reflection.hidden ?? false,
  };
}

// Newest first; hidden entries never appear here, for host or guest.
export function getReflections(experienceId) {
  return getAllReflections()
    .map(normalizeReflection)
    .filter(
      (reflection) =>
        reflection.experienceId === experienceId && !reflection.hidden
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addReflection(reflection) {
  const reflections = getAllReflections();
  const nextId =
    reflections.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) +
    1;

  const newReflection = normalizeReflection({
    id: nextId,
    createdAt: new Date().toISOString(),
    ...reflection,
  });
  const updatedReflections = [...reflections, newReflection];

  writeToStorage(updatedReflections);
  return newReflection;
}

// Soft delete for host moderation — sets hidden: true rather than
// removing the record, so this is reversible later even though there's
// no "undo" affordance in the UI yet.
export function hideReflection(id) {
  const reflections = getAllReflections();
  let updatedReflection = null;

  const updatedReflections = reflections.map((reflection) => {
    if (reflection.id !== id) return reflection;
    updatedReflection = normalizeReflection({ ...reflection, hidden: true });
    return updatedReflection;
  });

  writeToStorage(updatedReflections);
  return updatedReflection;
}

// Removes every reflection for an experience — used when the experience
// itself is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const reflections = getAllReflections();
  const updatedReflections = reflections.filter(
    (reflection) => reflection.experienceId !== experienceId
  );
  writeToStorage(updatedReflections);
}
