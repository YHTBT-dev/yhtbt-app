"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { addExperience, EXPERIENCE_TYPES } from "@/data/experiencesStore";
import { compressImageFile } from "@/lib/compressImage";
import { getTodayLocalDateString } from "@/lib/format";
import ThemePicker from "@/components/ThemePicker";

const FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none";

const LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

// PLACEHOLDER STORAGE: same approach (and same limit) as the Photos
// feature's uploads (src/data/photosStore.js) — stored as a base64 data
// URL directly on the experience record in localStorage. Not real photo
// storage; once real cloud storage exists (e.g. Supabase Storage), this
// should upload there instead and store a URL/reference.
const MAX_COVER_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

// Experiences at or under this estimated guest count are free — no
// platform fee, no Stripe Checkout. Above it, the host pays the platform
// tier fee via Checkout before the experience is created.
const GUEST_COUNT_FREE_TIER_THRESHOLD = 20;

export default function NewExperiencePage() {
  const router = useRouter();
  const today = getTodayLocalDateString();
  const [name, setName] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [experienceType, setExperienceType] = useState("");
  const [estimatedGuestCount, setEstimatedGuestCount] = useState("");
  const [theme, setTheme] = useState("editorial-classic");
  const [isHosting, setIsHosting] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [coverImageInputMode, setCoverImageInputMode] = useState<
    "url" | "upload"
  >("upload");
  const [coverImageError, setCoverImageError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  async function handleCoverImageFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setCoverImageError("");

    try {
      // Compressed first (resized + re-encoded as JPEG) so the size limit
      // below is checked against what actually gets stored, not the
      // original file.
      const dataUrl = await compressImageFile(file);

      if (dataUrl.length > MAX_COVER_IMAGE_SIZE_BYTES) {
        setCoverImageError("Cover image is too large even after compression.");
        input.value = "";
        return;
      }

      setCoverImage(dataUrl);
      input.value = "";
    } catch {
      setCoverImageError("Could not process that image. Try a different file.");
      input.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coverImage) {
      setError("Add a cover image.");
      return;
    }

    if (!isHosting && !isAttending) {
      setError("Select at least one: hosting or attending.");
      return;
    }

    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }

    const guestCount = Number(estimatedGuestCount);
    if (!estimatedGuestCount || !Number.isInteger(guestCount) || guestCount < 1) {
      setError("Enter a valid estimated guest count.");
      return;
    }

    setError("");

    const roles = [
      ...(isHosting ? ["hosted"] : []),
      ...(isAttending ? ["attended"] : []),
    ];

    // Small experiences are free — no platform fee, no Checkout. The real
    // guest list built later in the Guests section is separate from this
    // upfront estimate.
    if (guestCount <= GUEST_COUNT_FREE_TIER_THRESHOLD) {
      setIsSubmitting(true);

      try {
        const newExperience = await addExperience({
          name,
          coverImage,
          startDate,
          endDate,
          location,
          roles,
          experienceType,
          estimatedGuestCount: guestCount,
          theme,
          paid: false,
        });
        console.log(
          "[NewExperiencePage] saved experience.theme:",
          newExperience.theme
        );
        sessionStorage.setItem("justCreated", String(newExperience.id));
        router.push(`/experiences/${newExperience.id}`);
      } catch {
        setError("Could not save this Experience. Please try again.");
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          // coverImage is deliberately NOT sent here — it's a base64 data
          // URL (up to ~2MB), and Stripe Checkout Session metadata values
          // are capped at 500 characters, so it can't round-trip through
          // Stripe like the other fields. Stashed in sessionStorage below
          // instead, keyed by the Checkout Session ID, and picked back up
          // on the success page after payment.
          startDate,
          endDate,
          location,
          roles,
          estimatedGuestCount: guestCount,
          theme,
          experienceType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url || !data.sessionId) {
        setError(data.error || "Could not start checkout. Please try again.");
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem(`coverImage:${data.sessionId}`, coverImage);

      // Full navigation to Stripe's hosted Checkout page, outside the app.
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setIsSubmitting(false);
    }
  }

  const guestCountValue = Number(estimatedGuestCount);
  const requiresPayment =
    estimatedGuestCount !== "" &&
    Number.isInteger(guestCountValue) &&
    guestCountValue > GUEST_COUNT_FREE_TIER_THRESHOLD;

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

        <div className="flex flex-col gap-3">
          <span className={LABEL_CLASSES}>Cover Image</span>

          {coverImage ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt=""
                className="h-20 w-32 object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImage("")}
                className="text-sm text-muted underline underline-offset-2 transition-colors hover:text-red-600"
              >
                Remove Image
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCoverImageInputMode("url")}
              className={`border-b-2 px-1 pb-1 text-sm tracking-wide uppercase transition-colors ${
                coverImageInputMode === "url"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-accent"
              }`}
            >
              Paste a URL
            </button>
            <button
              type="button"
              onClick={() => setCoverImageInputMode("upload")}
              className={`border-b-2 px-1 pb-1 text-sm tracking-wide uppercase transition-colors ${
                coverImageInputMode === "upload"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-accent"
              }`}
            >
              Upload a Photo
            </button>
          </div>

          {coverImageInputMode === "url" ? (
            <input
              type="url"
              value={coverImage.startsWith("data:") ? "" : coverImage}
              onChange={(event) => setCoverImage(event.target.value)}
              placeholder="https://..."
              className={FIELD_CLASSES}
            />
          ) : (
            <div>
              <label className="inline-block cursor-pointer border border-accent px-5 py-2 text-center text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background">
                {coverImage ? "Replace Image" : "Upload Image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {coverImageError ? (
            <p className="text-sm text-red-600">{coverImageError}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASSES}>Start Date</span>
            <input
              type="date"
              required
              min={today}
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
              min={today}
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

        <label className="block">
          <span className={LABEL_CLASSES}>Experience Type (Optional)</span>
          <select
            value={experienceType}
            onChange={(event) => setExperienceType(event.target.value)}
            className={FIELD_CLASSES}
          >
            <option value="">None</option>
            {EXPERIENCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-3">
          <span className={LABEL_CLASSES}>Select your theme</span>
          <ThemePicker value={theme} onChange={setTheme} />
        </div>

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

        <label className="block">
          <span className={LABEL_CLASSES}>Estimated Guest Count</span>
          <input
            type="number"
            required
            min={1}
            step={1}
            value={estimatedGuestCount}
            onChange={(event) => setEstimatedGuestCount(event.target.value)}
            placeholder="12"
            className={FIELD_CLASSES}
          />
        </label>

        <p className="text-sm text-muted italic">
          {requiresPayment
            ? `Experiences over ${GUEST_COUNT_FREE_TIER_THRESHOLD} guests require the platform tier fee. You'll be taken to a secure Stripe checkout page (test mode) next.`
            : `Experiences of ${GUEST_COUNT_FREE_TIER_THRESHOLD} guests or fewer are free — no payment required.`}
        </p>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? requiresPayment
              ? "Redirecting to Checkout…"
              : "Saving…"
            : requiresPayment
              ? "Continue to Payment"
              : "Create Experience"}
        </button>
      </form>
    </main>
  );
}
