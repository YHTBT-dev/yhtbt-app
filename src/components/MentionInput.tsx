"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  reconcileMentions,
  type MentionDraft,
  type MentionRange,
} from "@/lib/mentions";

const MAX_QUERY_LENGTH = 30;
const MAX_SUGGESTIONS = 6;

type MentionableGuest = { id: number; name: string };

type MentionInputProps = {
  value: MentionDraft;
  onChange: (value: MentionDraft) => void;
  guests: MentionableGuest[];
  placeholder?: string;
  required?: boolean;
  name?: string;
  className?: string;
};

type ActiveQuery = { atIndex: number; query: string };
type DropdownPosition = { top: number; left: number };

// Computed styles the backdrop copies from the input so its text lines up
// glyph-for-glyph with what the input is actually rendering.
const MIRRORED_STYLES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

// The "@" being typed right now, if the caret sits in a run like
// "…hey @Jam|". The "@" must start the text or follow whitespace (so an
// email address never triggers it) and can't be part of a mention that's
// already been inserted.
function getActiveQuery(
  text: string,
  caret: number,
  mentions: MentionRange[]
): ActiveQuery | null {
  if (caret <= 0) return null;
  const atIndex = text.lastIndexOf("@", caret - 1);
  if (atIndex < 0) return null;
  if (atIndex > 0 && !/\s/.test(text[atIndex - 1])) return null;
  if (mentions.some((mention) => atIndex >= mention.start && atIndex < mention.end)) {
    return null;
  }

  const query = text.slice(atIndex + 1, caret);
  if (query.length > MAX_QUERY_LENGTH || /^\s/.test(query)) return null;
  return { atIndex, query };
}

function matchGuests(guests: MentionableGuest[], query: string) {
  const needle = query.toLowerCase();
  return guests
    .filter((guest) => {
      const name = guest.name.toLowerCase();
      return name.startsWith(needle) || name.includes(` ${needle}`);
    })
    .slice(0, MAX_SUGGESTIONS);
}

