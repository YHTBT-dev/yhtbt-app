"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MentionText from "@/components/MentionText";
import { getActivity } from "@/data/activityStore";
import { getExperiences } from "@/data/experiencesStore";
import { parseMessage } from "@/lib/mentions";

type ActivityEntry = { key: string; experienceId: string; timestamp: string } & (
  | { type: "update"; message: string }
  | { type: "rsvp"; guestName: string; status: string }
  | { type: "photo"; url: string }
);

type ExperienceOption = { id: number; name: string; startDate: string };

// Which Experience the loaded feed is for ("" = all), so a result that
// arrives after the filter changed again is never shown under the wrong
// filter, and "loading" is just "the result isn't for this filter yet".
type FeedResult =
  | { forExperienceId: string; status: "loaded"; entries: ActivityEntry[] }
  | { forExperienceId: string; status: "error" };

const TYPE_LABELS: Record<ActivityEntry["type"], string> = {
  update: "Update",
  rsvp: "RSVP",
  photo: "Photo",
};

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rsvpSentence(guestName: string, status: string) {
  const name = guestName || "A guest";
  if (status === "confirmed") return `${name} is going.`;
  if (status === "declined") return `${name} can’t make it.`;
  return `${name} updated their RSVP.`;
}

// Plain text of an entry, for the search box.
function searchableText(entry: ActivityEntry, experienceName: string) {
  const body =
    entry.type === "update"
      ? parseMessage(entry.message)
          .map((segment) => (segment.type === "mention" ? segment.name : segment.text))
          .join("")
      : entry.type === "rsvp"
        ? rsvpSentence(entry.guestName, entry.status)
        : "New photo added";
  return `${experienceName} ${body}`.toLowerCase();
}

export default function ActivityPage() {
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState("");
  const [feed, setFeed] = useState<FeedResult | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((fetched: ExperienceOption[]) => {
      if (cancelled) return;
      setExperiences(
        [...fetched].sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getActivity(selectedExperienceId || undefined)
      .then((entries) => {
        if (!cancelled) {
          setFeed({
            forExperienceId: selectedExperienceId,
            status: "loaded",
            // activityStore is plain JS, so `type` is inferred as string.
            entries: entries as ActivityEntry[],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeed({ forExperienceId: selectedExperienceId, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedExperienceId]);

  const experienceNames = useMemo(
    () => new Map(experiences.map((experience) => [String(experience.id), experience.name])),
    [experiences]
  );

  const currentFeed =
    feed && feed.forExperienceId === selectedExperienceId ? feed : null;

  const visibleEntries = useMemo(() => {
    if (currentFeed?.status !== "loaded") return [];
    const query = search.trim().toLowerCase();
    if (!query) return currentFeed.entries;
    return currentFeed.entries.filter((entry) =>
      searchableText(entry, experienceNames.get(entry.experienceId) ?? "").includes(query)
    );
  }, [currentFeed, search, experienceNames]);

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        Activity
      </h1>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
          <span className="text-sm tracking-wide text-muted uppercase">
            Experience
          </span>
          <select
            value={selectedExperienceId}
            onChange={(event) => setSelectedExperienceId(event.target.value)}
            className="w-full border-b border-foreground/10 bg-transparent pb-3 font-serif text-lg text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">All Experiences</option>
            {experiences.map((experience) => (
              <option key={experience.id} value={String(experience.id)}>
                {experience.name}
              </option>
            ))}
          </select>
        </label>

        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search activity..."
          aria-label="Search activity"
          className="w-full border-b border-foreground/10 bg-transparent pb-3 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
        />
      </div>

      {!currentFeed ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Loading…
        </div>
      ) : currentFeed.status === "error" ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Couldn&rsquo;t load activity. Please refresh to try again.
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          {search.trim() ? "No results found." : "No activity yet."}
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          {visibleEntries.map((entry) => (
            <div
              key={entry.key}
              className="border-b border-foreground/10 pb-8 last:border-b-0"
            >
              <p className="text-sm tracking-wide uppercase">
                <Link
                  href={`/experiences/${entry.experienceId}`}
                  className="text-accent hover:underline"
                >
                  {experienceNames.get(entry.experienceId) ?? "Experience"}
                </Link>
                <span className="text-muted"> · {TYPE_LABELS[entry.type]}</span>
              </p>

              {entry.type === "update" ? (
                <p className="mt-2 font-serif text-lg whitespace-pre-line text-foreground">
                  <MentionText segments={parseMessage(entry.message)} />
                </p>
              ) : entry.type === "rsvp" ? (
                <p className="mt-2 font-serif text-lg text-foreground">
                  {rsvpSentence(entry.guestName, entry.status)}
                </p>
              ) : (
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden bg-foreground/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="font-serif text-lg text-foreground">New photo added</p>
                </div>
              )}

              <p className="mt-1 text-sm text-foreground/60">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
