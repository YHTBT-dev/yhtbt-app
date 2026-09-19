const STORAGE_KEY = "yhtbt:travelDetails";

// Entry shape depends on "type":
// - flight: { id, experienceId, type: "flight", guestName?, airline,
//   flightNumber, departureAirport, arrivalAirport, departureTime,
//   arrivalTime }
// - hotel: { id, experienceId, type: "hotel", hotelName, address,
//   checkInDate, checkOutDate, confirmationNumber? }
// - transport: { id, experienceId, type: "transport", description,
//   pickupLocation, pickupTime, notes? }

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

function writeToStorage(entries) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getAllTravelDetails() {
  return readFromStorage();
}

export function getTravelDetails(experienceId) {
  return getAllTravelDetails().filter(
    (entry) => entry.experienceId === experienceId
  );
}

export function addTravelDetail(entry) {
  const entries = getAllTravelDetails();
  const nextId =
    entries.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newEntry = { id: nextId, ...entry };
  const updatedEntries = [...entries, newEntry];

  writeToStorage(updatedEntries);
  return newEntry;
}
