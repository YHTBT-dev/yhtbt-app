import mockExperiences from "@/data/mockExperiences";

const STORAGE_KEY = "yhtbt:experiences";

function readFromStorage() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeToStorage(experiences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(experiences));
}

// Older records may still have a single "role" string instead of a
// "roles" array; treat those as roles: [role] instead of crashing.
// Records from before the platform tier fee existed have no "paid" field —
// default to false rather than treating them as having paid. Records from
// before guest-count tiering existed have no "estimatedGuestCount" —
// default to null (unknown), distinct from the real guest list built
// later in the Guests section. Records from before theming existed have no
// "theme" — default to the app's original look, "editorial-classic".
export function normalizeExperience(experience) {
  const withRoles = Array.isArray(experience.roles)
    ? experience
    : (() => {
        const { role, ...rest } = experience;
        return { ...rest, roles: role ? [role] : [] };
      })();

  return {
    ...withRoles,
    paid: withRoles.paid ?? false,
    estimatedGuestCount: withRoles.estimatedGuestCount ?? null,
    checkoutSessionId: withRoles.checkoutSessionId ?? null,
    theme: withRoles.theme ?? "editorial-classic",
  };
}

export function getExperiences() {
  if (typeof window === "undefined") {
    return mockExperiences.map(normalizeExperience);
  }

  const stored = readFromStorage();
  if (stored) return stored.map(normalizeExperience);

  writeToStorage(mockExperiences);
  return mockExperiences.map(normalizeExperience);
}

// Looks up an experience already created for a given Stripe Checkout
// Session ID, so the paid-experience creation step (see
// /experiences/new/success) can be idempotent: if this session already
// produced an experience, don't create a second one.
export function getExperienceByCheckoutSessionId(checkoutSessionId) {
  if (!checkoutSessionId) return null;
  return (
    getExperiences().find(
      (experience) => experience.checkoutSessionId === checkoutSessionId
    ) ?? null
  );
}

export function addExperience(experience) {
  const experiences = getExperiences();
  const nextId =
    experiences.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;

  const newExperience = { id: nextId, ...experience };
  const updatedExperiences = [...experiences, newExperience];

  writeToStorage(updatedExperiences);
  return newExperience;
}

export function updateExperience(id, fields) {
  const experiences = getExperiences();
  let updatedExperience = null;

  const updatedExperiences = experiences.map((experience) => {
    if (experience.id !== id) return experience;
    updatedExperience = { ...experience, ...fields };
    return updatedExperience;
  });

  writeToStorage(updatedExperiences);
  return updatedExperience;
}

// Deletes only the experience record itself. To also remove everything
// else keyed to this experience (itinerary, guests, photos, etc.), use
// deleteExperienceCompletely in @/data/deleteExperienceCascade instead —
// this function alone would leave orphaned data behind.
export function deleteExperience(id) {
  const experiences = getExperiences();
  const updatedExperiences = experiences.filter(
    (experience) => experience.id !== id
  );
  writeToStorage(updatedExperiences);
}
