"use client";

import { useState } from "react";
import PhoneNumberInput from "@/components/PhoneNumberInput";
import { formatPhoneForDisplay, isValidPhone } from "@/lib/phone";

// Dev-only isolated preview of PhoneNumberInput, rendered once per real,
// selectable theme (see ThemePicker.tsx's THEME_OPTIONS) in its own
// [data-theme] wrapper — same pattern as /dev/date-range-picker — so the
// third-party component's theming can be checked on light and dark
// themes side by side.
const PREVIEW_THEMES = [
  { value: "editorial-classic", label: "Editorial Classic" },
  { value: "coastal-light", label: "Coastal Light" },
  { value: "midnight-edition", label: "Midnight Edition" },
] as const;

function ThemePreview({ theme, label }: { theme: string; label: string }) {
  const [phone, setPhone] = useState("+529841234567");
  const inputId = `phone-preview-${theme}`;

  return (
    <div
      data-theme={theme}
      className="flex flex-col gap-4 border border-foreground/10 bg-background p-6"
    >
      <p className="font-serif text-xl text-foreground">{label}</p>
      <div>
        <label
          htmlFor={inputId}
          className="text-sm tracking-wide text-muted uppercase"
        >
          Phone
        </label>
        <PhoneNumberInput
          id={inputId}
          value={phone}
          onChange={setPhone}
          className="mt-2 font-serif text-lg"
        />
      </div>
      <dl className="text-sm text-muted">
        <dt className="inline">Stored: </dt>
        <dd className="inline font-mono text-foreground">{phone || "—"}</dd>
        <br />
        <dt className="inline">Display: </dt>
        <dd className="inline text-foreground">{formatPhoneForDisplay(phone) || "—"}</dd>
        <br />
        <dt className="inline">Valid: </dt>
        <dd className="inline text-foreground">{isValidPhone(phone) ? "yes" : "no"}</dd>
      </dl>
    </div>
  );
}

export default function PhoneInputPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        PhoneNumberInput Preview
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The shared phone field, rendered once per selectable theme.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {PREVIEW_THEMES.map((theme) => (
          <ThemePreview key={theme.value} theme={theme.value} label={theme.label} />
        ))}
      </div>
    </main>
  );
}
