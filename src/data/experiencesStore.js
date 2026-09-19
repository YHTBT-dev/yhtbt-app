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
export function normalizeExperience(experience) {
  if (Array.isArray(experience.roles)) return experience;

  const { role, ...rest } = experience;
  return { ...rest, roles: role ? [role] : [] };
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
