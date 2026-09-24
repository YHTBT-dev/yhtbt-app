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

type DropdownPosition = { top: number; left: number; width: number };

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
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // BUG FIX: the dropdown used to be positioned via plain CSS (absolute,
  // anchored below the input through normal document flow) — that
  // worked in Chrome's mobile emulation (which doesn't actually resize
  // anything for a virtual keyboard) but not on a real iPhone. Opening
  // the keyboard there shrinks the VISUAL viewport while the LAYOUT
  // viewport (which CSS positioning is computed against) stays the same
  // size, and Safari auto-scrolls the focused input up so it's visible
  // above the keyboard — a document position computed for the
  // pre-keyboard state can end up rendering in the region the keyboard
  // now covers, or not track that scroll correctly at all.
  //
  // Fixed by switching to position: fixed with coordinates read fresh
  // from the input's own getBoundingClientRect() — which always
  // reflects where the input currently, actually is on screen —
  // recomputed whenever the dropdown opens AND on every visualViewport
  // resize/scroll event, which is what fires as the keyboard animates
  // open/closed on mobile Safari (the standard, documented way to
  // detect this). Falls back to plain window scroll/resize listeners
  // for browsers without the VisualViewport API.
  function updateDropdownPosition() {
    const inputEl = inputRef.current;
    if (!inputEl) return;

    const rect = inputEl.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", updateDropdownPosition);
      visualViewport.addEventListener("scroll", updateDropdownPosition);
    }
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener("resize", updateDropdownPosition);
        visualViewport.removeEventListener("scroll", updateDropdownPosition);
      }
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetTop: window.visualViewport.offsetTop,
              offsetLeft: window.visualViewport.offsetLeft,
            }
          : "not supported",
        dropdownPosition,
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
  }, [isOpen, suggestions, dropdownPosition]);

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
        ref={inputRef}
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

      {isOpen && suggestions.length > 0 && dropdownPosition ? (
        <ul
          ref={dropdownRef}
          data-location-autocomplete-dropdown
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
          className="z-20 mt-1 border border-foreground/10 bg-background shadow-lg"
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
