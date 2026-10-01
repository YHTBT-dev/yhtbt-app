import {
  formatPhoneNumberIntl,
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input";

// Every phone number in the app (Profile, guests, RSVPs) is stored in
// E.164 — "+15552014433" — regardless of how it's displayed, so it can be
// handed as-is to anything that actually sends a text (e.g. Twilio Verify).
// PhoneNumberInput produces E.164 directly; these helpers cover older
// values and validation/display.

export const DEFAULT_PHONE_COUNTRY: Country = "US";

// Converts a stored value to E.164 when it can be read. Numbers saved
// before PhoneNumberInput existed were free text like "(555) 201-4433";
// those are read as US numbers unless they carry their own +country code.
// Anything unreadable is returned unchanged (never dropped) — the input
// shows it as needing re-entry instead.
export function normalizePhoneNumber(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  try {
    return parsePhoneNumber(trimmed, DEFAULT_PHONE_COUNTRY)?.number ?? trimmed;
  } catch {
    return trimmed;
  }
}

// True only for a complete, real number for its country — an E.164 value
// that's just a partial entry ("+1555") is not valid.
export function isValidPhone(value: string): boolean {
  return Boolean(value) && isValidPhoneNumber(value);
}

// "+1 555 201 4433" for display; falls back to the stored text for a value
// that isn't E.164.
export function formatPhoneForDisplay(value: string): string {
  if (!value) return "";
  return (value.startsWith("+") && formatPhoneNumberIntl(value)) || value;
}
