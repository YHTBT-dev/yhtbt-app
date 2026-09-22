const STORAGE_KEY = "yhtbt:itinerary";

// Item shape: { id, experienceId, date, startTime, endTime, title,
// description, location, dressCode?, type }. dressCode is optional. type
// is pure categorization for a per-item icon on the schedule display —
// it never triggers extra structured fields; detailed flight/hotel/
// transport data entry stays exclusively in Travel Details.
export const ITINERARY_ITEM_TYPES = [
  "Flight",
  "Transportation",
  "Hotel",
  "Meal",
  "Event/Excursion",
  "Generic",
];

export const DEFAULT_ITINERARY_ITEM_TYPE = "Generic";

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

// Entries from before "type" existed default to Generic.
function normalizeItineraryItem(item) {
  return {
    ...item,
    type: item.type ?? DEFAULT_ITINERARY_ITEM_TYPE,
  };
}

export function getItineraryItems(experienceId) {
  return getAllItineraryItems()
    .filter((item) => item.experienceId === experienceId)
    .map(normalizeItineraryItem)
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

export function updateItineraryItem(id, fields) {
  const items = getAllItineraryItems();
  let updatedItem = null;

  const updatedItems = items.map((item) => {
    if (item.id !== id) return item;
    updatedItem = { ...item, ...fields };
    return updatedItem;
  });

  writeToStorage(updatedItems);
  return updatedItem;
}

// Removes every itinerary item for an experience — used when the
// experience itself is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const items = getAllItineraryItems();
  const updatedItems = items.filter(
    (item) => item.experienceId !== experienceId
  );
  writeToStorage(updatedItems);
}
