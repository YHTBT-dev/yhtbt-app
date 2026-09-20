const STORAGE_KEY = "yhtbt:guests";

// Guest shape: { id, experienceId, name, email, rsvpStatus, everConfirmed }.
// rsvpStatus is one of "invited", "confirmed", "declined". everConfirmed is
// a permanent record: once true, it stays true even if rsvpStatus later
// changes away from "confirmed" — it powers the Attendee Directory.

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

// Guests already "confirmed" but recorded before everConfirmed existed
// still count as ever confirmed.
function normalizeGuest(guest) {
  return {
    ...guest,
    everConfirmed: !!guest.everConfirmed || guest.rsvpStatus === "confirmed",
  };
}

export function getGuests(experienceId) {
  return getAllGuests()
    .filter((guest) => guest.experienceId === experienceId)
    .map(normalizeGuest);
}

export function addGuest(guest) {
  const guests = getAllGuests();
  const nextId = guests.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newGuest = normalizeGuest({ id: nextId, ...guest });
  const updatedGuests = [...guests, newGuest];

  writeToStorage(updatedGuests);
  return newGuest;
}

export function updateGuestStatus(id, rsvpStatus) {
  const guests = getAllGuests();
  let updatedGuest = null;

  const updatedGuests = guests.map((guest) => {
    if (guest.id !== id) return guest;
    updatedGuest = normalizeGuest({ ...guest, rsvpStatus });
    return updatedGuest;
  });

  writeToStorage(updatedGuests);
  return updatedGuest;
}

// Removes every guest for an experience — used when the experience itself
// is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const guests = getAllGuests();
  const updatedGuests = guests.filter(
    (guest) => guest.experienceId !== experienceId
  );
  writeToStorage(updatedGuests);
}
