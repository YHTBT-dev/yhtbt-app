const STORAGE_KEY = "yhtbt:recommendations";

// Entry shape: { id, experienceId, name, category, description, link }.
// link is optional (empty string when not provided).
export const RECOMMENDATION_CATEGORIES = [
  "Restaurant",
  "Bar",
  "Activity",
  "Shop",
];

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

function writeToStorage(recommendations) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recommendations));
}

function getAllRecommendations() {
  return readFromStorage();
}

export function getRecommendations(experienceId) {
  return getAllRecommendations().filter(
    (recommendation) => recommendation.experienceId === experienceId
  );
}

export function addRecommendation(recommendation) {
  const recommendations = getAllRecommendations();
  const nextId =
    recommendations.reduce(
      (maxId, existing) => Math.max(maxId, existing.id),
      0
    ) + 1;

  const newRecommendation = { id: nextId, ...recommendation };
  const updatedRecommendations = [...recommendations, newRecommendation];

  writeToStorage(updatedRecommendations);
  return newRecommendation;
}

export function updateRecommendation(id, fields) {
  const recommendations = getAllRecommendations();
  let updatedRecommendation = null;

  const updatedRecommendations = recommendations.map((recommendation) => {
    if (recommendation.id !== id) return recommendation;
    updatedRecommendation = { ...recommendation, ...fields };
    return updatedRecommendation;
  });

  writeToStorage(updatedRecommendations);
  return updatedRecommendation;
}

export function deleteRecommendation(id) {
  const recommendations = getAllRecommendations();
  const updatedRecommendations = recommendations.filter(
    (recommendation) => recommendation.id !== id
  );
  writeToStorage(updatedRecommendations);
}

// Removes every recommendation for an experience — used when the
// experience itself is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const recommendations = getAllRecommendations();
  const updatedRecommendations = recommendations.filter(
    (recommendation) => recommendation.experienceId !== experienceId
  );
  writeToStorage(updatedRecommendations);
}
