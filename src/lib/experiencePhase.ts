import { getTodayLocalDateString } from "@/lib/format";

export type ExperiencePhase = "before" | "during" | "after";

// Recomputed fresh every time it's called (never persisted) — the phase
// is purely a function of today's date vs. the Experience's own
// startDate/endDate, both "YYYY-MM-DD" strings compared directly (same
// string-comparison convention used everywhere else in this app, e.g.
// the itinerary date buffers and the "Up Next" badge on /experiences).
export function computeExperiencePhase(
  startDate: string,
  endDate: string
): ExperiencePhase {
  const today = getTodayLocalDateString();
  if (today < startDate) return "before";
  if (today > endDate) return "after";
  return "during";
}
