"use client";

import PhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/phone";

type PhoneNumberInputProps = {
  // E.164 ("+15552014433"), or "" when empty.
  value: string;
  onChange: (value: string) => void;
  // Lets a <label htmlFor> point at the number input. Don't wrap this
  // component in a <label> instead: the first control inside is the
  // hidden country <select>, so the label would focus that.
  id?: string;
  name?: string;
  required?: boolean;
  // Only visible once the calling-code prefix has been cleared by
  // switching to "International".
  placeholder?: string;
  autoComplete?: string;
  // Spacing/typography for the field as a whole (e.g. "mt-2 font-serif
  // text-lg"); the underline, colors and focus state are owned here so
  // every phone field looks the same.
  className?: string;
};

// The one phone field used everywhere (Profile, guest add/edit, RSVP):
// react-phone-number-input with a country selector defaulting to US,
// country-specific formatting as you type, and an E.164 value out.
//
// Always international, with the selected country's calling code shown
// as a fixed prefix ("+44 "), so only the number after it is typed. The
// library's national mode only formats numbers typed with their national
// trunk prefix (UK "07911…", France "06…") — typing just the digits after
// the code left them unformatted. limitMaxLength stops input at the
// longest valid length for the country.
//
// Flags are bundled via the `flags` prop instead of the library's default
// of loading each flag image from an external site. Its colors are
// remapped onto the theme tokens in globals.css (.phone-number-input).
export default function PhoneNumberInput({
  value,
  onChange,
  id,
  name,
  required,
  placeholder,
  autoComplete = "tel",
  className = "",
}: PhoneNumberInputProps) {
  // A stored value that couldn't be converted to E.164 (see
  // normalizePhoneNumber) can't be loaded into the input, so it starts
  // empty with the old text shown below for reference.
  const isUnreadable = Boolean(value) && !value.startsWith("+");

  return (
    <div className={className}>
      <PhoneInput
        flags={flags}
        defaultCountry={DEFAULT_PHONE_COUNTRY}
        international
        countryCallingCodeEditable={false}
        limitMaxLength
        value={isUnreadable ? undefined : value || undefined}
        onChange={(next) => onChange(next ?? "")}
        id={id}
        name={name}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="phone-number-input w-full border-b border-foreground/10 pb-2 transition-colors focus-within:border-accent"
        numberInputProps={{
          className:
            "bg-transparent text-foreground placeholder:text-placeholder placeholder:text-sm placeholder:italic focus:outline-none",
        }}
      />
      {isUnreadable ? (
        <p className="mt-1 text-xs text-muted">
          Previously saved as &ldquo;{value}&rdquo; — please re-enter it, or{" "}
          <button
            type="button"
            onClick={() => onChange("")}
            className="underline underline-offset-2 hover:text-accent"
          >
            clear
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}
