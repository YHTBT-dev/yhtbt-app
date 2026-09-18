"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import mockExperiences from "@/data/mockExperiences";
import { getExperiences } from "@/data/experiencesStore";

type Role = "hosted" | "attended";

const TABS: { label: string; value: Role }[] = [
  { label: "Hosted", value: "hosted" },
  { label: "Attended", value: "attended" },
];

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
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
  const [experiences, setExperiences] = useState(mockExperiences);

  useEffect(() => {
    setExperiences(getExperiences());
  }, []);

  const filteredExperiences = useMemo(
    () =>
      experiences
        .filter((experience) => experience.role === activeTab)
        .sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        ),
    [experiences, activeTab]
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
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
