"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPlaceSuggestions, type PlaceSuggestion } from "@/lib/places";

const DEBOUNCE_MS = 300;

type LocationAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

// A plain, always-editable text input for a free-text location field,
// with Google Places suggestions layered on top as a dropdown — never
// required to pick one (see fetchPlaceSuggestions in @/lib/places for
// how a failed/empty lookup just degrades to a normal text input rather
// than blocking anything). Closes on Escape or a click outside it, same
// popover interaction as DateRangePickerField.
export default function LocationAutocompleteInput({
  value,
  onChange,
  placeholder,
  required,
  className,
}: LocationAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow, stale request's results landing after a
  // newer keystroke already started a different lookup.
  const latestQueryRef = useRef("");

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // TEMPORARY diagnostic logging — added to track down a report that the
  // suggestions dropdown fails specifically at narrow/mobile viewport
  // widths (confirmed via Chrome mobile emulation). Logs whether the
  // dropdown is actually in the DOM, its real computed position/size,
  // the viewport width, and — most tellingly — what element is actually
  // sitting at its center point (elementFromPoint), which directly
  // reveals whether something else is covering it. Remove once that's
  // confirmed fixed.
  useEffect(() => {
    if (!isOpen) {
      console.log("[LocationAutocomplete] closed/not rendering");
      return;
    }

    // Runs after paint so getBoundingClientRect reflects real layout.
    const frame = requestAnimationFrame(() => {
      const dropdownEl = dropdownRef.current;
      const containerEl = containerRef.current;
      if (!dropdownEl || !containerEl) {
        console.log(
          "[LocationAutocomplete] isOpen is true but dropdown/container ref is null — not actually in the DOM"
        );
        return;
      }

      const dropdownRect = dropdownEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const centerX = dropdownRect.left + dropdownRect.width / 2;
      const centerY = dropdownRect.top + dropdownRect.height / 2;
      const topElementAtCenter = document.elementFromPoint(centerX, centerY);

      console.log("[LocationAutocomplete] dropdown is in the DOM", {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        containerRect,
        dropdownRect,
        computedDisplay: getComputedStyle(dropdownEl).display,
        computedVisibility: getComputedStyle(dropdownEl).visibility,
        computedOpacity: getComputedStyle(dropdownEl).opacity,
        computedZIndex: getComputedStyle(dropdownEl).zIndex,
        // If this is NOT the dropdown (or one of its list items), some
        // other element is visually covering it at that point.
        elementCoveringCenterPoint: topElementAtCenter,
        isDropdownCoveringItself: dropdownEl.contains(topElementAtCenter),
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, suggestions]);

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

  function handleInputChange(nextValue: string) {
    // The field's real value updates immediately regardless of what the
    // lookup below does — free-text entry (a private address, "Natalie's
    // place", etc.) always works, the dropdown is purely an optional
    // affordance on top.
    onChange(nextValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = nextValue.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      latestQueryRef.current = trimmed;
      const results = await fetchPlaceSuggestions(trimmed);
      if (latestQueryRef.current !== trimmed) return;
      console.log(
        `[LocationAutocomplete] setting ${results.length} suggestion(s), opening:`,
        results.length > 0
      );
      setSuggestions(results);
      setIsOpen(results.length > 0);
    }, DEBOUNCE_MS);
  }

  function handleSelectSuggestion(suggestion: PlaceSuggestion) {
    onChange(suggestion.description);
    setSuggestions([]);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        required={required}
        value={value}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        className={className}
        // Prevents the browser's own address-field autofill dropdown
        // from visually competing with the Places suggestions below.
        autoComplete="off"
      />

      {isOpen && suggestions.length > 0 ? (
        <ul
          ref={dropdownRef}
          data-location-autocomplete-dropdown
          className="absolute top-full left-0 z-20 mt-1 w-full border border-foreground/10 bg-background shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="block w-full px-3 py-2 text-left font-serif text-sm text-foreground transition-colors hover:bg-accent/10 hover:text-accent"
              >
                {suggestion.description}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
