"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { computeExperiencePhase, type ExperiencePhase } from "@/lib/experiencePhase";
import ExperienceTabBar, {
  type ExperienceTabId,
} from "@/components/ExperienceTabBar";

// Isolated test view for the new Experience tab navigation — structure
// and phase logic only, NOT wired to replace the real Experience page
// (/experiences/[id]/page.tsx) yet. Safe to delete once the real page
// adopts this and this has served its purpose.

type Experience = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

const PHASE_OVERRIDE_OPTIONS: { label: string; value: ExperiencePhase | "actual" }[] = [
  { label: "Actual (computed)", value: "actual" },
  { label: "Before", value: "before" },
  { label: "During", value: "during" },
  { label: "After", value: "after" },
];

const TAB_ORDER_FOR_DEFAULT: Record<ExperiencePhase, ExperienceTabId[]> = {
  before: ["itinerary", "guests", "updates", "chat", "details", "photos", "notes", "hostTools"],
  during: ["chat", "updates", "itinerary", "photos", "notes", "guests", "details", "hostTools"],
  after: ["photos", "chat", "hostTools", "notes", "itinerary", "guests", "updates", "details"],
};

const TAB_PLACEHOLDER_TEXT: Record<ExperienceTabId, string> = {
  itinerary: "Placeholder: the day-by-day schedule will live here.",
  guests: "Placeholder: the guest list and RSVP management will live here.",
  updates: "Placeholder: host announcements will live here.",
  chat: "Placeholder: the group conversation will live here.",
  details: "Placeholder: cover image, dates, location, and FAQs will live here.",
  photos: "Placeholder: the shared photo album will live here.",
  notes: "Placeholder: the host's private notes-to-self will live here.",
  hostTools: "Placeholder: host-only controls (delete, theme, preview-as-guest) will live here.",
};

export default function ExperienceTabsPreviewPage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [phaseOverride, setPhaseOverride] = useState<ExperiencePhase | "actual">(
    "actual"
  );
  const [activeTab, setActiveTab] = useState<ExperienceTabId>("itinerary");

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((experiences) => {
      if (cancelled) return;
      const found = experiences.find(
        (item: Experience) => String(item.id) === params.id
      );
      setExperience(found ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (experience === undefined) {
    return null;
  }

  if (experience === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Experience not found
        </div>
      </main>
    );
  }

  // Recomputed on every render (never stored) — see computeExperiencePhase.
  // The override below exists only for this preview, so all three
  // phases' tab orderings can be exercised from a single Experience
  // without needing three separately-dated ones.
  const actualPhase = computeExperiencePhase(
    experience.startDate,
    experience.endDate
  );
  const phase = phaseOverride === "actual" ? actualPhase : phaseOverride;

  function handlePhaseOverrideChange(next: ExperiencePhase | "actual") {
    setPhaseOverride(next);
    const resolvedPhase = next === "actual" ? actualPhase : next;
    setActiveTab(TAB_ORDER_FOR_DEFAULT[resolvedPhase][0]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/experiences/${params.id}`}
        className="block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to {experience.name}
      </Link>

      <h1 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
        Tab Navigation Preview
      </h1>
      <p className="mt-2 text-sm text-muted">
        Isolated test view — not wired into the real Experience page.
        Actual phase for this Experience (today vs. {experience.startDate}
        –{experience.endDate}): <strong>{actualPhase}</strong>.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {PHASE_OVERRIDE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handlePhaseOverrideChange(option.value)}
            aria-pressed={phaseOverride === option.value}
            className={`border px-3 py-1.5 text-xs tracking-wide uppercase transition-colors ${
              phaseOverride === option.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-foreground/10 text-muted hover:border-accent/50 hover:text-accent"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <ExperienceTabBar
          phase={phase}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="mt-8 border border-foreground/10 p-6">
        <h2 className="font-serif text-xl text-foreground capitalize">
          {activeTab.replace(/([A-Z])/g, " $1")}
        </h2>
        <p className="mt-3 text-sm text-muted italic">
          {TAB_PLACEHOLDER_TEXT[activeTab]}
        </p>
      </div>
    </main>
  );
}
