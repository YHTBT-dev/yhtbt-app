"use client";

import { useState } from "react";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";

// Dev-only isolated preview — NOT wired into the real Experience
// creation form yet. Renders the new DateRangePicker once per real,
// selectable theme (see ThemePicker.tsx's THEME_OPTIONS) side by side,
// each in its own [data-theme] wrapper, so all three can be compared at
// once before this replaces the plain start/end date inputs anywhere.
// Safe to delete once that replacement ships and this has served its
// purpose.
const PREVIEW_THEMES = [
  { value: "editorial-classic", label: "Editorial Classic" },
  { value: "coastal-light", label: "Coastal Light" },
  { value: "midnight-edition", label: "Midnight Edition" },
] as const;

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "No range selected";
  if (!range.to) return `${range.from.toLocaleDateString()} – …`;
  return `${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`;
}

function ThemePreview({ theme, label }: { theme: string; label: string }) {
  const [range, setRange] = useState<DateRange | undefined>();

  return (
    <div
      data-theme={theme}
      className="flex flex-col gap-4 border border-foreground/10 bg-background p-6"
    >
      <div>
        <p className="font-serif text-xl text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted">{formatRange(range)}</p>
      </div>
      <DateRangePicker value={range} onChange={setRange} />
    </div>
  );
}

export default function DateRangePickerPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
        DateRangePicker Preview
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Isolated view of the new react-day-picker-based range picker,
        rendered once per real theme. Click a day to start a range, click
        another to complete it.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {PREVIEW_THEMES.map((theme) => (
          <ThemePreview key={theme.value} theme={theme.value} label={theme.label} />
        ))}
      </div>
    </main>
  );
}
