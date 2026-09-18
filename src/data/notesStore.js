const STORAGE_KEY = "yhtbt:notes";

function readFromStorage() {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeToStorage(notes) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// `note` is HTML produced by the rich text editor, stored as-is.
export function getNote(experienceId) {
  const notes = readFromStorage();
  return notes[experienceId] ?? "";
}

export function saveNote(experienceId, note) {
  const notes = readFromStorage();
  notes[experienceId] = note;
  writeToStorage(notes);
}
