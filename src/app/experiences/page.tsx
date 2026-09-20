"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import mockExperiences from "@/data/mockExperiences";
import { getExperiences, normalizeExperience } from "@/data/experiencesStore";

type Role = "hosted" | "attended";

const DELETED_TOAST_VISIBLE_DURATION_MS = 3000;
const DELETED_TOAST_FADE_DURATION_MS = 500;

const TABS: { label: string; value: Role }[] = [
  { label: "Hosted", value: "hosted" },
  { label: "Attended", value: "attended" },
];

// Parses a plain "YYYY-MM-DD" string as a local calendar date instead of
// letting `new Date(string)` treat it as UTC, which can shift the date by
// one day depending on the viewer's timezone offset.
function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  if (startDate === endDate) {
    return start.toLocaleDateString("en-US", opts);
  }

  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    opts
  )}`;
}

export default function ExperiencesPage() {
  const [activeTab, setActiveTab] = useState<Role>("hosted");
  const [experiences, setExperiences] = useState(() =>
    mockExperiences.map(normalizeExperience)
  );
  // Shown only right after landing here from deleting an Experience (via
  // the sessionStorage "justDeleted" flag set right before the redirect),
  // not on normal visits. "Mounted" keeps it in the DOM through the
  // fade-out transition; "Visible" drives the opacity so the fade is
  // animated rather than an abrupt disappearance.
  const [isDeletedToastMounted, setIsDeletedToastMounted] = useState(false);
  const [isDeletedToastVisible, setIsDeletedToastVisible] = useState(false);
  // Read once, synchronously, during render — a lazy initializer never
  // re-runs and never mutates anything, so it's safe under React Strict
  // Mode's double-render check in dev (see the creation banner on the
  // Experience detail page for why reading this from inside an effect
  // instead would leave the toast stuck on screen).
  const [deletedExperienceName] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("justDeleted") : null
  );

  useEffect(() => {
    setExperiences(getExperiences());
  }, []);

  useEffect(() => {
    if (!deletedExperienceName) return;

    // Clear the flag so refreshing or revisiting this page doesn't
    // re-trigger the toast. Safe to call more than once (e.g. if this
    // effect's Strict Mode dev double-invoke re-runs it) — removing an
    // already-removed key is a no-op.
    sessionStorage.removeItem("justDeleted");

    setIsDeletedToastMounted(true);
    setIsDeletedToastVisible(true);

    const hideTimer = setTimeout(() => {
      setIsDeletedToastVisible(false);
    }, DELETED_TOAST_VISIBLE_DURATION_MS);
    const unmountTimer = setTimeout(() => {
      setIsDeletedToastMounted(false);
    }, DELETED_TOAST_VISIBLE_DURATION_MS + DELETED_TOAST_FADE_DURATION_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, [deletedExperienceName]);

  const filteredExperiences = useMemo(
    () =>
      experiences
        .filter((experience) => experience.roles.includes(activeTab))
        .sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        ),
    [experiences, activeTab]
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      {isDeletedToastMounted ? (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
          <div
            className={`border border-accent bg-background px-6 py-3 shadow-sm transition-opacity duration-500 ${
              isDeletedToastVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="font-serif text-base text-foreground">
              {deletedExperienceName} was deleted
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
          Your Experiences
        </h1>

        <Link
          href="/experiences/new"
          className="shrink-0 border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Create Experience
        </Link>
      </div>

      {/* Dev-only: remove before shipping */}
      <button
        type="button"
        onClick={() => {
          window.localStorage.clear();
          window.location.reload();
        }}
        className="mt-4 text-xs text-foreground/40 underline underline-offset-2 hover:text-red-600"
      >
        Clear all data (dev)
      </button>

      <div className="mt-8 flex gap-8 border-b border-foreground/10">
        {TABS.map((tab) => {
          const isActive = tab.value === activeTab;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`-mb-px border-b-2 pb-3 text-sm tracking-wide uppercase transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-foreground/50 hover:text-accent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filteredExperiences.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
          No experiences yet
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExperiences.map((experience) => (
            <Link
              key={experience.id}
              href={`/experiences/${experience.id}`}
              className="group block"
            >
              <div className="aspect-video w-full overflow-hidden bg-foreground/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={experience.coverImage}
                  alt={experience.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="pt-4">
                <p className="font-serif text-lg text-foreground transition-colors group-hover:text-accent">
                  {experience.name}
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {formatDateRange(experience.startDate, experience.endDate)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
