"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getExperiences } from "@/data/experiencesStore";
import { submitRsvp } from "@/data/guestsStore";
import { formatDateRange } from "@/lib/format";

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
};

type RsvpChoice = "confirmed" | "declined";

const RSVP_OPTIONS: { label: string; value: RsvpChoice }[] = [
  { label: "I'll Be There", value: "confirmed" },
  { label: "Can't Make It", value: "declined" },
];

// Guest-facing self-service RSVP — a simplified, mostly read-only view of
// the Experience with one interactive control. Shared as a link by the
// host from the Guests section (see the "Copy Invite Link" button on
// /experiences/[id]) rather than requiring guests to have host access.
export default function RsvpPage() {
  const params = useParams<{ id: string }>();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<RsvpChoice | null>(null);
  const [error, setError] = useState("");
  const [submittedChoice, setSubmittedChoice] = useState<RsvpChoice | null>(
    null
  );
  const [coverImageError, setCoverImageError] = useState(false);

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);
  }, [params.id]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!choice) {
      setError("Let us know whether you'll be attending.");
      return;
    }

    setError("");
    submitRsvp(params.id, name, choice);
    setSubmittedChoice(choice);
  }

  if (experience === undefined) {
    return null;
  }

  if (experience === null) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Experience not found
        </div>
      </main>
    );
  }

  if (submittedChoice) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
            Thanks, {name.trim()}
          </h1>
          <p className="text-muted">
            {submittedChoice === "confirmed"
              ? `We've marked you down as attending ${experience.name}.`
              : `We've noted that you won't be able to make it to ${experience.name}.`}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:px-8 sm:py-14">
      {experience.coverImage && !coverImageError ? (
        <div className="h-56 w-full overflow-hidden sm:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={experience.coverImage}
            alt=""
            onError={() => setCoverImageError(true)}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="mt-8 text-center">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
          {experience.name}
        </h1>
        <p className="mt-3 text-muted">
          {formatDateRange(experience.startDate, experience.endDate)}
          {experience.location ? ` · ${experience.location}` : ""}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-12 flex flex-col gap-8 border-t border-foreground/10 pt-10"
      >
        <label className="block">
          <span className="text-sm tracking-wide text-muted uppercase">
            Your Name
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jamie Rivera"
            className="mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-muted placeholder:italic focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-sm tracking-wide text-muted uppercase">
            Will you be attending?
          </span>
          <div className="flex gap-4">
            {RSVP_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setChoice(option.value)}
                className={`flex-1 border px-5 py-3 text-sm tracking-wide uppercase transition-colors ${
                  choice === option.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-foreground/10 text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Send RSVP
        </button>
      </form>
    </main>
  );
}
