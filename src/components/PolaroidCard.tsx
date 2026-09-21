"use client";

import Modal from "@/components/Modal";
import { formatRelativeTime } from "@/lib/format";

// Fixed, non-theme-driven palette, deliberately — a polaroid's white
// border shouldn't change with the site theme, the same way a real photo
// doesn't change color based on the wall it's hung on. Every color inside
// the card (background AND text) has to stay fixed together, not just the
// background: if only the background were pinned white while the text
// kept using the theme's var(--foreground)/var(--muted), a light-on-dark
// theme like Midnight Edition would render near-invisible light text on
// this always-white card. So none of these reference the theme tokens.
const POLAROID_BG = "#fdfbf3";
const POLAROID_TEXT = "#1b1a17";
const POLAROID_MUTED = "#6b6560";
const POLAROID_ACCENT = "#8a3b2b";
// The inset "photo window" inside the card, so it reads as a distinct
// mounted frame rather than open padding. The no-photo case's fill comes
// from getPolaroidTint() below instead of a single fixed color.
const POLAROID_FRAME_BORDER = "1px solid rgba(27, 26, 23, 0.14)";
const POLAROID_FRAME_SHADOW = "inset 0 1px 4px rgba(0, 0, 0, 0.1)";

// Deterministic per-card "randomness" from the entry's id, so the tilt
// doesn't jitter on every re-render (a real Math.random() at render time
// would reshuffle whenever anything on the page re-renders) — a small
// multiplicative hash spread across 9 steps from -4deg to 4deg.
function getPolaroidRotationDeg(id: number) {
  return ((id * 2654435761) % 9) - 4;
}

// Muted, desaturated tints for the no-photo card's inset frame — dark
// text (POLAROID_TEXT) stays comfortably legible against every one of
// these. Fixed, like the rest of the polaroid palette, so they read the
// same regardless of the active site theme.
const POLAROID_NO_PHOTO_TINTS = [
  "#e8d5d0", // muted rose
  "#d9e0d3", // pale sage
  "#d3dde3", // dusty blue
  "#e8dcc8", // warm sand
  "#ddd7e0", // lavender-gray
];

// A different multiplier than getPolaroidRotationDeg's, so an entry's
// tint and tilt don't visibly correlate — same entry always gets the
// same tint (stable across re-renders), different entries get visibly
// different ones.
function getPolaroidTint(id: number) {
  const index = (id * 40503 + 7) % POLAROID_NO_PHOTO_TINTS.length;
  return POLAROID_NO_PHOTO_TINTS[index];
}

// Visual-only truncation on top of the storage character limits — a
// script font runs wider per character than a normal one, and the inset
// frame is a fixed square with overflow hidden, so even a response under
// the storage limit can still overflow the frame's visible area rather
// than wrapping to more lines than fit. These two numbers were tuned
// together against the frame's actual size (not picked independently of
// it) — see the live feed's original sizing note in
// /experiences/[id]/page.tsx's history. A line-clamp below is the actual
// hard guarantee against raw overflow; these lengths just keep the
// "…"-truncated preview text close to what the clamp will show, so the
// two don't fight each other.
const REFLECTION_CAPTION_TRUNCATE_LENGTH = 60;
const REFLECTION_MAIN_TRUNCATE_LENGTH = 110;
const REFLECTION_MAIN_FONT_SIZE_PX = 22;
const REFLECTION_MAIN_LINE_CLAMP = 6;

function truncateForCard(text: string, maxLength: number) {
  if (text.length <= maxLength) return { text, isTruncated: false };
  return { text: text.slice(0, maxLength).trimEnd() + "…", isTruncated: true };
}

export type PolaroidReflection = {
  id: number;
  promptText: string;
  responseText: string;
  photo: string | null;
  guestName: string;
  taggedGuests: string[];
  createdAt: string;
};

