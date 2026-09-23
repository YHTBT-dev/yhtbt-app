"use client";

import { useEffect, useRef, useState } from "react";
import type { Matcher } from "react-day-picker";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";
import { formatDateRange, formatLocalDateString } from "@/lib/format";

export type { DateRange };

type DateRangePickerFieldProps = {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  disabled?: Matcher | Matcher[];
  defaultMonth?: Date;
  // How many days ahead of the clicked start date the first click's
  // auto-default end date should land — 0 (default) means "same day",
  // matching Experience dates' single-day default. Hotel stays pass 1
  // for a one-night-stay default, still freely overridable by a second,
  // later click, same "sensible default until overridden" shape either
  // way.
  autoSyncDays?: number;
};

// A compact trigger showing the current selection ("Select your dates"
// until both ends are picked), which opens DateRangePicker as a popover
// anchored below it instead of an always-visible inline calendar pushing
// the rest of the form down. Closes on Escape or a click outside it,
// same interaction as Modal.tsx, just anchored to the trigger rather
// than a centered, dimmed overlay.
export default function DateRangePickerField({
  value,
  onChange,
  disabled,
  defaultMonth,
  autoSyncDays = 0,
}: DateRangePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Whether a click has happened yet during the current "open" session —
  // reset every time the popover opens. Used by handleSelect below to
  // force the first click after (re)opening to start a genuinely new
  // selection, rather than letting react-day-picker treat a pre-existing
  // complete range as something to keep extending.
  const hasClickedSinceOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) hasClickedSinceOpenRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(range: DateRange | undefined, triggerDate: Date) {
    const isFirstClickSinceOpen = !hasClickedSinceOpenRef.current;
    hasClickedSinceOpenRef.current = true;

    // BUG FIX: reopening the picker on an already-complete range (e.g.
    // editing an existing Experience or hotel stay) made only the end
    // date movable — react-day-picker's own range logic (addToRange)
    // only ever adjusts `to` once both from and to already exist,
    // treating the range as "continuing" rather than starting fresh.
    // Forcing the first click after (re)opening to start a brand-new
    // single-day range at whatever day was actually clicked — ignoring
    // react-day-picker's own computed range for that one click —
    // restores the same first-click-sets-start, second-click-sets-end
    // behavior as a brand-new, empty picker, regardless of what was
    // pre-selected.
    let effectiveRange: DateRange | undefined =
      isFirstClickSinceOpen && value?.from && value?.to
        ? { from: triggerDate, to: triggerDate }
        : range;

    // Pushes that first click's auto-default end date autoSyncDays days
    // later than the library's own same-day default, if requested (e.g.
    // hotel stays defaulting to one night) — same "sensible default,
    // overridable by a second click" shape either way.
    if (
      isFirstClickSinceOpen &&
      autoSyncDays > 0 &&
      effectiveRange?.from &&
      effectiveRange?.to &&
      effectiveRange.from.toDateString() === effectiveRange.to.toDateString()
    ) {
      const to = new Date(effectiveRange.from);
      to.setDate(to.getDate() + autoSyncDays);
      effectiveRange = { from: effectiveRange.from, to };
    }

    onChange(effectiveRange);

    // Closes automatically once a genuinely complete range is chosen —
    // but NOT on the first click since opening, which is always just an
    // auto-defaulted starting point (same day, or +autoSyncDays), never
    // a deliberate final choice. Without this, the popover would vanish
    // before a second click gets the chance to override that default.
    if (!isFirstClickSinceOpen && effectiveRange?.from && effectiveRange?.to) {
      setIsOpen(false);
    }
  }

  const displayText =
    value?.from && value?.to
      ? formatDateRange(
          formatLocalDateString(value.from),
          formatLocalDateString(value.to)
        )
      : "Select your dates";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`mt-2 w-full border-b border-foreground/10 bg-transparent pb-2 text-left font-serif text-lg focus:border-accent focus:outline-none ${
          value?.from && value?.to ? "text-foreground" : "text-placeholder italic"
        }`}
      >
        {displayText}
      </button>

      {isOpen ? (
        <div className="absolute top-full left-0 z-20 mt-2 border border-foreground/10 bg-background p-4 shadow-lg">
          <DateRangePicker
            value={value}
            onChange={handleSelect}
            disabled={disabled}
            defaultMonth={defaultMonth}
          />
        </div>
      ) : null}
    </div>
  );
}
