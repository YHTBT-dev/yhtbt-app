"use client";

import { useMemo, useState } from "react";
import mockActivity from "@/data/mockActivity";

const TYPE_LABELS: Record<string, string> = {
  photo: "Photo",
  update: "Update",
  rsvp: "RSVP",
  itinerary_change: "Itinerary Change",
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

export default function ActivityPage() {
  const [search, setSearch] = useState("");

  const sortedActivity = useMemo(
    () =>
      [...mockActivity].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    []
  );

  const filteredActivity = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedActivity;
    return sortedActivity.filter((item) =>
      item.message.toLowerCase().includes(query)
    );
  }, [sortedActivity, search]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        Activity
      </h1>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search activity..."
        className="mt-8 w-full border-b border-foreground/10 bg-transparent pb-3 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none"
      />

      {filteredActivity.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-foreground/50 italic">
          No results found.
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          {filteredActivity.map((item) => (
            <div
              key={item.id}
              className="border-b border-foreground/10 pb-8 last:border-b-0"
            >
              <span className="text-sm tracking-wide text-accent uppercase">
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <p className="mt-2 font-serif text-lg text-foreground">
                {item.message}
              </p>
              <p className="mt-1 text-sm text-foreground/60">
                {formatTimestamp(item.timestamp)}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