function getAttributionLine(reflection: PolaroidReflection) {
  return [
    // Older entries may still have a name attached (collected before
    // this field was removed from the submission form); new entries are
    // unattributed, same as Updates.
    reflection.guestName || null,
    reflection.taggedGuests.length > 0
      ? `with ${reflection.taggedGuests.join(", ")}`
      : null,
    formatRelativeTime(reflection.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

type PolaroidCardProps<T extends PolaroidReflection> = {
  reflection: T;
  // The live feed's scattered-pile look; a keepsake's aligned grid turns
  // this off so the tilt doesn't fight a composed, orderly layout.
  rotate?: boolean;
  onExpand: (reflection: T) => void;
  // Host-only moderation — omit entirely to hide the Delete control (the
  // keepsake, a read-only compiled view, doesn't pass one).
  onDelete?: (id: number) => void;
};

// Generic over the caller's own reflection type (which always has more
// fields than the minimal PolaroidReflection shape — experienceId,
// hidden, etc.) so onExpand can be wired directly to something like
// useState's setter without a cast.
export function PolaroidCard<T extends PolaroidReflection>({
  reflection,
  rotate = true,
  onExpand,
  onDelete,
}: PolaroidCardProps<T>) {
  const mainTruncated = reflection.photo
    ? null
    : truncateForCard(reflection.responseText, REFLECTION_MAIN_TRUNCATE_LENGTH);
  const captionTruncated = reflection.photo
    ? truncateForCard(reflection.responseText, REFLECTION_CAPTION_TRUNCATE_LENGTH)
    : null;
  const isExpandable = !!(
    mainTruncated?.isTruncated || captionTruncated?.isTruncated
  );

  return (
    <div
      style={
        rotate
          ? { transform: `rotate(${getPolaroidRotationDeg(reflection.id)}deg)` }
          : undefined
      }
    >
      <div
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        onClick={isExpandable ? () => onExpand(reflection) : undefined}
        onKeyDown={
          isExpandable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onExpand(reflection);
                }
              }
            : undefined
        }
        style={{
          background: POLAROID_BG,
          boxShadow: "0 10px 25px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
          padding: "14px 14px 0",
          cursor: isExpandable ? "pointer" : undefined,
        }}
      >
        <div
          className="aspect-square w-full"
          style={{
            boxSizing: "border-box",
            border: POLAROID_FRAME_BORDER,
            boxShadow: POLAROID_FRAME_SHADOW,
            overflow: "hidden",
            ...(reflection.photo
              ? {}
              : {
                  background: getPolaroidTint(reflection.id),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                }),
          }}
        >
          {reflection.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reflection.photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <p
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontWeight: 600,
                fontSize: `${REFLECTION_MAIN_FONT_SIZE_PX}px`,
                lineHeight: 1.2,
                textAlign: "center",
                color: POLAROID_TEXT,
                // Hard safety net on top of the character truncation
                // above: whatever the exact card width ends up being at
                // render time, this guarantees a clean line-boundary "…"
                // clip instead of the frame's own overflow:hidden
                // silently chopping the text off mid-line.
                display: "-webkit-box",
                WebkitLineClamp: REFLECTION_MAIN_LINE_CLAMP,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {mainTruncated!.text}
            </p>
          )}
        </div>

        <div style={{ padding: "12px 4px 34px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: POLAROID_MUTED,
            }}
          >
            {reflection.promptText}
          </p>
          {reflection.photo ? (
            <p
              style={{
                margin: "4px 0 0",
                fontFamily: "var(--font-caveat), cursive",
                fontWeight: 500,
                fontSize: "20px",
                lineHeight: 1.2,
                color: POLAROID_TEXT,
              }}
            >
              {captionTruncated!.text}
            </p>
          ) : null}
          {isExpandable ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "10px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: POLAROID_ACCENT,
              }}
            >
              Tap to read more
            </p>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            <p style={{ margin: 0, fontSize: "11px", color: POLAROID_MUTED }}>
              {getAttributionLine(reflection)}
            </p>
            {onDelete ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(reflection.id);
                }}
                style={{
                  fontSize: "11px",
                  color: POLAROID_MUTED,
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
                className="shrink-0 transition-colors hover:!text-red-600"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type PolaroidExpandModalProps = {
  reflection: PolaroidReflection | null;
  onClose: () => void;
};

// The full, untruncated view for a card whose preview text got cut off —
// shared by the live feed and the keepsake so "tap to read more" behaves
// identically in both places.
export function PolaroidExpandModal({
  reflection,
  onClose,
}: PolaroidExpandModalProps) {
  return (
    <Modal isOpen={!!reflection} onClose={onClose} title="Reflection">
      {reflection ? (
        <div className="flex flex-col gap-4">
          {reflection.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reflection.photo}
              alt=""
              className="w-full object-cover"
            />
          ) : null}
          <p className="text-sm tracking-wide text-muted uppercase">
            {reflection.promptText}
          </p>
          <p className="font-serif text-lg text-foreground">
            {reflection.responseText}
          </p>
          <p className="text-xs text-muted">{getAttributionLine(reflection)}</p>
        </div>
      ) : null}
    </Modal>
  );
}
