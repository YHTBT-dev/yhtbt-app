"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExperiences, updateExperience } from "@/data/experiencesStore";
import ThemePicker from "@/components/ThemePicker";

const FIELD_CLASSES =
  "mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 font-serif text-lg text-foreground placeholder:text-muted placeholder:italic focus:border-accent focus:outline-none";

const LABEL_CLASSES = "text-sm tracking-wide text-muted uppercase";

// PLACEHOLDER STORAGE: same approach (and same limit) as the Photos
// feature's uploads (src/data/photosStore.js) — stored as a base64 data
// URL directly on the experience record in localStorage. Not real photo
// storage; once real cloud storage exists (e.g. Supabase Storage), this
// should upload there instead and store a URL/reference.
const MAX_COVER_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

type Experience = {
  id: number;
  name: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  location?: string;
  roles: string[];
  theme?: string;
};

export default function EditExperiencePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [experience, setExperience] = useState<Experience | null | undefined>(
    undefined
  );
  const [name, setName] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState("editorial-classic");
  const [isHosting, setIsHosting] = useState(false);
  const [isAttending, setIsAttending] = useState(false);
  const [coverImageInputMode, setCoverImageInputMode] = useState<
    "url" | "upload"
  >("upload");
  const [coverImageError, setCoverImageError] = useState("");
  const [error, setError] = useState("");
  // Tracks whether endDate should keep following startDate. Stays true
  // until the user manually sets endDate to something other than
  // startDate, at which point their multi-day choice is respected.
  const [isEndDateAutoSynced, setIsEndDateAutoSynced] = useState(true);

  useEffect(() => {
    const experiences = getExperiences();
    const found = experiences.find(
      (item: Experience) => String(item.id) === params.id
    );
    setExperience(found ?? null);

    if (found) {
      setName(found.name);
      setCoverImage(found.coverImage);
      // If there's already a plain URL, default to that tab so it's
      // immediately visible/editable; a data URL (from an upload) or no
      // image at all defaults to the upload tab instead.
      setCoverImageInputMode(
        found.coverImage && !found.coverImage.startsWith("data:")
          ? "url"
          : "upload"
      );
      setStartDate(found.startDate);
      setEndDate(found.endDate);
      setLocation(found.location ?? "");
      setTheme(found.theme ?? "editorial-classic");
      setIsHosting(found.roles.includes("hosted"));
      setIsAttending(found.roles.includes("attended"));
      // Only keep auto-syncing if the existing record is single-day;
      // an existing multi-day range is a deliberate choice to respect.
      setIsEndDateAutoSynced(found.startDate === found.endDate);
    }
  }, [params.id]);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (isEndDateAutoSynced) setEndDate(value);
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    if (value !== startDate) setIsEndDateAutoSynced(false);
  }

  function handleCoverImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_COVER_IMAGE_SIZE_BYTES) {
      setCoverImageError("Cover image must be 2MB or smaller.");
      input.value = "";
      return;
    }

    setCoverImageError("");

    const reader = new FileReader();
    reader.onload = () => {
      setCoverImage(reader.result as string);
      input.value = "";
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    setError("");

    const roles = [
      ...(isHosting ? ["hosted"] : []),
      ...(isAttending ? ["attended"] : []),
    ];

    console.log("[EditExperiencePage] saving experience.theme:", theme);
    updateExperience(Number(params.id), {
      name,
      coverImage,
      startDate,
      endDate,
      location,
      roles,
      theme,
    });

    router.push(`/experiences/${params.id}`);
  }

  if (experience === undefined) {
    return null;
  }

  if (experience === null) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Experience not found
        </div>
      </main>
    );
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
        Edit Experience
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

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          className="mt-2 self-start border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
        >
          Save Changes
        </button>
      </form>
    </main>
  );
}
