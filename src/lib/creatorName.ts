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

const CREATED_EXPERIENCE_IDS_STORAGE_KEY = "yhtbt:createdExperienceIds";

function readCreatedExperienceIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREATED_EXPERIENCE_IDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Remembers, in this browser only, which Experiences it created — the
// signal the Experience page uses to start unlocked for its creator.
// Stronger than matching created_by (a display name anyone can type into
// their own browser): only the browser that actually ran the creation has
// the id. Still not real auth — clearing storage forgets it, and it can
// be edited by hand.
export function recordCreatedExperience(experienceId: number | string): void {
  if (typeof window === "undefined") return;
  const id = String(experienceId);
  const ids = readCreatedExperienceIds();
  if (ids.includes(id)) return;
  window.localStorage.setItem(
    CREATED_EXPERIENCE_IDS_STORAGE_KEY,
    JSON.stringify([...ids, id])
  );
}

export function hasCreatedExperience(experienceId: number | string): boolean {
  return readCreatedExperienceIds().includes(String(experienceId));
}

const LEGACY_CLAIM_DONE_STORAGE_KEY = "yhtbt:legacyCreatorClaimDone";

// One-time, per-browser migration for Experiences created before
// recordCreatedExperience existed: the first time this runs in a browser,
// any Experience whose created_by equals the name stored here is recorded
// as created by this browser, so those older Experiences behave like new
// ones (auto-unlock, "Previewing as Guest" badge). It only ever runs once
// per browser, so Experiences created later are never claimed by a name
// match, and a browser with no stored name (a fresh one) claims nothing.
// Same caveat as the name itself: not real auth, and someone who stored
// the same name in their browser before this first ran would claim those
// Experiences too.
export function claimLegacyExperiences(
  experiences: { id: number | string; createdBy?: string }[]
): void {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(LEGACY_CLAIM_DONE_STORAGE_KEY)) return;
    window.localStorage.setItem(LEGACY_CLAIM_DONE_STORAGE_KEY, "1");
  } catch {
    return;
  }

  const storedName = window.localStorage.getItem(CREATOR_NAME_STORAGE_KEY);
  if (!storedName) return;

  for (const experience of experiences) {
    if (experience.createdBy && experience.createdBy === storedName) {
      recordCreatedExperience(experience.id);
    }
  }
}
