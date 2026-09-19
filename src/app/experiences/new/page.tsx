"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { addExperience } from "@/data/experiencesStore";

const FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-foreground/40 placeholder:italic focus:border-accent focus:outline-none";

const LABEL_CLASSES = "text-sm tracking-wide text-foreground/50 uppercase";

export default function NewExperiencePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [isHosting, setIsHosting] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [error, setError] = useState("");
  // Tracks whether endDate should keep following startDate. Stays true
  // until the user manually sets endDate to something other than
  // startDate, at which point their multi-day choice is respected.
  const [isEndDateAutoSynced, setIsEndDateAutoSynced] = useState(true);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (isEndDateAutoSynced) setEndDate(value);
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    if (value !== startDate) setIsEndDateAutoSynced(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isHosting && !isAttending) {
      setError("Select at least one: hosting or attending.");
      return;
    }

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    setError("");

    const roles = [
      ...(isHosting ? ["hosted"] : []),
      ...(isAttending ? ["attended"] : []),
    ];

    addExperience({
      name,
      coverImage,
      startDate,
      endDate,
      location,
      roles,
    });

    router.push("/experiences");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        New Experience
      </h1>

      <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-10">
        <label className="block">
          <span className={LABEL_CLASSES}>Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sunset Rooftop Dinner"
            className={FIELD_CLASSES}
          />
        </label>

        <label className="block">
          <span className={LABEL_CLASSES}>Cover Image URL</span>
          <input
            type="url"
            required
            value={coverImage}
            onChange={(event) => setCoverImage(event.target.value)}
            placeholder="https://..."
            className={FIELD_CLASSES}
          />
        </label>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASSES}>Start Date</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => handleStartDateChange(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASSES}>End Date</span>
            <input
              type="date"
              required
              value={endDate}
              onChange={(event) => handleEndDateChange(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASSES}>Location</span>
          <input
            type="text"
            required
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Los Angeles, CA"
            className={FIELD_CLASSES}
          />
        </label>

        <div className="flex flex-col gap-3">
          <span className={LABEL_CLASSES}>Your Role</span>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isHosting}
              onChange={(event) => setIsHosting(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="font-serif text-lg text-foreground">
              I&apos;m hosting this Experience
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAttending}
              onChange={(event) => setIsAttending(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="font-serif text-lg text-foreground">
              I&apos;m also attending
            </span>
          </label>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Create Experience
        </button>
      </form>
    </main>
  );
}
