const STORAGE_KEY = "yhtbt:guests";

// Guest shape: { id, experienceId, name, email, rsvpStatus }.
// rsvpStatus is one of "invited", "confirmed", "declined".

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

function writeToStorage(guests) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
}

function getAllGuests() {
  return readFromStorage();
}

export function getGuests(experienceId) {
  return getAllGuests().filter((guest) => guest.experienceId === experienceId);
}

export function addGuest(guest) {
  const guests = getAllGuests();
  const nextId = guests.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newGuest = { id: nextId, ...guest };
  const updatedGuests = [...guests, newGuest];

  writeToStorage(updatedGuests);
  return newGuest;
}

export function updateGuestStatus(id, rsvpStatus) {
  const guests = getAllGuests();
  let updatedGuest = null;

  const updatedGuests = guests.map((guest) => {
    if (guest.id !== id) return guest;
    updatedGuest = { ...guest, rsvpStatus };
    return updatedGuest;
  });

  writeToStorage(updatedGuests);
  return updatedGuest;
}
