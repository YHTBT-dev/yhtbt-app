"use client";

import {
  DayPicker,
  type DateRange,
  type Matcher,
  type OnSelectHandler,
} from "react-day-picker";

// A thin wrapper around react-day-picker's range mode (see
// react-day-picker/style.css, imported globally in globals.css) — a
// two-click selection where the first click sets the start of the range
// and the second sets the end, with every day in between visually
// highlighted. Styling comes entirely from the .rdp-root token mapping in
// globals.css (search "react-day-picker theming"), which reads this
// app's own --color-bg/--color-text/--color-accent tokens rather than
// react-day-picker's own hardcoded defaults — so this automatically
// matches whichever theme is active on the nearest [data-theme] ancestor,
// same as everything else in the app.
//
// Now wired into Experience creation/editing (see
// src/app/experiences/new/page.tsx and src/app/experiences/[id]/edit/
// page.tsx) — see /dev/date-range-picker for an isolated preview across
// all three real themes.

export type { DateRange };

type DateRangePickerProps = {
  value: DateRange | undefined;
  // The fuller react-day-picker onSelect signature (not just the
  // resulting range) — DateRangePickerField needs the second
  // (triggerDate) argument to fix reopening on an existing range
  // otherwise only letting the end date move, see the comment there.
  onChange: OnSelectHandler<DateRange | undefined>;
  numberOfMonths?: number;
  disabled?: Matcher | Matcher[];
  // Which month the calendar opens on before anything's been clicked —
  // without this it always opens on the current month regardless of
  // `value`, which is disorienting when editing a range set far in the
  // future.
  defaultMonth?: Date;
};

export default function DateRangePicker({
  value,
  onChange,
  numberOfMonths = 1,
  disabled,
  defaultMonth,
}: DateRangePickerProps) {
  return (
    <DayPicker
      mode="range"
      selected={value}
      onSelect={onChange}
      numberOfMonths={numberOfMonths}
      disabled={disabled}
      defaultMonth={defaultMonth}
      showOutsideDays
    />
  );
}