// A single-line text input with @mention autocomplete for this
// Experience's guests. Typing "@" opens a dropdown at the caret, filtered
// as the host keeps typing; picking a guest (click, Enter or Tab) swaps
// the "@query" for a mention "@Jamie B" and carries on typing after it.
// An "@" that matches nobody is just text — no dropdown, nothing blocked.
//
// A native <input> can't style part of its value, so mentions are drawn
// by a backdrop behind it: the input's own text is transparent (caret,
// selection and placeholder still render normally) and the backdrop
// repeats the same text in the same font, with mentions accent-colored.
// Mentions only change color/background, never font weight, so every
// glyph keeps its width and the two layers stay aligned.
export default function MentionInput({
  value,
  onChange,
  guests,
  placeholder,
  required,
  name,
  className,
}: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const backdropTextRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const listboxId = useId();

  const [caret, setCaret] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // Escape hides the dropdown for the "@" it was open for; typing a new
  // "@" elsewhere brings it back.
  const [dismissedAtIndex, setDismissedAtIndex] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition | null>(null);

  const activeQuery = isFocused
    ? getActiveQuery(value.text, caret, value.mentions)
    : null;
  const suggestions =
    activeQuery && activeQuery.atIndex !== dismissedAtIndex
      ? matchGuests(guests, activeQuery.query)
      : [];
  const isOpen = suggestions.length > 0;
  const activeIndex = Math.min(highlightedIndex, suggestions.length - 1);

  // Keeps the backdrop exactly over the input's text box and scrolled the
  // same distance when the text is wider than the field, then (if the
  // dropdown is open) re-anchors the dropdown under the "@".
  const syncBackdrop = useCallback(() => {
    const input = inputRef.current;
    const backdrop = backdropRef.current;
    const backdropText = backdropTextRef.current;
    if (!input || !backdrop || !backdropText) return;

    const computed = getComputedStyle(input);
    for (const property of MIRRORED_STYLES) {
      backdrop.style[property] = computed[property];
    }
    backdrop.style.top = `${input.offsetTop}px`;
    backdrop.style.left = `${input.offsetLeft}px`;
    backdrop.style.width = `${input.offsetWidth}px`;
    backdrop.style.height = `${input.offsetHeight}px`;
    backdropText.style.transform = `translateX(${-input.scrollLeft}px)`;

    const marker = markerRef.current;
    if (!marker) {
      setDropdownPosition(null);
      return;
    }
    const inputRect = input.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const left = Math.max(
      inputRect.left,
      Math.min(markerRect.left, inputRect.right - 224)
    );
    setDropdownPosition((current) =>
      current?.top === inputRect.bottom && current.left === left
        ? current
        : { top: inputRect.bottom, left }
    );
  }, []);

  useLayoutEffect(() => {
    if (pendingCaretRef.current !== null && inputRef.current) {
      const nextCaret = pendingCaretRef.current;
      pendingCaretRef.current = null;
      inputRef.current.setSelectionRange(nextCaret, nextCaret);
    }
    syncBackdrop();
  });

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const observer = new ResizeObserver(syncBackdrop);
    observer.observe(input);
    // Same reasoning as LocationAutocompleteInput: the dropdown is
    // position: fixed from getBoundingClientRect, so it has to follow
    // page scroll and the mobile keyboard resizing the visual viewport.
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", syncBackdrop);
    visualViewport?.addEventListener("scroll", syncBackdrop);
    window.addEventListener("scroll", syncBackdrop, true);
    window.addEventListener("resize", syncBackdrop);

    return () => {
      observer.disconnect();
      visualViewport?.removeEventListener("resize", syncBackdrop);
      visualViewport?.removeEventListener("scroll", syncBackdrop);
      window.removeEventListener("scroll", syncBackdrop, true);
      window.removeEventListener("resize", syncBackdrop);
    };
  }, [syncBackdrop]);

  function readCaret() {
    const input = inputRef.current;
    if (!input) return;
    setCaret(input.selectionStart ?? input.value.length);
    syncBackdrop();
  }

  function handleChange(nextText: string, nextCaret: number) {
    onChange({
      text: nextText,
      mentions: reconcileMentions(value, nextText, nextCaret),
    });
    setCaret(nextCaret);
    setHighlightedIndex(0);
    const nextQuery = getActiveQuery(nextText, nextCaret, value.mentions);
    if (nextQuery?.atIndex !== dismissedAtIndex) setDismissedAtIndex(null);
  }

  function selectGuest(guest: MentionableGuest) {
    if (!activeQuery) return;
    const { text } = value;
    const label = `@${guest.name}`;
    // Adds the space after the mention unless one is already there, and
    // lands the caret after it either way so typing just carries on.
    const hasSpaceAfter = text[caret] === " ";
    const insertion = hasSpaceAfter ? label : `${label} `;
    const nextText =
      text.slice(0, activeQuery.atIndex) + insertion + text.slice(caret);
    const insertionEnd = activeQuery.atIndex + insertion.length;
    const nextCaret = insertionEnd + (hasSpaceAfter ? 1 : 0);

    const mention: MentionRange = {
      guestId: guest.id,
      name: guest.name,
      start: activeQuery.atIndex,
      end: activeQuery.atIndex + label.length,
    };
    onChange({
      text: nextText,
      mentions: [
        ...reconcileMentions(value, nextText, insertionEnd),
        mention,
      ].sort((a, b) => a.start - b.start),
    });
    pendingCaretRef.current = nextCaret;
    setCaret(nextCaret);
    setHighlightedIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || !activeQuery) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex(
        (activeIndex + step + suggestions.length) % suggestions.length
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      // Enter would otherwise submit the whole form mid-mention.
      event.preventDefault();
      selectGuest(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAtIndex(activeQuery.atIndex);
    }
  }

  return (
    <div className="relative">
      <div
        ref={backdropRef}
        aria-hidden
        className="pointer-events-none absolute flex items-center overflow-hidden border-solid border-transparent text-foreground"
      >
        <span ref={backdropTextRef} className="shrink-0 whitespace-pre">
          {renderBackdropText(value, isOpen ? activeQuery?.atIndex : undefined, markerRef)}
        </span>
      </div>

      <input
        ref={inputRef}
        type="text"
        name={name}
        required={required}
        autoComplete="off"
        value={value.text}
        placeholder={placeholder}
        onChange={(event) =>
          handleChange(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length
          )
        }
        onSelect={readCaret}
        onScroll={syncBackdrop}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setIsFocused(true);
          readCaret();
        }}
        onBlur={() => setIsFocused(false)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen ? `${listboxId}-${suggestions[activeIndex].id}` : undefined
        }
        // Inline rather than a text-* class so it can't lose a cascade
        // fight with a color utility in the caller's className.
        style={{ color: "transparent" }}
        className={`relative caret-foreground ${className ?? ""}`}
      />

      {isOpen && dropdownPosition ? (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
          className="z-20 mt-1 w-56 border border-foreground/10 bg-background shadow-lg"
        >
          {suggestions.map((guest, index) => (
            <li
              key={guest.id}
              id={`${listboxId}-${guest.id}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown, not click, and preventDefault so the input
              // never loses focus (which would close the dropdown first).
              onMouseDown={(event) => {
                event.preventDefault();
                selectGuest(guest);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`cursor-pointer truncate px-3 py-2 font-serif text-sm transition-colors ${
                index === activeIndex
                  ? "bg-accent/10 text-accent"
                  : "text-foreground"
              }`}
            >
              {guest.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// The backdrop's copy of the text: mentions highlighted, plus an empty
// marker span at the "@" being typed so the dropdown can be positioned
// right under it.
function renderBackdropText(
  { text, mentions }: MentionDraft,
  markerIndex: number | undefined,
  markerRef: RefObject<HTMLSpanElement | null>
) {
  const nodes: ReactNode[] = [];

  function pushPlain(from: number, to: number) {
    if (markerIndex !== undefined && markerIndex >= from && markerIndex < to) {
      nodes.push(text.slice(from, markerIndex));
      nodes.push(<span key="marker" ref={markerRef} />);
      nodes.push(text.slice(markerIndex, to));
    } else {
      nodes.push(text.slice(from, to));
    }
  }

  let cursor = 0;
  for (const mention of mentions) {
    pushPlain(cursor, mention.start);
    nodes.push(
      <span
        key={`${mention.start}-${mention.guestId}`}
        className="rounded-sm bg-accent/10 text-accent"
      >
        {text.slice(mention.start, mention.end)}
      </span>
    );
    cursor = mention.end;
  }
  pushPlain(cursor, text.length);
  return nodes;
}
