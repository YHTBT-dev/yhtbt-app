"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { getTodayLocalDateString } from "@/lib/format";

type Role = "hosted" | "attended";
type View = "grid" | "list";

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
  roles: string[];
};

const DELETED_TOAST_VISIBLE_DURATION_MS = 3000;
const DELETED_TOAST_FADE_DURATION_MS = 500;
const EXPERIENCES_VIEW_STORAGE_KEY = "yhtbt:experiencesView";

const TABS: { label: string; value: Role }[] = [
  { label: "Hosted", value: "hosted" },
  { label: "Attended", value: "attended" },
];

function GridIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
    >
      <rect x="2.5" y="2.5" width="6" height="6" />
      <rect x="11.5" y="2.5" width="6" height="6" />
      <rect x="2.5" y="11.5" width="6" height="6" />
      <rect x="11.5" y="11.5" width="6" height="6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}

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
  const [experiences, setExperiences] = useState<Experience[]>([]);
  // Distinguishes "still fetching from Supabase" from "genuinely no
  // Experiences exist" — without this, the empty state would flash
  // briefly on every visit before real data arrives.
  const [isLoadingExperiences, setIsLoadingExperiences] = useState(true);
  // Always starts as "grid" — a lazy initializer reading localStorage
  // here (like deletedExperienceName below) would return different values
  // on the server (no window, always "grid") vs. the client's hydration
  // pass (window exists, so it could read "list" from a prior visit),
  // and aria-pressed on the toggle buttons directly reflects this value
  // in the very first render — a mismatch there is a real hydration
  // error, not just a cosmetic one. The saved preference is applied after
  // mount instead (see the effect below), at the cost of a brief
  // grid-then-list flash on repeat visits that had chosen list.
  const [view, setView] = useState<View>("grid");
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
    let cancelled = false;

    getExperiences().then((fetched) => {
      if (cancelled) return;
      setExperiences(fetched);
      setIsLoadingExperiences(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Applies the saved view preference once mounted on the client, where
  // localStorage is actually available — see the note on view's
  // useState above for why this can't happen during the initial render.
  useEffect(() => {
    const stored = window.localStorage.getItem(EXPERIENCES_VIEW_STORAGE_KEY);
    if (stored === "list") setView("list");
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

  // Whichever Experience on the CURRENT tab has the nearest startDate
  // that's today or later — recomputed per tab (via filteredExperiences)
  // so Hosted and Attended each get their own independent "Up Next" pick,
  // and null (no badge shown anywhere) when nothing on this tab is
  // upcoming.
  const upNextExperienceId = useMemo(() => {
    const today = getTodayLocalDateString();
    const upcoming = filteredExperiences.filter(
      (experience) => experience.startDate >= today
    );
    if (upcoming.length === 0) return null;

    return upcoming.reduce((nearest, experience) =>
      experience.startDate < nearest.startDate ? experience : nearest
    ).id;
  }, [filteredExperiences]);

  function handleSetView(nextView: View) {
    setView(nextView);
    window.localStorage.setItem(EXPERIENCES_VIEW_STORAGE_KEY, nextView);
  }

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

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex border border-foreground/10">
            <button
              type="button"
              onClick={() => handleSetView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={`p-2 transition-colors ${
                view === "grid"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-accent"
              }`}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              onClick={() => handleSetView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={`border-l border-foreground/10 p-2 transition-colors ${
                view === "list"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-accent"
              }`}
            >
              <ListIcon />
            </button>
          </div>

          <Link
            href="/experiences/new"
            className="border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Create Experience
          </Link>
        </div>
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
              className={`-mb-px border-b-2 px-3 pb-3 text-sm tracking-wide uppercase transition-colors ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-transparent text-muted hover:text-accent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoadingExperiences ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Loading…
        </div>
      ) : filteredExperiences.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          No experiences yet
        </div>
      ) : view === "grid" ? (
        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExperiences.map((experience) => (
            <Link
              key={experience.id}
              href={`/experiences/${experience.id}`}
              className="group block"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-foreground/5">
                {experience.id === upNextExperienceId ? (
                  <span className="absolute top-2 left-2 z-10 border border-accent/30 bg-background/90 px-2 py-0.5 text-xs tracking-widest text-accent uppercase">
                    Up Next
                  </span>
                ) : null}
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
      ) : (
        <div className="mt-10 flex flex-col divide-y divide-foreground/10 border-t border-b border-foreground/10">
          {filteredExperiences.map((experience) => (
            <Link
              key={experience.id}
              href={`/experiences/${experience.id}`}
              className="group flex items-center gap-4 py-3 transition-colors hover:bg-foreground/5"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden bg-foreground/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={experience.coverImage}
                  alt={experience.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-serif text-base text-foreground transition-colors group-hover:text-accent">
                    {experience.name}
                  </p>
                  {experience.id === upNextExperienceId ? (
                    <span className="shrink-0 border border-accent/30 bg-background px-1.5 py-0.5 text-[10px] tracking-widest text-accent uppercase">
                      Up Next
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-foreground/60">
                  {formatDateRange(experience.startDate, experience.endDate)}
                  {experience.location ? ` · ${experience.location}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
