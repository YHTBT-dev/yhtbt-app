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

export function getExperiences() {
  if (typeof window === "undefined") return mockExperiences;

  const stored = readFromStorage();
  if (stored) return stored;

  writeToStorage(mockExperiences);
  return mockExperiences;
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
