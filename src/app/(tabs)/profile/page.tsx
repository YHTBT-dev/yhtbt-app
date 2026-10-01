"use client";

import { useEffect, useState } from "react";
import { getBrowserId } from "@/lib/browserId";
import { compressImageToBlob } from "@/lib/compressImage";
import LocationAutocompleteInput from "@/components/LocationAutocompleteInput";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import DietaryOptionsSelect from "@/components/DietaryOptionsSelect";
import { formatPhoneForDisplay, isValidPhone } from "@/lib/phone";
import { deleteExperiencePhoto, uploadProfilePhoto } from "@/lib/supabase";
import { EMPTY_PROFILE, getProfile, saveProfile } from "@/data/profilesStore";

type Profile = typeof EMPTY_PROFILE;

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; profile: Profile | null };

// A photo picked in the editor but not uploaded until Save.
type PendingPhoto = { file: File; previewUrl: string };

function Avatar({ photoUrl, profile }: { photoUrl: string; profile: Profile }) {
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`;

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden bg-foreground/5">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={`${profile.firstName} ${profile.lastName}`.trim() || "Profile photo"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-serif text-3xl text-muted">{initials}</span>
      )}
    </div>
  );
}

// Empty values are skipped, so optional fields simply don't appear.
function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm tracking-wide text-accent uppercase">{children}</p>
  );
}

const INPUT_CLASS_NAME =
  "w-full border-b border-foreground/10 bg-transparent pb-2 text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:border-accent focus:outline-none";

function EditField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 py-2 sm:flex-row sm:items-end sm:gap-4">
      <span className="w-36 shrink-0 text-sm text-muted sm:pb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className={INPUT_CLASS_NAME}
      />
    </label>
  );
}

export default function ProfilePage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getProfile(getBrowserId())
      .then((profile) => {
        if (!cancelled) setLoadState({ status: "loaded", profile });
      })
      .catch(() => {
        if (!cancelled) setLoadState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const savedProfile = loadState.status === "loaded" ? loadState.profile : null;

  function clearPendingPhoto() {
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto(null);
  }

  function startEditing() {
    setDraft(savedProfile ?? EMPTY_PROFILE);
    clearPendingPhoto();
    setSaveError("");
    setIsEditing(true);
  }

  function cancelEditing() {
    clearPendingPhoto();
    setIsEditing(false);
  }

  function updateDraft<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handlePhotoChange(file: File | undefined) {
    if (!file) return;
    clearPendingPhoto();
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function removePhoto() {
    clearPendingPhoto();
    updateDraft("photoUrl", "");
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    // Required, and must be a complete number — an empty field is already
    // caught by the input's own `required`, this covers partial entries.
    if (!isValidPhone(draft.phone)) {
      setSaveError("Enter a valid phone number.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    const browserId = getBrowserId();
    try {
      let photoUrl = draft.photoUrl;
      if (pendingPhoto) {
        const blob = await compressImageToBlob(pendingPhoto.file);
        photoUrl = await uploadProfilePhoto(browserId, blob);
      }

      const saved = await saveProfile(browserId, { ...draft, photoUrl });

      // The old photo is only removed once the new profile row no longer
      // points at it, so a failed save never leaves a broken image.
      const previousPhotoUrl = savedProfile?.photoUrl ?? "";
      if (previousPhotoUrl && previousPhotoUrl !== saved.photoUrl) {
        deleteExperiencePhoto(previousPhotoUrl);
      }

      clearPendingPhoto();
      setLoadState({ status: "loaded", profile: saved });
      setIsEditing(false);
    } catch {
      setSaveError("Couldn't save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loadState.status === "loading") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Profile</h1>
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Loading…
        </div>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Profile</h1>
        <div className="flex min-h-[40vh] items-center justify-center text-center font-serif text-lg text-muted italic">
          Couldn&rsquo;t load your profile. Please refresh to try again.
        </div>
      </div>
    );
  }

  if (isEditing) {
    const previewUrl = pendingPhoto?.previewUrl ?? draft.photoUrl;

    return (
      <form onSubmit={handleSave} className="max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Profile</h1>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="text-sm tracking-wide text-muted uppercase transition-colors hover:text-accent disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="border border-accent bg-accent px-6 py-3 text-sm tracking-wide text-background uppercase transition-opacity disabled:opacity-40"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {saveError ? (
          <p className="mt-4 text-sm text-red-600">{saveError}</p>
        ) : null}

        <div className="mt-10 flex items-center gap-6">
          <Avatar photoUrl={previewUrl} profile={draft} />
          <div className="flex flex-col items-start gap-2">
            <label className="cursor-pointer text-sm tracking-wide text-accent uppercase hover:underline">
              {previewUrl ? "Change photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  handlePhotoChange(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {previewUrl ? (
              <button
                type="button"
                onClick={removePhoto}
                className="text-xs text-muted underline underline-offset-2 hover:text-accent"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 border-t border-foreground/10 pt-6">
          <EditField label="First name" value={draft.firstName} onChange={(v) => updateDraft("firstName", v)} required />
          <EditField label="Last name" value={draft.lastName} onChange={(v) => updateDraft("lastName", v)} required />
          <EditField label="Company" value={draft.company} onChange={(v) => updateDraft("company", v)} placeholder="Optional" />
          <label className="flex flex-col gap-1 py-2 sm:flex-row sm:items-end sm:gap-4">
            <span className="w-36 shrink-0 text-sm text-muted sm:pb-2">Home city</span>
            <div className="w-full">
              <LocationAutocompleteInput
                citiesOnly
                value={draft.homeCity}
                onChange={(v) => updateDraft("homeCity", v)}
                placeholder="Austin, TX"
                className={INPUT_CLASS_NAME}
              />
            </div>
          </label>
        </div>

        <div className="mt-8 border-t border-foreground/10 pt-6">
          <SectionLabel>Contact</SectionLabel>
          <div className="mt-2">
            <EditField label="Email" type="email" value={draft.email} onChange={(v) => updateDraft("email", v)} />
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-end sm:gap-4">
              <label htmlFor="profile-phone" className="w-36 shrink-0 text-sm text-muted sm:pb-2">
                Phone
              </label>
              <PhoneNumberInput
                id="profile-phone"
                required
                value={draft.phone}
                onChange={(v) => updateDraft("phone", v)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-foreground/10 pt-6">
          <SectionLabel>Social</SectionLabel>
          <div className="mt-2">
            <EditField label="LinkedIn" value={draft.linkedin} onChange={(v) => updateDraft("linkedin", v)} placeholder="linkedin.com/in/…" />
            <EditField label="Instagram" value={draft.instagram} onChange={(v) => updateDraft("instagram", v)} placeholder="@handle" />
            <EditField label="X" value={draft.xHandle} onChange={(v) => updateDraft("xHandle", v)} placeholder="@handle" />
          </div>
        </div>

        <div className="mt-8 border-t border-foreground/10 pt-6">
          <SectionLabel>Dietary</SectionLabel>
          <div className="mt-2">
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-end sm:gap-4">
              <label htmlFor="profile-dietary-options" className="w-36 shrink-0 text-sm text-muted sm:pb-2">
                Restrictions
              </label>
              <DietaryOptionsSelect
                id="profile-dietary-options"
                value={draft.dietaryOptions}
                onChange={(v) => updateDraft("dietaryOptions", v)}
                className="w-full"
              />
            </div>
            <EditField
              label="Additional notes"
              value={draft.dietaryNotes}
              onChange={(v) => updateDraft("dietaryNotes", v)}
              placeholder="e.g. Severe peanut allergy — carries an EpiPen"
            />
          </div>
        </div>
      </form>
    );
  }

  if (!savedProfile) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Profile</h1>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 text-center">
          <p className="font-serif text-lg text-muted italic">
            You haven&rsquo;t set up your profile yet
          </p>
          <button
            type="button"
            onClick={startEditing}
            className="border border-accent px-6 py-3 text-sm tracking-wide text-accent uppercase transition-colors hover:bg-accent hover:text-background"
          >
            Set up profile
          </button>
        </div>
      </div>
    );
  }

  const hasContact = Boolean(savedProfile.email || savedProfile.phone);
  const hasSocial = Boolean(
    savedProfile.linkedin || savedProfile.instagram || savedProfile.xHandle
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Profile</h1>
        <button
          type="button"
          onClick={startEditing}
          className="shrink-0 border border-foreground/10 px-6 py-3 text-sm tracking-wide text-muted uppercase transition-colors hover:border-accent hover:text-accent"
        >
          Edit
        </button>
      </div>

      <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar photoUrl={savedProfile.photoUrl} profile={savedProfile} />
        <dl className="min-w-0 flex-1">
          <DetailRow label="First name" value={savedProfile.firstName} />
          <DetailRow label="Last name" value={savedProfile.lastName} />
          <DetailRow label="Company" value={savedProfile.company} />
          <DetailRow label="Home city" value={savedProfile.homeCity} />
        </dl>
      </div>

      {hasContact ? (
        <div className="mt-10 border-t border-foreground/10 pt-6">
          <SectionLabel>Contact</SectionLabel>
          <dl className="mt-2">
            <DetailRow label="Email" value={savedProfile.email} />
            <DetailRow label="Phone" value={formatPhoneForDisplay(savedProfile.phone)} />
          </dl>
        </div>
      ) : null}

      {hasSocial ? (
        <div className="mt-8 border-t border-foreground/10 pt-6">
          <SectionLabel>Social</SectionLabel>
          <dl className="mt-2">
            <DetailRow label="LinkedIn" value={savedProfile.linkedin} />
            <DetailRow label="Instagram" value={savedProfile.instagram} />
            <DetailRow label="X" value={savedProfile.xHandle} />
          </dl>
        </div>
      ) : null}

      {savedProfile.dietaryOptions.length > 0 || savedProfile.dietaryNotes ? (
        <div className="mt-8 border-t border-foreground/10 pt-6">
          <SectionLabel>Dietary</SectionLabel>
          {savedProfile.dietaryOptions.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {savedProfile.dietaryOptions.map((option) => (
                <li
                  key={option}
                  className="border border-accent/30 px-2 py-0.5 text-xs tracking-widest text-accent uppercase"
                >
                  {option}
                </li>
              ))}
            </ul>
          ) : null}
          {savedProfile.dietaryNotes ? (
            <p className="mt-3 text-foreground">{savedProfile.dietaryNotes}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
