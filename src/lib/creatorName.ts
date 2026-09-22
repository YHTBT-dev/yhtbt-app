const CREATOR_NAME_STORAGE_KEY = "yhtbt:creatorName";

// Not real authentication — a lightweight, per-browser "who made this"
// label attached to new Experience records (see addExperience in
// experiencesStore.js), the same pre-accounts pattern used elsewhere in
// this app (e.g. myReflectionIds). Asked once, via a plain browser
// prompt() rather than a styled modal, since this is explicitly meant to
// be a lightweight placeholder, not a real onboarding flow; cached in
// localStorage afterward so it's never asked again on this browser.
// Declining (cancelling the prompt, or leaving it blank) just leaves the
// record unattributed — createdBy stays "" — rather than blocking
// creation on it.
export function getOrPromptCreatorName(): string {
  if (typeof window === "undefined") return "";

  const stored = window.localStorage.getItem(CREATOR_NAME_STORAGE_KEY);
  if (stored) return stored;

  const entered =
    window
      .prompt("What's your name? (shown as who created this Experience)")
      ?.trim() || "";

  if (entered) {
    window.localStorage.setItem(CREATOR_NAME_STORAGE_KEY, entered);
  }
  return entered;
}
