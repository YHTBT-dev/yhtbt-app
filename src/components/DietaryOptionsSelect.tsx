"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DIETARY_OPTIONS, NO_RESTRICTIONS, toggleDietaryOption } from "@/lib/dietary";

type DietaryOptionsSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  id?: string;
  className?: string;
};

// Multi-select dropdown for the Profile's dietary options: a button
// summarizing the current picks that opens a checkbox list, styled like
// LocationAutocompleteInput's suggestions dropdown. Stays open while
// toggling so several can be picked in one go; closes on Escape or a
// click outside, same popover interaction as LocationAutocompleteInput.
export default function DietaryOptionsSelect({
  value,
  onChange,
  id,
  className = "",
}: DietaryOptionsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const hasNoRestrictions = value.includes(NO_RESTRICTIONS);

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
      if (event.key === "Escape") {
        // Keeps a surrounding Modal (if any) from also closing.
        event.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-3 border-b border-foreground/10 pb-2 text-left transition-colors focus:border-accent focus:outline-none"
      >
        {value.length > 0 ? (
          <span className="min-w-0 truncate text-foreground">{value.join(", ")}</span>
        ) : (
          <span className="text-sm text-placeholder italic">Select any that apply</span>
        )}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {isOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute inset-x-0 top-full z-20 mt-1 border border-foreground/10 bg-background py-1 shadow-lg"
        >
          {hasNoRestrictions ? (
            <li
              aria-hidden
              className="px-3 pt-2 pb-1 text-[10px] tracking-widest text-muted uppercase"
            >
              Pick an option to replace No Restrictions
            </li>
          ) : null}
          {DIETARY_OPTIONS.map((option) => {
            const isSelected = value.includes(option);
            // While "No Restrictions" is picked the other options are
            // grayed out, but deliberately NOT `disabled`: clicking one
            // still swaps it in for "No Restrictions" (toggleDietaryOption),
            // which a disabled checkbox couldn't do.
            const isDimmed = hasNoRestrictions && option !== NO_RESTRICTIONS;
            return (
              <li key={option} role="option" aria-selected={isSelected}>
                <label
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 font-serif text-sm transition-colors hover:bg-accent/10 hover:text-accent ${
                    isDimmed ? "text-foreground/40 [&>input]:opacity-40" : "text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onChange(toggleDietaryOption(value, option))}
                    className="h-4 w-4 accent-accent"
                  />
                  {option}
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
