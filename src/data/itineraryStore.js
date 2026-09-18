const STORAGE_KEY = "yhtbt:itinerary";

// Item shape: { id, experienceId, date, startTime, endTime, title,
// description, location, dressCode? }. dressCode is optional.

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

function writeToStorage(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getAllItineraryItems() {
  return readFromStorage();
}

function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getItineraryItems(experienceId) {
  return getAllItineraryItems()
    .filter((item) => item.experienceId === experienceId)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
}

export function addItineraryItem(item) {
  const items = getAllItineraryItems();
  const nextId = items.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newItem = { id: nextId, ...item };
  const updatedItems = [...items, newItem];

  writeToStorage(updatedItems);
  return newItem;
}
