"use client";

import { useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import Link from "next/link";
import { formatDateRange } from "@/lib/format";

type Props = {
  imageUrl: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  // Shown top-left under "Hosted by"; the whole block is omitted if empty.
  hostName?: string;
  // Renders "[n] of us were there" when given (and greater than zero).
  attendeeCount?: number;
  // One of the app's theme names. Sets data-theme on the cover itself so
  // fonts and accents follow that theme even outside an Experience layout
  // (e.g. the printed keepsake book cover). Omit to inherit from the page.
  theme?: string;
  // Focal point as 0-100 percentages, applied as CSS object-position.
  focalX?: number;
  focalY?: number;
  // Host-only controls. With canEdit false (or no handlers) the cover is a
  // pure, static display, which is all the keepsake book needs.
  canEdit?: boolean;
  onChangeImage?: (file: File) => Promise<void>;
  onSaveFocalPoint?: (x: number, y: number) => Promise<boolean>;
  onImageError?: () => void;
  // Host-only "Edit Experience" link, shown beside "Change image".
  editHref?: string;
  className?: string;
};

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <path
        d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

// Keepsake-style cover: full-bleed photo under a dark overlay (heavier at
// the bottom so white text stays readable), wordmark and host top-left,
// title / dates / location / attendee line lower-left. Taller on phones,
// wide on desktop. Everything it needs comes in as props, so the same
// component can front the printed keepsake book.
export default function ExperienceCover({
  imageUrl,
  title,
  startDate,
  endDate,
  location,
  hostName,
  attendeeCount,
  theme,
  focalX = 50,
  focalY = 50,
  canEdit = false,
  onChangeImage,
  onSaveFocalPoint,
  onImageError,
  editHref,
  className = "",
}: Props) {
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [draft, setDraft] = useState({ x: focalX, y: focalY });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    overflowX: number;
    overflowY: number;
  } | null>(null);

  const shown = isRepositioning ? draft : { x: focalX, y: focalY };
  const canReposition = canEdit && !!onSaveFocalPoint && !!imageUrl;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const box = containerRef.current;
    const img = imgRef.current;
    if (!isRepositioning || !box || !img || !img.naturalWidth) return;
    // Presses on Save/Cancel must not start a drag: pointer capture on the
    // container would retarget the click away from the button.
    if ((event.target as HTMLElement).closest("button")) return;

    // With object-fit: cover the image is scaled until it covers the box;
    // the overflow on each axis is how far it can slide.
    const scale = Math.max(
      box.clientWidth / img.naturalWidth,
      box.clientHeight / img.naturalHeight
    );
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: draft.x,
      originY: draft.y,
      overflowX: img.naturalWidth * scale - box.clientWidth,
      overflowY: img.naturalHeight * scale - box.clientHeight,
    };
    box.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    // Dragging the photo right reveals more of its left side, so the
    // focal point moves opposite to the pointer.
    const nextX =
      drag.overflowX > 0
        ? drag.originX - ((event.clientX - drag.startX) / drag.overflowX) * 100
        : drag.originX;
    const nextY =
      drag.overflowY > 0
        ? drag.originY - ((event.clientY - drag.startY) / drag.overflowY) * 100
        : drag.originY;
    setDraft({ x: clamp(nextX), y: clamp(nextY) });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleSaveFocalPoint() {
    if (!onSaveFocalPoint) return;
    setIsSaving(true);
    const saved = await onSaveFocalPoint(
      Math.round(draft.x),
      Math.round(draft.y)
    );
    setIsSaving(false);
    if (saved) {
      setIsRepositioning(false);
      setMessage("");
    } else {
      setMessage("Could not save the position.");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !onChangeImage) return;

    setIsUploading(true);
    setMessage("");
    try {
      await onChangeImage(file);
    } catch {
      setMessage("Could not upload that image. Try again.");
    }
    setIsUploading(false);
  }

  const smallButton =
    "bg-black/40 px-3 py-1.5 text-xs tracking-wide text-white uppercase backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50";

  return (
    <div
      ref={containerRef}
      data-theme={theme}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`experience-cover relative isolate h-[34rem] w-full overflow-hidden bg-accent text-white sm:h-[26rem] ${
        isRepositioning ? "cursor-grab touch-none active:cursor-grabbing" : ""
      } ${className}`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          onError={onImageError}
          draggable={false}
          style={{ objectPosition: `${shown.x}% ${shown.y}%` }}
          className="experience-cover-image absolute inset-0 -z-10 h-full w-full object-cover select-none"
        />
      ) : null}

      {/* Light overlay overall, heavier toward the bottom for the text. */}
      <div className="experience-cover-overlay pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/75 [print-color-adjust:exact]" />

      <div
        className={`experience-cover-content absolute inset-0 flex flex-col justify-between p-5 sm:p-10 ${
          // Leaves room for the host controls pinned to the bottom edge.
          canEdit ? "pb-14 sm:pb-16" : ""
        } ${isRepositioning ? "pointer-events-none" : ""}`}
      >
        <div className="flex items-stretch gap-4">
          <span className="self-center font-serif text-sm tracking-[0.25em] uppercase">
            YHTBT
          </span>
          {hostName ? (
            <>
              <span
                className="experience-cover-divider w-px self-stretch bg-white/50"
                aria-hidden
              />
              <div className="flex flex-col justify-center">
                <span className="text-[10px] tracking-[0.2em] text-white/80 uppercase">
                  Hosted by
                </span>
                <span className="font-serif text-base leading-tight">
                  {hostName}
                </span>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] break-words sm:text-6xl">
            {title}
          </h1>
          <p className="mt-2 text-sm tracking-wide text-white/90">
            {formatDateRange(startDate, endDate)}
          </p>
          {location ? (
            <p className="flex items-center gap-1.5 text-sm text-white/90">
              <PinIcon />
              {location}
            </p>
          ) : null}
          {attendeeCount && attendeeCount > 0 ? (
            <p className="mt-1 font-serif text-base italic text-white/90">
              {attendeeCount} of us were there
            </p>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className="absolute inset-x-5 bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 sm:inset-x-10">
          {isRepositioning ? (
            <>
              <span className={smallButton}>
                {message || "Drag to reposition"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRepositioning(false)}
                  disabled={isSaving}
                  className={smallButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFocalPoint}
                  disabled={isSaving}
                  className="bg-white px-3 py-1.5 text-xs tracking-wide text-black uppercase disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {onChangeImage ? (
                  <label className={`${smallButton} cursor-pointer`}>
                    {isUploading ? "Uploading…" : "Change image"}
                    <input
                      type="file"
                      name="coverImage"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : null}
                {editHref ? (
                  <Link href={editHref} className={smallButton}>
                    Edit Experience
                  </Link>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {message ? (
                  <span className="text-xs text-white/90">{message}</span>
                ) : null}
                {canReposition ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ x: focalX, y: focalY });
                      setMessage("");
                      setIsRepositioning(true);
                    }}
                    className={smallButton}
                  >
                    Reposition
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
