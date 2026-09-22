"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import { addItineraryItem } from "@/data/itineraryStore";

const FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none";

const LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

const DRESS_CODE_PRESETS = [
  "Casual",
  "Smart Casual",
  "Cocktail",
  "Black Tie",
  "Beach Formal",
  "Athletic/Active",
  "Costume/Theme",
];

const DRESS_CODE_OTHER = "Other";

type Experience = {
  id: number;
  startDate: string;
  endDate: string;
};

export default function NewItineraryItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dressCodeOption, setDressCodeOption] = useState("");
  const [dressCodeOther, setDressCodeOther] = useState("");
  const [error, setError] = useState("");

  const dressCode =
    dressCodeOption === DRESS_CODE_OTHER ? dressCodeOther : dressCodeOption;

  useEffect(() => {
    let cancelled = false;

    getExperiences().then((experiences) => {
      if (cancelled) return;
      const found = experiences.find(
        (item: Experience) => String(item.id) === params.id
      );
      if (found) {
        setExperience(found);
        setDate(found.startDate);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      experience &&
      (date < experience.startDate || date > experience.endDate)
    ) {
      setError(
        `Date must be between ${experience.startDate} and ${experience.endDate}.`
      );
      return;
    }

    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setError("");

    addItineraryItem({
      experienceId: params.id,
      date,
      startTime,
      endTime,
      title,
      description,
      location,
      dressCode,
    });

    router.push(`/experiences/${params.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href="/experiences"
        className="block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to My Experiences
      </Link>

      <h1 className="mt-3 font-serif text-3xl text-foreground sm:text-4xl">
        New Itinerary Item
      </h1>

      <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASSES}>Date</span>
            <input
              type="date"
              required
              value={date}
              min={experience?.startDate}
              max={experience?.endDate}
              onChange={(event) => setDate(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASSES}>Start Time</span>
            <input
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASSES}>End Time</span>
            <input
              type="time"
              required
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASSES}>Title</span>
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Dinner at the Rooftop"
            className={FIELD_CLASSES}
          />
        </label>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
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

          <label className="block">
            <span className={LABEL_CLASSES}>Dress Code (Optional)</span>
            <select
              value={dressCodeOption}
              onChange={(event) => setDressCodeOption(event.target.value)}
              className={FIELD_CLASSES}
            >
              <option value="">None</option>
              {DRESS_CODE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
              <option value={DRESS_CODE_OTHER}>{DRESS_CODE_OTHER}</option>
            </select>
            {dressCodeOption === DRESS_CODE_OTHER ? (
              <input
                type="text"
                value={dressCodeOther}
                onChange={(event) => setDressCodeOther(event.target.value)}
                placeholder="Describe the dress code"
                className={`${FIELD_CLASSES} mt-3`}
              />
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASSES}>Description</span>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${FIELD_CLASSES} resize-none`}
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Add Itinerary Item
        </button>
      </form>
    </main>
  );
}
