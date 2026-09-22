const STORAGE_KEY = "yhtbt:faqs";

// Entry shape: { id, experienceId, question, answer }.

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

function writeToStorage(faqs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(faqs));
}

function getAllFaqs() {
  return readFromStorage();
}

export function getFaqs(experienceId) {
  return getAllFaqs().filter((faq) => faq.experienceId === experienceId);
}

export function addFaq(faq) {
  const faqs = getAllFaqs();
  const nextId = faqs.reduce((maxId, existing) => Math.max(maxId, existing.id), 0) + 1;

  const newFaq = { id: nextId, ...faq };
  const updatedFaqs = [...faqs, newFaq];

  writeToStorage(updatedFaqs);
  return newFaq;
}

export function updateFaq(id, fields) {
  const faqs = getAllFaqs();
  let updatedFaq = null;

  const updatedFaqs = faqs.map((faq) => {
    if (faq.id !== id) return faq;
    updatedFaq = { ...faq, ...fields };
    return updatedFaq;
  });

  writeToStorage(updatedFaqs);
  return updatedFaq;
}

// Removes every FAQ for an experience — used when the experience itself
// is deleted, so nothing is left orphaned.
export function deleteAllForExperience(experienceId) {
  const faqs = getAllFaqs();
  const updatedFaqs = faqs.filter((faq) => faq.experienceId !== experienceId);
  writeToStorage(updatedFaqs);
}
