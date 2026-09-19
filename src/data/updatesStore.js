const STORAGE_KEY = "yhtbt:updates";

// Entry shape: { id, experienceId, message, timestamp }.
// timestamp is set automatically when the update is created.

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

function writeToStorage(updates) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updates));
}

function getAllUpdates() {
  return readFromStorage();
}

export function getUpdates(experienceId) {
  return getAllUpdates()
    .filter((update) => update.experienceId === experienceId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function addUpdate(update) {
  const updates = getAllUpdates();
  const nextId =
    updates.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newUpdate = {
    id: nextId,
    timestamp: new Date().toISOString(),
    ...update,
  };
  const updatedUpdates = [...updates, newUpdate];

  writeToStorage(updatedUpdates);
  return newUpdate;
}
