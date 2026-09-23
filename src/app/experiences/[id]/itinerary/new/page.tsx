"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExperiences } from "@/data/experiencesStore";
import {
  addItineraryItem,
  DEFAULT_ITINERARY_ITEM_TYPE,
  ITINERARY_ITEM_TYPES,
} from "@/data/itineraryStore";
import { ItineraryTypeIcon } from "@/components/ItineraryTypeIcon";
import { addDaysToLocalDateString } from "@/lib/format";

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
  name: string;
  startDate: string;
  endDate: string;
};

// Wraps past midnight (23:xx -> 00:xx) rather than clamping — itinerary
// items don't support crossing midnight (see the endTime <= startTime
// check below), so a wrapped result just leaves the auto-suggested end
// time invalid, same as if the user had typed an out-of-range one
// themselves; the existing submit-time validation catches it either way.
function addOneHour(timeString: string) {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":").map(Number);
  const nextHours = (hours + 1) % 24;
  return `${String(nextHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default function NewItineraryItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Stays true until the user manually sets endTime to something other
  // than startTime + 1 hour, at which point their explicit choice is
  // respected — same auto-sync-until-manually-changed pattern already
  // used for check-in/check-out and Experience start/end dates.
  const [isEndTimeAutoSynced, setIsEndTimeAutoSynced] = useState(true);
  const [type, setType] = useState(DEFAULT_ITINERARY_ITEM_TYPE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dressCodeOption, setDressCodeOption] = useState("");
  const [dressCodeOther, setDressCodeOther] = useState("");
  const [error, setError] = useState("");

  const dressCode =
    dressCodeOption === DRESS_CODE_OTHER ? dressCodeOther : dressCodeOption;

  // A 1-day buffer on either side of the Experience's own dates — lets a
  // host add an arrival-day or departure-day item just outside the
  // official dates, without loosening the default (still the
  // Experience's actual startDate, set above).
  const minDate = experience
    ? addDaysToLocalDateString(experience.startDate, -1)
    : undefined;
  const maxDate = experience
    ? addDaysToLocalDateString(experience.endDate, 1)
    : undefined;

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

  function handleStartTimeChange(value: string) {
    setStartTime(value);

    if (isEndTimeAutoSynced) {
      setEndTime(addOneHour(value));
    }
  }

  function handleEndTimeChange(value: string) {
    setEndTime(value);
    // Sync target is startTime + 1 hour; once the user picks anything
    // else, respect their manually-chosen duration going forward.
    if (value !== addOneHour(startTime)) setIsEndTimeAutoSynced(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (minDate && maxDate && (date < minDate || date > maxDate)) {
      setError(`Date must be between ${minDate} and ${maxDate}.`);
      return;
    }

    // Done here in JS rather than via the time inputs' own `required`
    // attribute — iOS Safari has a known bug where a required
    // input[type=time]'s native clear ("x") button doesn't actually work
    // (WebKit won't let the field go empty via that control while
    // required is set), so `required` was removed from those inputs
    // below and this check takes over enforcing it.
    if (!startTime || !endTime) {
      setError("Enter a start and end time.");
      return;
    }

    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setError("");

    try {
      await addItineraryItem({
        experienceId: params.id,
        date,
        startTime,
        endTime,
        title,
        description,
        location,
        dressCode,
        type,
      });

      router.push(`/experiences/${params.id}`);
    } catch {
      setError("Could not save this item. Please try again.");
    }
  }

  // Whether the form has any actual input worth protecting — used to
  // decide whether leaving needs a confirmation. date and type aren't
  // included: they start at meaningful (non-blank) defaults (the
  // Experience's own startDate, DEFAULT_ITINERARY_ITEM_TYPE) rather than
  // something a user "entered", so leaving those untouched alone
  // shouldn't trigger a discard warning.
  const hasEnteredContent =
    title.trim() !== "" ||
    description.trim() !== "" ||
    location.trim() !== "" ||
    startTime !== "" ||
    endTime !== "" ||
    dressCodeOption !== "";

  function handleBackClick(event: MouseEvent<HTMLAnchorElement>) {
    if (hasEnteredContent && !window.confirm("Discard changes and go back?")) {
      event.preventDefault();
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/experiences/${params.id}`}
        onClick={handleBackClick}
        className="block text-sm text-muted underline underline-offset-2 transition-colors hover:text-accent"
      >
        &larr; Back to {experience?.name ?? "Experience"}
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
              min={minDate}
              max={maxDate}
              onChange={(event) => setDate(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASSES}>Start Time</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => handleStartTimeChange(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>

          <label className="block">
            <span className={LABEL_CLASSES}>End Time</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => handleEndTimeChange(event.target.value)}
              className={FIELD_CLASSES}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASSES}>Type</span>
          <div className="mt-2 flex items-center gap-3">
            <span className="shrink-0 text-muted">
              <ItineraryTypeIcon type={type} />
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className={FIELD_CLASSES}
            >
              {ITINERARY_ITEM_TYPES.map((itemType) => (
                <option key={itemType} value={itemType}>
                  {itemType}
                </option>
              ))}
            </select>
          </div>
        </label>

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
